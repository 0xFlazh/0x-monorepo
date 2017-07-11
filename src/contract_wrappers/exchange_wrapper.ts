import * as _ from 'lodash';
import * as BigNumber from 'bignumber.js';
import promisify = require('es6-promisify');
import * as Web3 from 'web3';
import {Web3Wrapper} from '../web3_wrapper';
import {
    ECSignature,
    ExchangeContract,
    ExchangeContractErrCodes,
    ExchangeContractErrs,
    ZeroExError,
    OrderValues,
    OrderAddresses,
    Order,
    OrderFillOrKillRequest,
    SignedOrder,
    ContractEvent,
    ExchangeEvents,
    ContractEventEmitter,
    SubscriptionOpts,
    IndexedFilterValues,
    CreateContractEvent,
    ContractEventObj,
    ContractResponse,
    OrderCancellationRequest,
    OrderFillRequest,
    LogErrorContractEventArgs,
    LogFillContractEventArgs,
    LogCancelContractEventArgs,
    EventCallback,
    ContractEventArg,
    ExchangeContractByAddress,
    ContractArtifact,
} from '../types';
import {assert} from '../utils/assert';
import {utils} from '../utils/utils';
import {eventUtils} from '../utils/event_utils';
import {ContractWrapper} from './contract_wrapper';
import {ProxyWrapper} from './proxy_wrapper';
import {ecSignatureSchema} from '../schemas/ec_signature_schema';
import {signedOrdersSchema} from '../schemas/signed_orders_schema';
import {subscriptionOptsSchema} from '../schemas/subscription_opts_schema';
import {indexFilterValuesSchema} from '../schemas/index_filter_values_schema';
import {orderFillRequestsSchema} from '../schemas/order_fill_requests_schema';
import {orderCancellationRequestsSchema} from '../schemas/order_cancel_schema';
import {orderFillOrKillRequestsSchema} from '../schemas/order_fill_or_kill_requests_schema';
import {orderHashSchema} from '../schemas/order_hash_schema';
import {signedOrderSchema, orderSchema} from '../schemas/order_schemas';
import {constants} from '../utils/constants';
import {TokenWrapper} from './token_wrapper';
import {decorators} from '../utils/decorators';
import {ExchangeArtifactsByName} from '../exchange_artifacts_by_name';

/**
 * This class includes all the functionality related to calling methods and subscribing to
 * events of the 0x Exchange smart contract.
 */
export class ExchangeWrapper extends ContractWrapper {
    private _exchangeContractErrCodesToMsg = {
        [ExchangeContractErrCodes.ERROR_FILL_EXPIRED]: ExchangeContractErrs.ORDER_FILL_EXPIRED,
        [ExchangeContractErrCodes.ERROR_CANCEL_EXPIRED]: ExchangeContractErrs.ORDER_FILL_EXPIRED,
        [ExchangeContractErrCodes.ERROR_FILL_NO_VALUE]: ExchangeContractErrs.ORDER_REMAINING_FILL_AMOUNT_ZERO,
        [ExchangeContractErrCodes.ERROR_CANCEL_NO_VALUE]: ExchangeContractErrs.ORDER_REMAINING_FILL_AMOUNT_ZERO,
        [ExchangeContractErrCodes.ERROR_FILL_TRUNCATION]: ExchangeContractErrs.ORDER_FILL_ROUNDING_ERROR,
        [ExchangeContractErrCodes.ERROR_FILL_BALANCE_ALLOWANCE]: ExchangeContractErrs.FILL_BALANCE_ALLOWANCE_ERROR,
    };
    private _exchangeContractByAddress: ExchangeContractByAddress;
    private _exchangeLogEventEmitters: ContractEventEmitter[];
    private _tokenWrapper: TokenWrapper;
    private static _getOrderAddressesAndValues(order: Order): [OrderAddresses, OrderValues] {
        const orderAddresses: OrderAddresses = [
            order.maker,
            order.taker,
            order.makerTokenAddress,
            order.takerTokenAddress,
            order.feeRecipient,
        ];
        const orderValues: OrderValues = [
            order.makerTokenAmount,
            order.takerTokenAmount,
            order.makerFee,
            order.takerFee,
            order.expirationUnixTimestampSec,
            order.salt,
        ];
        return [orderAddresses, orderValues];
    }
    constructor(web3Wrapper: Web3Wrapper, tokenWrapper: TokenWrapper) {
        super(web3Wrapper);
        this._tokenWrapper = tokenWrapper;
        this._exchangeLogEventEmitters = [];
        this._exchangeContractByAddress = {};
    }
    /**
     * Returns the unavailable takerAmount of an order. Unavailable amount is defined as the total
     * amount that has been filled or cancelled. The remaining takerAmount can be calculated by
     * subtracting the unavailable amount from the total order takerAmount.
     * @param   orderHash               The hex encoded orderHash for which you would like to retrieve the
     *                                  unavailable takerAmount.
     * @param   exchangeContractAddress The hex encoded address of the Exchange contract to call.
     * @return  The amount of the order (in taker tokens) that has either been filled or canceled.
     */
    public async getUnavailableTakerAmountAsync(orderHash: string,
                                                exchangeContractAddress: string): Promise<BigNumber.BigNumber> {
        assert.doesConformToSchema('orderHash', orderHash, orderHashSchema);

        const exchangeContract = await this._getExchangeContractAsync(exchangeContractAddress);
        let unavailableTakerTokenAmount = await exchangeContract.getUnavailableTakerTokenAmount.call(orderHash);
        // Wrap BigNumbers returned from web3 with our own (later) version of BigNumber
        unavailableTakerTokenAmount = new BigNumber(unavailableTakerTokenAmount);
        return unavailableTakerTokenAmount;
    }
    /**
     * Retrieve the takerAmount of an order that has already been filled.
     * @param   orderHash    The hex encoded orderHash for which you would like to retrieve the filled takerAmount.
     * @param   exchangeContractAddress The hex encoded address of the Exchange contract to call.
     * @return  The amount of the order (in taker tokens) that has already been filled.
     */
    public async getFilledTakerAmountAsync(orderHash: string,
                                           exchangeContractAddress: string): Promise<BigNumber.BigNumber> {
        assert.doesConformToSchema('orderHash', orderHash, orderHashSchema);

        const exchangeContract = await this._getExchangeContractAsync(exchangeContractAddress);
        let fillAmountInBaseUnits = await exchangeContract.filled.call(orderHash);
        // Wrap BigNumbers returned from web3 with our own (later) version of BigNumber
        fillAmountInBaseUnits = new BigNumber(fillAmountInBaseUnits);
        return fillAmountInBaseUnits;
    }
    /**
     * Retrieve the takerAmount of an order that has been cancelled.
     * @param   orderHash    The hex encoded orderHash for which you would like to retrieve the
     *                       cancelled takerAmount.
     * @param   exchangeContractAddress The hex encoded address of the Exchange contract to call.
     * @return  The amount of the order (in taker tokens) that has been cancelled.
     */
    public async getCanceledTakerAmountAsync(orderHash: string,
                                             exchangeContractAddress: string): Promise<BigNumber.BigNumber> {
        assert.doesConformToSchema('orderHash', orderHash, orderHashSchema);

        const exchangeContract = await this._getExchangeContractAsync(exchangeContractAddress);
        let cancelledAmountInBaseUnits = await exchangeContract.cancelled.call(orderHash);
        // Wrap BigNumbers returned from web3 with our own (later) version of BigNumber
        cancelledAmountInBaseUnits = new BigNumber(cancelledAmountInBaseUnits);
        return cancelledAmountInBaseUnits;
    }
    /**
     * Fills a signed order with an amount denominated in baseUnits of the taker token.
     * Since the order in which transactions are included in the next block is indeterminate, race-conditions
     * could arise where a users balance or allowance changes before the fillOrder executes. Because of this,
     * we allow you to specify `shouldCheckTransfer`. If true, the smart contract will not throw if the parties
     * do not have sufficient balances/allowances, preserving gas costs. Setting it to false forgoes this check
     * and causes the smart contract to throw (using all the gas supplied) instead.
     * @param   signedOrder                                 An object that conforms to the SignedOrder interface.
     * @param   fillTakerTokenAmount                        The amount of the order (in taker tokens baseUnits) that
     *                                                      you wish to fill.
     * @param   shouldThrowOnInsufficientBalanceOrAllowance Whether or not you wish for the contract call to throw
     *                                                      if upon execution the tokens cannot be transferred.
     * @param   takerAddress                                The user Ethereum address who would like to fill this order.
     *                                                      Must be available via the supplied Web3.Provider
     *                                                      passed to 0x.js.
     * @return The amount of the order that was filled (in taker token baseUnits).
     */
    @decorators.contractCallErrorHandler
    public async fillOrderAsync(signedOrder: SignedOrder, fillTakerTokenAmount: BigNumber.BigNumber,
                                shouldThrowOnInsufficientBalanceOrAllowance: boolean,
                                takerAddress: string): Promise<BigNumber.BigNumber> {
        assert.doesConformToSchema('signedOrder', signedOrder, signedOrderSchema);
        assert.isBigNumber('fillTakerTokenAmount', fillTakerTokenAmount);
        assert.isBoolean('shouldThrowOnInsufficientBalanceOrAllowance', shouldThrowOnInsufficientBalanceOrAllowance);
        await assert.isSenderAddressAsync('takerAddress', takerAddress, this._web3Wrapper);

        const exchangeInstance = await this._getExchangeContractAsync(signedOrder.exchangeContractAddress);
        await this._validateFillOrderAndThrowIfInvalidAsync(signedOrder, fillTakerTokenAmount, takerAddress);

        const [orderAddresses, orderValues] = ExchangeWrapper._getOrderAddressesAndValues(signedOrder);

        const gas = await exchangeInstance.fillOrder.estimateGas(
            orderAddresses,
            orderValues,
            fillTakerTokenAmount,
            shouldThrowOnInsufficientBalanceOrAllowance,
            signedOrder.ecSignature.v,
            signedOrder.ecSignature.r,
            signedOrder.ecSignature.s,
            {
                from: takerAddress,
            },
        );
        const response: ContractResponse = await exchangeInstance.fillOrder(
            orderAddresses,
            orderValues,
            fillTakerTokenAmount,
            shouldThrowOnInsufficientBalanceOrAllowance,
            signedOrder.ecSignature.v,
            signedOrder.ecSignature.r,
            signedOrder.ecSignature.s,
            {
                from: takerAddress,
                gas,
            },
        );
        this._throwErrorLogsAsErrors(response.logs);
        const logFillArgs = response.logs[0].args as LogFillContractEventArgs;
        const filledTakerTokenAmount = new BigNumber(logFillArgs.filledTakerTokenAmount);
        return filledTakerTokenAmount;
    }
    /**
     * Sequentially and atomically fills signedOrders up to the specified takerTokenFillAmount.
     * If the fill amount is reached - it succeeds and does not fill the rest of the orders.
     * If fill amount is not reached - it fills as much of the fill amount as possible and succeeds.
     * @param   signedOrders                                The array of signedOrders that you would like to fill until
     *                                                      takerTokenFillAmount is reached.
     * @param   fillTakerTokenAmount                        The total amount of the takerTokens you would like to fill.
     * @param   shouldThrowOnInsufficientBalanceOrAllowance Whether or not you wish for the contract call to throw if
     *                                                      upon execution any of the tokens cannot be transferred.
     *                                                      If set to false, the call will continue to fill subsequent
     *                                                      signedOrders even when some cannot be filled.
     * @param   takerAddress                                The user Ethereum address who would like to fill these
     *                                                      orders. Must be available via the supplied Web3.Provider
     *                                                      passed to 0x.js.
     * @return The amount of the orders that was filled (in taker token baseUnits).
     */
    @decorators.contractCallErrorHandler
    public async fillOrdersUpToAsync(signedOrders: SignedOrder[], fillTakerTokenAmount: BigNumber.BigNumber,
                                     shouldThrowOnInsufficientBalanceOrAllowance: boolean,
                                     takerAddress: string): Promise<BigNumber.BigNumber> {
        assert.doesConformToSchema('signedOrders', signedOrders, signedOrdersSchema);
        const takerTokenAddresses = _.map(signedOrders, signedOrder => signedOrder.takerTokenAddress);
        assert.hasAtMostOneUniqueValue(takerTokenAddresses,
                                       ExchangeContractErrs.MULTIPLE_TAKER_TOKENS_IN_FILL_UP_TO_DISALLOWED);
        const exchangeContractAddresses = _.map(signedOrders, signedOrder => signedOrder.exchangeContractAddress);
        assert.hasAtMostOneUniqueValue(exchangeContractAddresses,
                                       ExchangeContractErrs.BATCH_ORDERS_MUST_HAVE_SAME_EXCHANGE_ADDRESS);
        assert.isBigNumber('fillTakerTokenAmount', fillTakerTokenAmount);
        assert.isBoolean('shouldThrowOnInsufficientBalanceOrAllowance', shouldThrowOnInsufficientBalanceOrAllowance);
        await assert.isSenderAddressAsync('takerAddress', takerAddress, this._web3Wrapper);
        for (const signedOrder of signedOrders) {
            await this._validateFillOrderAndThrowIfInvalidAsync(
                signedOrder, fillTakerTokenAmount, takerAddress);
        }
        if (_.isEmpty(signedOrders)) {
            return new BigNumber(0); // no-op
        }

        const orderAddressesValuesAndSignatureArray = _.map(signedOrders, signedOrder => {
            return [
                ...ExchangeWrapper._getOrderAddressesAndValues(signedOrder),
                signedOrder.ecSignature.v,
                signedOrder.ecSignature.r,
                signedOrder.ecSignature.s,
            ];
        });
        // We use _.unzip<any> because _.unzip doesn't type check if values have different types :'(
        const [orderAddressesArray, orderValuesArray, vArray, rArray, sArray] = _.unzip<any>(
            orderAddressesValuesAndSignatureArray,
        );

        const exchangeInstance = await this._getExchangeContractAsync(exchangeContractAddresses[0]);
        const gas = await exchangeInstance.fillOrdersUpTo.estimateGas(
            orderAddressesArray,
            orderValuesArray,
            fillTakerTokenAmount,
            shouldThrowOnInsufficientBalanceOrAllowance,
            vArray,
            rArray,
            sArray,
            {
                from: takerAddress,
            },
        );
        const response: ContractResponse = await exchangeInstance.fillOrdersUpTo(
            orderAddressesArray,
            orderValuesArray,
            fillTakerTokenAmount,
            shouldThrowOnInsufficientBalanceOrAllowance,
            vArray,
            rArray,
            sArray,
            {
                from: takerAddress,
                gas,
            },
        );
        this._throwErrorLogsAsErrors(response.logs);
        let filledTakerTokenAmount = new BigNumber(0);
        _.each(response.logs, log => {
            filledTakerTokenAmount = filledTakerTokenAmount.plus(
                (log.args as LogFillContractEventArgs).filledTakerTokenAmount);
        });
        return filledTakerTokenAmount;
    }
    /**
     * Batch version of fillOrderAsync.
     * Executes multiple fills atomically in a single transaction.
     * If shouldCheckTransfer is set to true, it will continue filling subsequent orders even when earlier ones fail.
     * When shouldCheckTransfer is set to false, if any fill fails, the entire batch fails.
     * @param   orderFillRequests                               An array of objects that conform to the
     *                                                          OrderFillRequest interface.
     * @param   shouldThrowOnInsufficientBalanceOrAllowance     Whether or not you wish for the contract call to throw
     *                                                          if upon execution any of the tokens cannot be
     *                                                          transferred. If set to false, the call will continue to
     *                                                          fill subsequent signedOrders even when some
     *                                                          cannot be filled.
     * @param   takerAddress                                    The user Ethereum address who would like to fill
     *                                                          these orders. Must be available via the supplied
     *                                                          Web3.Provider passed to 0x.js.
     */
    @decorators.contractCallErrorHandler
    public async batchFillOrdersAsync(orderFillRequests: OrderFillRequest[],
                                      shouldThrowOnInsufficientBalanceOrAllowance: boolean,
                                      takerAddress: string): Promise<void> {
        assert.doesConformToSchema('orderFillRequests', orderFillRequests, orderFillRequestsSchema);
        const exchangeContractAddresses = _.map(
            orderFillRequests,
            orderFillRequest => orderFillRequest.signedOrder.exchangeContractAddress,
        );
        assert.hasAtMostOneUniqueValue(exchangeContractAddresses,
                                       ExchangeContractErrs.BATCH_ORDERS_MUST_HAVE_SAME_EXCHANGE_ADDRESS);
        assert.isBoolean('shouldThrowOnInsufficientBalanceOrAllowance', shouldThrowOnInsufficientBalanceOrAllowance);
        await assert.isSenderAddressAsync('takerAddress', takerAddress, this._web3Wrapper);
        for (const orderFillRequest of orderFillRequests) {
            await this._validateFillOrderAndThrowIfInvalidAsync(
                orderFillRequest.signedOrder, orderFillRequest.takerTokenFillAmount, takerAddress);
        }
        if (_.isEmpty(orderFillRequests)) {
            return; // no-op
        }

        const orderAddressesValuesAmountsAndSignatureArray = _.map(orderFillRequests, orderFillRequest => {
            return [
                ...ExchangeWrapper._getOrderAddressesAndValues(orderFillRequest.signedOrder),
                orderFillRequest.takerTokenFillAmount,
                orderFillRequest.signedOrder.ecSignature.v,
                orderFillRequest.signedOrder.ecSignature.r,
                orderFillRequest.signedOrder.ecSignature.s,
            ];
        });
        // We use _.unzip<any> because _.unzip doesn't type check if values have different types :'(
        const [orderAddressesArray, orderValuesArray, fillTakerTokenAmounts, vArray, rArray, sArray] = _.unzip<any>(
            orderAddressesValuesAmountsAndSignatureArray,
        );

        const exchangeInstance = await this._getExchangeContractAsync(exchangeContractAddresses[0]);
        const gas = await exchangeInstance.batchFillOrders.estimateGas(
            orderAddressesArray,
            orderValuesArray,
            fillTakerTokenAmounts,
            shouldThrowOnInsufficientBalanceOrAllowance,
            vArray,
            rArray,
            sArray,
            {
                from: takerAddress,
            },
        );
        const response: ContractResponse = await exchangeInstance.batchFillOrders(
            orderAddressesArray,
            orderValuesArray,
            fillTakerTokenAmounts,
            shouldThrowOnInsufficientBalanceOrAllowance,
            vArray,
            rArray,
            sArray,
            {
                from: takerAddress,
                gas,
            },
        );
        this._throwErrorLogsAsErrors(response.logs);
    }
    /**
     * Attempts to fill a specific amount of an order. If the entire amount specified cannot be filled,
     * the fill order is abandoned.
     * @param   signedOrder             An object that conforms to the SignedOrder interface. The
     *                                  signedOrder you wish to fill.
     * @param   fillTakerTokenAmount    The total amount of the takerTokens you would like to fill.
     * @param   takerAddress            The user Ethereum address who would like to fill this order.
     *                                  Must be available via the supplied Web3.Provider passed to 0x.js.
     */
    @decorators.contractCallErrorHandler
    public async fillOrKillOrderAsync(signedOrder: SignedOrder, fillTakerTokenAmount: BigNumber.BigNumber,
                                      takerAddress: string): Promise<void> {
        assert.doesConformToSchema('signedOrder', signedOrder, signedOrderSchema);
        assert.isBigNumber('fillTakerTokenAmount', fillTakerTokenAmount);
        await assert.isSenderAddressAsync('takerAddress', takerAddress, this._web3Wrapper);

        const exchangeInstance = await this._getExchangeContractAsync(signedOrder.exchangeContractAddress);
        await this._validateFillOrderAndThrowIfInvalidAsync(signedOrder, fillTakerTokenAmount, takerAddress);

        await this._validateFillOrKillOrderAndThrowIfInvalidAsync(signedOrder, exchangeInstance.address,
                                                                 fillTakerTokenAmount);

        const [orderAddresses, orderValues] = ExchangeWrapper._getOrderAddressesAndValues(signedOrder);

        const gas = await exchangeInstance.fillOrKillOrder.estimateGas(
            orderAddresses,
            orderValues,
            fillTakerTokenAmount,
            signedOrder.ecSignature.v,
            signedOrder.ecSignature.r,
            signedOrder.ecSignature.s,
            {
                from: takerAddress,
            },
        );
        const response: ContractResponse = await exchangeInstance.fillOrKillOrder(
            orderAddresses,
            orderValues,
            fillTakerTokenAmount,
            signedOrder.ecSignature.v,
            signedOrder.ecSignature.r,
            signedOrder.ecSignature.s,
            {
                from: takerAddress,
                gas,
            },
        );
        this._throwErrorLogsAsErrors(response.logs);
    }
    /**
     * Batch version of fillOrKill. Allows a taker to specify a batch of orders that will either be atomically
     * filled (each to the specified fillAmount) or aborted.
     * @param   orderFillOrKillRequests     An array of objects that conform to the OrderFillOrKillRequest interface.
     * @param   takerAddress                The user Ethereum address who would like to fill there orders.
     *                                      Must be available via the supplied Web3.Provider passed to 0x.js.
     */
    @decorators.contractCallErrorHandler
    public async batchFillOrKillAsync(orderFillOrKillRequests: OrderFillOrKillRequest[],
                                      takerAddress: string): Promise<void> {
        assert.doesConformToSchema('orderFillOrKillRequests', orderFillOrKillRequests, orderFillOrKillRequestsSchema);
        const exchangeContractAddresses = _.map(
            orderFillOrKillRequests,
            orderFillOrKillRequest => orderFillOrKillRequest.signedOrder.exchangeContractAddress,
        );
        assert.hasAtMostOneUniqueValue(exchangeContractAddresses,
                                       ExchangeContractErrs.BATCH_ORDERS_MUST_HAVE_SAME_EXCHANGE_ADDRESS);
        await assert.isSenderAddressAsync('takerAddress', takerAddress, this._web3Wrapper);
        if (_.isEmpty(orderFillOrKillRequests)) {
            return; // no-op
        }
        const exchangeInstance = await this._getExchangeContractAsync(exchangeContractAddresses[0]);
        for (const request of orderFillOrKillRequests) {
            await this._validateFillOrKillOrderAndThrowIfInvalidAsync(request.signedOrder, exchangeInstance.address,
                                                                     request.fillTakerAmount);
        }

        const orderAddressesValuesAndTakerTokenFillAmounts = _.map(orderFillOrKillRequests, request => {
            return [
                ...ExchangeWrapper._getOrderAddressesAndValues(request.signedOrder),
                request.fillTakerAmount,
                request.signedOrder.ecSignature.v,
                request.signedOrder.ecSignature.r,
                request.signedOrder.ecSignature.s,
            ];
        });

        // We use _.unzip<any> because _.unzip doesn't type check if values have different types :'(
        const [orderAddresses, orderValues, fillTakerTokenAmounts, vParams, rParams, sParams] =
              _.unzip<any>(orderAddressesValuesAndTakerTokenFillAmounts);

        const gas = await exchangeInstance.batchFillOrKillOrders.estimateGas(
            orderAddresses,
            orderValues,
            fillTakerTokenAmounts,
            vParams,
            rParams,
            sParams,
            {
                from: takerAddress,
            },
        );
        const response: ContractResponse = await exchangeInstance.batchFillOrKillOrders(
            orderAddresses,
            orderValues,
            fillTakerTokenAmounts,
            vParams,
            rParams,
            sParams,
            {
                from: takerAddress,
                gas,
            },
        );
        this._throwErrorLogsAsErrors(response.logs);
    }
    /**
     * Cancel a given fill amount of an order. Cancellations are cumulative.
     * @param   order                   An object that conforms to the Order or SignedOrder interface.
     *                                  The order you would like to cancel.
     * @param   takerTokenCancelAmount  The amount (specified in taker tokens) that you would like to cancel.
     * @return                          The amount of the order that was cancelled (in taker token baseUnits).
     */
    @decorators.contractCallErrorHandler
    public async cancelOrderAsync(
        order: Order|SignedOrder, canceltakerTokenAmount: BigNumber.BigNumber): Promise<BigNumber.BigNumber> {
        assert.doesConformToSchema('order', order, orderSchema);
        assert.isBigNumber('takerTokenCancelAmount', canceltakerTokenAmount);
        await assert.isSenderAddressAsync('order.maker', order.maker, this._web3Wrapper);

        const exchangeInstance = await this._getExchangeContractAsync(order.exchangeContractAddress);
        await this._validateCancelOrderAndThrowIfInvalidAsync(order, canceltakerTokenAmount);

        const [orderAddresses, orderValues] = ExchangeWrapper._getOrderAddressesAndValues(order);
        const gas = await exchangeInstance.cancelOrder.estimateGas(
            orderAddresses,
            orderValues,
            canceltakerTokenAmount,
            {
                from: order.maker,
            },
        );
        const response: ContractResponse = await exchangeInstance.cancelOrder(
            orderAddresses,
            orderValues,
            canceltakerTokenAmount,
            {
                from: order.maker,
                gas,
            },
        );
        this._throwErrorLogsAsErrors(response.logs);
        const logFillArgs = response.logs[0].args as LogCancelContractEventArgs;
        const cancelledTakerTokenAmount = new BigNumber(logFillArgs.cancelledTakerTokenAmount);
        return cancelledTakerTokenAmount;
    }
    /**
     * Batch version of cancelOrderAsync. Atomically cancels multiple orders in a single transaction.
     * All orders must be from the same maker.
     * @param   orderCancellationRequests   An array of objects that conform to the OrderCancellationRequest
     *                                      interface.
     */
    @decorators.contractCallErrorHandler
    public async batchCancelOrdersAsync(orderCancellationRequests: OrderCancellationRequest[]): Promise<void> {
        assert.doesConformToSchema('orderCancellationRequests', orderCancellationRequests,
                                   orderCancellationRequestsSchema);
        const exchangeContractAddresses = _.map(
            orderCancellationRequests,
            orderCancellationRequest => orderCancellationRequest.order.exchangeContractAddress,
        );
        assert.hasAtMostOneUniqueValue(exchangeContractAddresses,
                                       ExchangeContractErrs.BATCH_ORDERS_MUST_HAVE_SAME_EXCHANGE_ADDRESS);
        const makers = _.map(orderCancellationRequests, cancellationRequest => cancellationRequest.order.maker);
        assert.hasAtMostOneUniqueValue(makers, ExchangeContractErrs.MULTIPLE_MAKERS_IN_SINGLE_CANCEL_BATCH_DISALLOWED);
        const maker = makers[0];
        await assert.isSenderAddressAsync('maker', maker, this._web3Wrapper);
        for (const cancellationRequest of orderCancellationRequests) {
            await this._validateCancelOrderAndThrowIfInvalidAsync(
                cancellationRequest.order, cancellationRequest.takerTokenCancelAmount,
            );
        }
        if (_.isEmpty(orderCancellationRequests)) {
            return; // no-op
        }
        const exchangeInstance = await this._getExchangeContractAsync(exchangeContractAddresses[0]);
        const orderAddressesValuesAndTakerTokenCancelAmounts = _.map(orderCancellationRequests, cancellationRequest => {
            return [
                ...ExchangeWrapper._getOrderAddressesAndValues(cancellationRequest.order),
                cancellationRequest.takerTokenCancelAmount,
            ];
        });
        // We use _.unzip<any> because _.unzip doesn't type check if values have different types :'(
        const [orderAddresses, orderValues, cancelTakerTokenAmounts] =
            _.unzip<any>(orderAddressesValuesAndTakerTokenCancelAmounts);
        const gas = await exchangeInstance.batchCancelOrders.estimateGas(
            orderAddresses,
            orderValues,
            cancelTakerTokenAmounts,
            {
                from: maker,
            },
        );
        const response: ContractResponse = await exchangeInstance.batchCancelOrders(
            orderAddresses,
            orderValues,
            cancelTakerTokenAmounts,
            {
                from: maker,
                gas,
            },
        );
        this._throwErrorLogsAsErrors(response.logs);
    }
    /**
     * Subscribe to an event type emitted by the Exchange smart contract
     * @param   eventName               The exchange contract event you would like to subscribe to.
     * @param   subscriptionOpts        Subscriptions options that let you configure the subscription.
     * @param   indexFilterValues       An object where the keys are indexed args returned by the event and
     *                                  the value is the value you are interested in. E.g `{maker: aUserAddressHex}`
     * @param   exchangeContractAddress The hex encoded address of the Exchange contract to call.
     * @return                      ContractEventEmitter object
     */
    public async subscribeAsync(eventName: ExchangeEvents, subscriptionOpts: SubscriptionOpts,
                                indexFilterValues: IndexedFilterValues, exchangeContractAddress: string):
                                Promise<ContractEventEmitter> {
        assert.isETHAddressHex('exchangeContractAddress', exchangeContractAddress);
        assert.doesBelongToStringEnum('eventName', eventName, ExchangeEvents);
        assert.doesConformToSchema('subscriptionOpts', subscriptionOpts, subscriptionOptsSchema);
        assert.doesConformToSchema('indexFilterValues', indexFilterValues, indexFilterValuesSchema);
        const exchangeContract = await this._getExchangeContractAsync(exchangeContractAddress);
        let createLogEvent: CreateContractEvent;
        switch (eventName) {
            case ExchangeEvents.LogFill:
                createLogEvent = exchangeContract.LogFill;
                break;
            case ExchangeEvents.LogError:
                createLogEvent = exchangeContract.LogError;
                break;
            case ExchangeEvents.LogCancel:
                createLogEvent = exchangeContract.LogCancel;
                break;
            default:
                throw utils.spawnSwitchErr('ExchangeEvents', eventName);
        }

        const logEventObj: ContractEventObj = createLogEvent(indexFilterValues, subscriptionOpts);
        const eventEmitter = eventUtils.wrapEventEmitter(logEventObj);
        this._exchangeLogEventEmitters.push(eventEmitter);
        return eventEmitter;
    }
    /**
     * Stops watching for all exchange events
     */
    public async stopWatchingAllEventsAsync(): Promise<void> {
        const stopWatchingPromises = _.map(this._exchangeLogEventEmitters,
                                           logEventObj => logEventObj.stopWatchingAsync());
        await Promise.all(stopWatchingPromises);
        this._exchangeLogEventEmitters = [];
    }
    private async _invalidateContractInstancesAsync(): Promise<void> {
        await this.stopWatchingAllEventsAsync();
        this._exchangeContractByAddress = {};
    }
    private async _isValidSignatureUsingContractCallAsync(dataHex: string, ecSignature: ECSignature,
                                                          signerAddressHex: string,
                                                          exchangeContractAddress: string): Promise<boolean> {
        assert.isHexString('dataHex', dataHex);
        assert.doesConformToSchema('ecSignature', ecSignature, ecSignatureSchema);
        assert.isETHAddressHex('signerAddressHex', signerAddressHex);

        const exchangeInstance = await this._getExchangeContractAsync(exchangeContractAddress);

        const isValidSignature = await exchangeInstance.isValidSignature.call(
            signerAddressHex,
            dataHex,
            ecSignature.v,
            ecSignature.r,
            ecSignature.s,
        );
        return isValidSignature;
    }
    private async _getOrderHashHexUsingContractCallAsync(order: Order|SignedOrder): Promise<string> {
        const exchangeInstance = await this._getExchangeContractAsync(order.exchangeContractAddress);
        const [orderAddresses, orderValues] = ExchangeWrapper._getOrderAddressesAndValues(order);
        const orderHashHex = await exchangeInstance.getOrderHash.call(orderAddresses, orderValues);
        return orderHashHex;
    }
    private async _validateFillOrderAndThrowIfInvalidAsync(signedOrder: SignedOrder,
                                                           fillTakerAmount: BigNumber.BigNumber,
                                                           senderAddress: string): Promise<void> {
        if (fillTakerAmount.eq(0)) {
            throw new Error(ExchangeContractErrs.ORDER_REMAINING_FILL_AMOUNT_ZERO);
        }
        if (signedOrder.taker !== constants.NULL_ADDRESS && signedOrder.taker !== senderAddress) {
            throw new Error(ExchangeContractErrs.TRANSACTION_SENDER_IS_NOT_FILL_ORDER_TAKER);
        }
        const currentUnixTimestampSec = utils.getCurrentUnixTimestamp();
        if (signedOrder.expirationUnixTimestampSec.lessThan(currentUnixTimestampSec)) {
            throw new Error(ExchangeContractErrs.ORDER_FILL_EXPIRED);
        }
        const zrxTokenAddress = await this._getZRXTokenAddressAsync(signedOrder.exchangeContractAddress);
        await this._validateFillOrderBalancesAndAllowancesAndThrowIfInvalidAsync(signedOrder, fillTakerAmount,
                                                               senderAddress, zrxTokenAddress);

        const wouldRoundingErrorOccur = await this._isRoundingErrorAsync(
            signedOrder.takerTokenAmount, fillTakerAmount, signedOrder.makerTokenAmount,
            signedOrder.exchangeContractAddress,
        );
        if (wouldRoundingErrorOccur) {
            throw new Error(ExchangeContractErrs.ORDER_FILL_ROUNDING_ERROR);
        }
    }
    private async _validateCancelOrderAndThrowIfInvalidAsync(
        order: Order, takerTokenCancelAmount: BigNumber.BigNumber): Promise<void> {
        if (takerTokenCancelAmount.eq(0)) {
            throw new Error(ExchangeContractErrs.ORDER_CANCEL_AMOUNT_ZERO);
        }
        const orderHash = utils.getOrderHashHex(order);
        const unavailableAmount = await this.getUnavailableTakerAmountAsync(orderHash, order.exchangeContractAddress);
        if (order.takerTokenAmount.minus(unavailableAmount).eq(0)) {
            throw new Error(ExchangeContractErrs.ORDER_ALREADY_CANCELLED_OR_FILLED);
        }
        const currentUnixTimestampSec = utils.getCurrentUnixTimestamp();
        if (order.expirationUnixTimestampSec.lessThan(currentUnixTimestampSec)) {
            throw new Error(ExchangeContractErrs.ORDER_CANCEL_EXPIRED);
        }
    }
    private async _validateFillOrKillOrderAndThrowIfInvalidAsync(signedOrder: SignedOrder,
                                                                 exchangeContractAddress: string,
                                                                 fillTakerAmount: BigNumber.BigNumber) {
        // Check that fillValue available >= fillTakerAmount
        const orderHashHex = utils.getOrderHashHex(signedOrder);
        const unavailableTakerAmount = await this.getUnavailableTakerAmountAsync(orderHashHex, exchangeContractAddress);
        const remainingTakerAmount = signedOrder.takerTokenAmount.minus(unavailableTakerAmount);
        if (remainingTakerAmount < fillTakerAmount) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_REMAINING_FILL_AMOUNT);
        }
    }
    /**
     * This method does not currently validate the edge-case where the makerToken or takerToken is also the token used
     * to pay fees  (ZRX). It is possible for them to have enough for fees and the transfer but not both.
     * Handling the edge-cases that arise when this happens would require making sure that the user has sufficient
     * funds to pay both the fees and the transfer amount. We decided to punt on this for now as the contracts
     * will throw for these edge-cases.
     * TODO: Throw errors before calling the smart contract for these edge-cases in order to minimize
     * the callers gas costs.
     */
    private async _validateFillOrderBalancesAndAllowancesAndThrowIfInvalidAsync(signedOrder: SignedOrder,
                                                                                fillTakerAmount: BigNumber.BigNumber,
                                                                                senderAddress: string,
                                                                                zrxTokenAddress: string,
    ): Promise<void> {

        const makerBalance = await this._tokenWrapper.getBalanceAsync(signedOrder.makerTokenAddress,
                                                                     signedOrder.maker);
        const takerBalance = await this._tokenWrapper.getBalanceAsync(signedOrder.takerTokenAddress, senderAddress);
        const makerAllowance = await this._tokenWrapper.getProxyAllowanceAsync(signedOrder.makerTokenAddress,
                                                                              signedOrder.maker);
        const takerAllowance = await this._tokenWrapper.getProxyAllowanceAsync(signedOrder.takerTokenAddress,
                                                                              senderAddress);

        // exchangeRate is the price of one maker token denominated in taker tokens
        const exchangeRate = signedOrder.takerTokenAmount.div(signedOrder.makerTokenAmount);
        const fillMakerAmountInBaseUnits = fillTakerAmount.div(exchangeRate);

        if (fillTakerAmount.greaterThan(takerBalance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_TAKER_BALANCE);
        }
        if (fillTakerAmount.greaterThan(takerAllowance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_TAKER_ALLOWANCE);
        }
        if (fillMakerAmountInBaseUnits.greaterThan(makerBalance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_MAKER_BALANCE);
        }
        if (fillMakerAmountInBaseUnits.greaterThan(makerAllowance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_MAKER_ALLOWANCE);
        }

        const makerFeeBalance = await this._tokenWrapper.getBalanceAsync(zrxTokenAddress,
                                                                        signedOrder.maker);
        const takerFeeBalance = await this._tokenWrapper.getBalanceAsync(zrxTokenAddress, senderAddress);
        const makerFeeAllowance = await this._tokenWrapper.getProxyAllowanceAsync(zrxTokenAddress,
                                                                                 signedOrder.maker);
        const takerFeeAllowance = await this._tokenWrapper.getProxyAllowanceAsync(zrxTokenAddress,
                                                                                 senderAddress);

        if (signedOrder.takerFee.greaterThan(takerFeeBalance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_TAKER_FEE_BALANCE);
        }
        if (signedOrder.takerFee.greaterThan(takerFeeAllowance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_TAKER_FEE_ALLOWANCE);
        }
        if (signedOrder.makerFee.greaterThan(makerFeeBalance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_MAKER_FEE_BALANCE);
        }
        if (signedOrder.makerFee.greaterThan(makerFeeAllowance)) {
            throw new Error(ExchangeContractErrs.INSUFFICIENT_MAKER_FEE_ALLOWANCE);
        }
    }
    private _throwErrorLogsAsErrors(logs: ContractEvent[]): void {
        const errEvent = _.find(logs, {event: 'LogError'});
        if (!_.isUndefined(errEvent)) {
            const errCode = (errEvent.args as LogErrorContractEventArgs).errorId.toNumber();
            const errMessage = this._exchangeContractErrCodesToMsg[errCode];
            throw new Error(errMessage);
        }
    }
    private async _isRoundingErrorAsync(numerator: BigNumber.BigNumber,
                                        demoninator: BigNumber.BigNumber,
                                        makerTokenAmount: BigNumber.BigNumber,
                                        exchangeContractAddress: string): Promise<boolean> {
        await assert.isUserAddressAvailableAsync(this._web3Wrapper);
        const exchangeInstance = await this._getExchangeContractAsync(exchangeContractAddress);
        const isRoundingError = await exchangeInstance.isRoundingError.call(
            demoninator, numerator, makerTokenAmount,
        );
        return isRoundingError;
    }
    private async _getExchangeContractAsync(exchangeContractAddress: string): Promise<ExchangeContract> {
        if (!_.isUndefined(this._exchangeContractByAddress[exchangeContractAddress])) {
            return this._exchangeContractByAddress[exchangeContractAddress];
        }
        const ExchangeArtifacts = this._getExchangeArtifactsByAddressOrThrow(exchangeContractAddress);
        const contractInstance = await this._instantiateContractIfExistsAsync((ExchangeArtifacts as any));
        this._exchangeContractByAddress[exchangeContractAddress] = contractInstance as ExchangeContract;
        return this._exchangeContractByAddress[exchangeContractAddress];
    }
    private _getExchangeArtifactsByAddressOrThrow(exchangeContractAddress: string): ContractArtifact {
        const exchangeArtifacts = _.values<ContractArtifact>(ExchangeArtifactsByName);
        for (const exchangeArtifact of exchangeArtifacts) {
            const networkSpecificExchangeArtifactValues = _.values(exchangeArtifact.networks);
            const exchangeAddressesInArtifact = _.map(
                networkSpecificExchangeArtifactValues,
                networkSpecificExchangeArtifact => networkSpecificExchangeArtifact.address,
            );
            if (_.includes(exchangeAddressesInArtifact, exchangeContractAddress)) {
                return exchangeArtifact;
            }
        }
        throw new Error(ZeroExError.EXCHANGE_CONTRACT_DOES_NOT_EXIST);
    }
    private async _getZRXTokenAddressAsync(exchangeContractAddress: string): Promise<string> {
        const exchangeInstance = await this._getExchangeContractAsync(exchangeContractAddress);
        const ZRXtokenAddress = await exchangeInstance.ZRX_TOKEN_CONTRACT.call();
        return ZRXtokenAddress;
    }
}
