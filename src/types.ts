import * as _ from 'lodash';
import * as Web3 from 'web3';

export enum ZeroExError {
    CONTRACT_DOES_NOT_EXIST = 'CONTRACT_DOES_NOT_EXIST',
    EXCHANGE_CONTRACT_DOES_NOT_EXIST = 'EXCHANGE_CONTRACT_DOES_NOT_EXIST',
    UNHANDLED_ERROR = 'UNHANDLED_ERROR',
    USER_HAS_NO_ASSOCIATED_ADDRESSES = 'USER_HAS_NO_ASSOCIATED_ADDRESSES',
    INVALID_SIGNATURE = 'INVALID_SIGNATURE',
    CONTRACT_NOT_DEPLOYED_ON_NETWORK = 'CONTRACT_NOT_DEPLOYED_ON_NETWORK',
    ZRX_NOT_IN_TOKEN_REGISTRY = 'ZRX_NOT_IN_TOKEN_REGISTRY',
    INSUFFICIENT_ALLOWANCE_FOR_TRANSFER = 'INSUFFICIENT_ALLOWANCE_FOR_TRANSFER',
    INSUFFICIENT_BALANCE_FOR_TRANSFER = 'INSUFFICIENT_BALANCE_FOR_TRANSFER',
    INSUFFICIENT_ETH_BALANCE_FOR_DEPOSIT = 'INSUFFICIENT_ETH_BALANCE_FOR_DEPOSIT',
    INSUFFICIENT_WETH_BALANCE_FOR_WITHDRAWAL = 'INSUFFICIENT_WETH_BALANCE_FOR_WITHDRAWAL',
    INVALID_JUMP = 'INVALID_JUMP',
    OUT_OF_GAS = 'OUT_OF_GAS',
}

/**
 * Elliptic Curve signature
 */
export interface ECSignature {
    v: number;
    r: string;
    s: string;
}

export type OrderAddresses = [string, string, string, string, string];

export type OrderValues = [BigNumber.BigNumber, BigNumber.BigNumber, BigNumber.BigNumber,
                           BigNumber.BigNumber, BigNumber.BigNumber, BigNumber.BigNumber];

export type EventCallbackAsync = (err: Error, event: ContractEvent) => Promise<void>;
export type EventCallbackSync = (err: Error, event: ContractEvent) => void;
export type EventCallback = EventCallbackSync|EventCallbackAsync;
export interface ContractEventObj {
    watch: (eventWatch: EventCallback) => void;
    stopWatching: () => void;
}
export type CreateContractEvent = (indexFilterValues: IndexedFilterValues,
                                   subscriptionOpts: SubscriptionOpts) => ContractEventObj;
export interface ExchangeContract extends ContractInstance {
    isValidSignature: {
        call: (signerAddressHex: string, dataHex: string, v: number, r: string, s: string,
               txOpts?: TxOpts) => Promise<boolean>;
    };
    LogFill: CreateContractEvent;
    LogCancel: CreateContractEvent;
    LogError: CreateContractEvent;
    ZRX_TOKEN_CONTRACT: {
        call: () => Promise<string>;
    };
    getUnavailableTakerTokenAmount: {
        call: (orderHash: string) => BigNumber.BigNumber;
    };
    isRoundingError: {
        call: (takerTokenAmount: BigNumber.BigNumber, fillTakerAmount: BigNumber.BigNumber,
               makerTokenAmount: BigNumber.BigNumber, txOpts?: TxOpts) => Promise<boolean>;
    };
    fillOrder: {
        (orderAddresses: OrderAddresses, orderValues: OrderValues, fillTakerTokenAmount: BigNumber.BigNumber,
         shouldThrowOnInsufficientBalanceOrAllowance: boolean,
         v: number, r: string, s: string, txOpts?: TxOpts): ContractResponse;
        estimateGas: (orderAddresses: OrderAddresses, orderValues: OrderValues,
                      fillTakerTokenAmount: BigNumber.BigNumber,
                      shouldThrowOnInsufficientBalanceOrAllowance: boolean,
                      v: number, r: string, s: string, txOpts?: TxOpts) => number;
    };
    batchFillOrders: {
        (orderAddresses: OrderAddresses[], orderValues: OrderValues[], fillTakerTokenAmounts: BigNumber.BigNumber[],
         shouldThrowOnInsufficientBalanceOrAllowance: boolean,
         v: number[], r: string[], s: string[], txOpts?: TxOpts): ContractResponse;
        estimateGas: (orderAddresses: OrderAddresses[], orderValues: OrderValues[],
                      fillTakerTokenAmounts: BigNumber.BigNumber[],
                      shouldThrowOnInsufficientBalanceOrAllowance: boolean,
                      v: number[], r: string[], s: string[], txOpts?: TxOpts) => number;
    };
    fillOrdersUpTo: {
        (orderAddresses: OrderAddresses[], orderValues: OrderValues[], fillTakerTokenAmount: BigNumber.BigNumber,
         shouldThrowOnInsufficientBalanceOrAllowance: boolean,
         v: number[], r: string[], s: string[], txOpts?: TxOpts): ContractResponse;
        estimateGas: (orderAddresses: OrderAddresses[], orderValues: OrderValues[],
                      fillTakerTokenAmount: BigNumber.BigNumber,
                      shouldThrowOnInsufficientBalanceOrAllowance: boolean,
                      v: number[], r: string[], s: string[], txOpts?: TxOpts) => number;
    };
    cancelOrder: {
        (orderAddresses: OrderAddresses, orderValues: OrderValues, canceltakerTokenAmount: BigNumber.BigNumber,
         txOpts?: TxOpts): ContractResponse;
        estimateGas: (orderAddresses: OrderAddresses, orderValues: OrderValues,
                      canceltakerTokenAmount: BigNumber.BigNumber,
                      txOpts?: TxOpts) => number;
    };
    batchCancelOrders: {
        (orderAddresses: OrderAddresses[], orderValues: OrderValues[], cancelTakerTokenAmounts: BigNumber.BigNumber[],
         txOpts?: TxOpts): ContractResponse;
        estimateGas: (orderAddresses: OrderAddresses[], orderValues: OrderValues[],
                      cancelTakerTokenAmounts: BigNumber.BigNumber[],
                      txOpts?: TxOpts) => number;
    };
    fillOrKillOrder: {
        (orderAddresses: OrderAddresses, orderValues: OrderValues, fillTakerTokenAmount: BigNumber.BigNumber,
         v: number, r: string, s: string, txOpts?: TxOpts): ContractResponse;
        estimateGas: (orderAddresses: OrderAddresses, orderValues: OrderValues,
                      fillTakerTokenAmount: BigNumber.BigNumber,
                      v: number, r: string, s: string, txOpts?: TxOpts) => number;
    };
    batchFillOrKillOrders: {
        (orderAddresses: OrderAddresses[], orderValues: OrderValues[], fillTakerTokenAmounts: BigNumber.BigNumber[],
         v: number[], r: string[], s: string[], txOpts: TxOpts): ContractResponse;
        estimateGas: (orderAddresses: OrderAddresses[], orderValues: OrderValues[],
                      fillTakerTokenAmounts: BigNumber.BigNumber[],
                      v: number[], r: string[], s: string[], txOpts?: TxOpts) => number;
    };
    filled: {
        call: (orderHash: string) => BigNumber.BigNumber;
    };
    cancelled: {
        call: (orderHash: string) => BigNumber.BigNumber;
    };
    getOrderHash: {
        call: (orderAddresses: OrderAddresses, orderValues: OrderValues) => string;
    };
}

export interface TokenContract extends ContractInstance {
    Transfer: CreateContractEvent;
    Approval: CreateContractEvent;
    balanceOf: {
        call: (address: string) => Promise<BigNumber.BigNumber>;
    };
    allowance: {
        call: (ownerAddress: string, allowedAddress: string) => Promise<BigNumber.BigNumber>;
    };
    transfer: (toAddress: string, amountInBaseUnits: BigNumber.BigNumber, txOpts?: TxOpts) => Promise<boolean>;
    transferFrom: (fromAddress: string, toAddress: string, amountInBaseUnits: BigNumber.BigNumber,
                   txOpts?: TxOpts) => Promise<boolean>;
    approve: (proxyAddress: string, amountInBaseUnits: BigNumber.BigNumber, txOpts?: TxOpts) => void;
}

export interface TokenRegistryContract extends ContractInstance {
    getTokenMetaData: {
        call: (address: string) => Promise<TokenMetadata>;
    };
    getTokenAddresses: {
        call: () => Promise<string[]>;
    };
}

export interface EtherTokenContract extends ContractInstance {
    deposit: (txOpts: TxOpts) => Promise<void>;
    withdraw: (amount: BigNumber.BigNumber, txOpts: TxOpts) => Promise<void>;
}

export interface ProxyContract extends ContractInstance {
    getAuthorizedAddresses: {
        call: () => Promise<string[]>;
    };
    authorized: {
        call: (address: string) => Promise<boolean>;
    };
}

export enum SolidityTypes {
    address = 'address',
    uint256 = 'uint256',
}

export enum ExchangeContractErrCodes {
    ERROR_FILL_EXPIRED, // Order has already expired
    ERROR_FILL_NO_VALUE, // Order has already been fully filled or cancelled
    ERROR_FILL_TRUNCATION, // Rounding error too large
    ERROR_FILL_BALANCE_ALLOWANCE, // Insufficient balance or allowance for token transfer
    ERROR_CANCEL_EXPIRED, // Order has already expired
    ERROR_CANCEL_NO_VALUE, // Order has already been fully filled or cancelled
}

export enum ExchangeContractErrs {
    ORDER_FILL_EXPIRED = 'ORDER_FILL_EXPIRED',
    ORDER_CANCEL_EXPIRED = 'ORDER_CANCEL_EXPIRED',
    ORDER_CANCEL_AMOUNT_ZERO = 'ORDER_CANCEL_AMOUNT_ZERO',
    ORDER_ALREADY_CANCELLED_OR_FILLED = 'ORDER_ALREADY_CANCELLED_OR_FILLED',
    ORDER_REMAINING_FILL_AMOUNT_ZERO = 'ORDER_REMAINING_FILL_AMOUNT_ZERO',
    ORDER_FILL_ROUNDING_ERROR = 'ORDER_FILL_ROUNDING_ERROR',
    FILL_BALANCE_ALLOWANCE_ERROR = 'FILL_BALANCE_ALLOWANCE_ERROR',
    INSUFFICIENT_TAKER_BALANCE = 'INSUFFICIENT_TAKER_BALANCE',
    INSUFFICIENT_TAKER_ALLOWANCE = 'INSUFFICIENT_TAKER_ALLOWANCE',
    INSUFFICIENT_MAKER_BALANCE = 'INSUFFICIENT_MAKER_BALANCE',
    INSUFFICIENT_MAKER_ALLOWANCE = 'INSUFFICIENT_MAKER_ALLOWANCE',
    INSUFFICIENT_TAKER_FEE_BALANCE = 'INSUFFICIENT_TAKER_FEE_BALANCE',
    INSUFFICIENT_TAKER_FEE_ALLOWANCE = 'INSUFFICIENT_TAKER_FEE_ALLOWANCE',
    INSUFFICIENT_MAKER_FEE_BALANCE = 'INSUFFICIENT_MAKER_FEE_BALANCE',
    INSUFFICIENT_MAKER_FEE_ALLOWANCE = 'INSUFFICIENT_MAKER_FEE_ALLOWANCE',
    TRANSACTION_SENDER_IS_NOT_FILL_ORDER_TAKER = 'TRANSACTION_SENDER_IS_NOT_FILL_ORDER_TAKER',
    MULTIPLE_MAKERS_IN_SINGLE_CANCEL_BATCH_DISALLOWED = 'MULTIPLE_MAKERS_IN_SINGLE_CANCEL_BATCH_DISALLOWED',
    INSUFFICIENT_REMAINING_FILL_AMOUNT = 'INSUFFICIENT_REMAINING_FILL_AMOUNT',
    MULTIPLE_TAKER_TOKENS_IN_FILL_UP_TO_DISALLOWED = 'MULTIPLE_TAKER_TOKENS_IN_FILL_UP_TO_DISALLOWED',
    BATCH_ORDERS_MUST_HAVE_SAME_EXCHANGE_ADDRESS = 'BATCH_ORDERS_MUST_HAVE_SAME_EXCHANGE_ADDRESS',
}

export interface ContractResponse {
    logs: ContractEvent[];
}

export interface ContractEvent {
    logIndex: number;
    transactionIndex: number;
    transactionHash: string;
    blockHash: string;
    blockNumber: number;
    address: string;
    type: string;
    event: string;
    args: ContractEventArgs;
}

export interface LogFillContractEventArgs {
    maker: string;
    taker: string;
    feeRecipient: string;
    makerToken: string;
    takerToken: string;
    filledMakerTokenAmount: BigNumber.BigNumber;
    filledTakerTokenAmount: BigNumber.BigNumber;
    paidMakerFee: BigNumber.BigNumber;
    paidTakerFee: BigNumber.BigNumber;
    tokens: string;
    orderHash: string;
}
export interface LogCancelContractEventArgs {
    maker: string;
    feeRecipient: string;
    makerToken: string;
    takerToken: string;
    cancelledMakerTokenAmount: BigNumber.BigNumber;
    cancelledTakerTokenAmount: BigNumber.BigNumber;
    tokens: string;
    orderHash: string;
}
export interface LogErrorContractEventArgs {
    errorId: BigNumber.BigNumber;
    orderHash: string;
}
export type ExchangeContractEventArgs = LogFillContractEventArgs|LogCancelContractEventArgs|LogErrorContractEventArgs;
export interface TransferContractEventArgs {
    _from: string;
    _to: string;
    _value: BigNumber.BigNumber;
}
export interface ApprovalContractEventArgs {
    _owner: string;
    _spender: string;
    _value: BigNumber.BigNumber;
}
export type TokenContractEventArgs = TransferContractEventArgs|ApprovalContractEventArgs;
export type ContractEventArgs = ExchangeContractEventArgs|TokenContractEventArgs;
export type ContractEventArg = string|BigNumber.BigNumber;

export interface Order {
    maker: string;
    taker: string;
    makerFee: BigNumber.BigNumber;
    takerFee: BigNumber.BigNumber;
    makerTokenAmount: BigNumber.BigNumber;
    takerTokenAmount: BigNumber.BigNumber;
    makerTokenAddress: string;
    takerTokenAddress: string;
    salt: BigNumber.BigNumber;
    exchangeContractAddress: string;
    feeRecipient: string;
    expirationUnixTimestampSec: BigNumber.BigNumber;
}

export interface SignedOrder extends Order {
    ecSignature: ECSignature;
}

//                          [address, name, symbol, projectUrl, decimals, ipfsHash, swarmHash]
export type TokenMetadata = [string, string, string, string, BigNumber.BigNumber, string, string];

export interface Token {
    name: string;
    address: string;
    symbol: string;
    decimals: number;
    url: string;
}

export interface TxOpts {
    from: string;
    gas?: number;
    value?: BigNumber.BigNumber;
}

export interface TokenAddressBySymbol {
    [symbol: string]: string;
}

export enum ExchangeEvents {
    LogFill = 'LogFill',
    LogCancel = 'LogCancel',
    LogError = 'LogError',
}

export enum TokenEvents {
    Transfer = 'Transfer',
    Approval = 'Approval',
}

export interface IndexedFilterValues {
    [index: string]: ContractEventArg;
}

export type BlockParam = 'latest'|'earliest'|'pending'|number;

export interface SubscriptionOpts {
    fromBlock: BlockParam;
    toBlock: BlockParam;
}

export type DoneCallback = (err?: Error) => void;

export interface OrderFillOrKillRequest {
    signedOrder: SignedOrder;
    fillTakerAmount: BigNumber.BigNumber;
}

export interface OrderCancellationRequest {
    order: Order|SignedOrder;
    takerTokenCancelAmount: BigNumber.BigNumber;
}

export interface OrderFillRequest {
    signedOrder: SignedOrder;
    takerTokenFillAmount: BigNumber.BigNumber;
}

export type AsyncMethod = (...args: any[]) => Promise<any>;

export interface ContractInstance {
    address: string;
}

export interface Artifact {
    networks: {[networkId: number]: any};
}

export interface ContractEventEmitter {
    watch: (eventCallback: EventCallback) => void;
    stopWatchingAsync: () => Promise<void>;
}

/**
 * We re-export the `Web3.Provider` type specified in the Web3 Typescript typings
 * since it is the type of the `provider` argument to the `ZeroEx` constructor.
 * It is however a `Web3` library type, not a native `0x.js` type.
 */
export type Web3Provider = Web3.Provider;

export interface ExchangeContractByAddress {
    [address: string]: ExchangeContract;
}

export interface ContractArtifact {
    networks: {
        [networkId: number]: {
            address: string;
        };
    };
}
