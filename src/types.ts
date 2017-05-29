import * as _ from 'lodash';

// Utility function to create a K:V from a list of strings
// Adapted from: https://basarat.gitbooks.io/typescript/content/docs/types/literal-types.html
function strEnum(values: string[]): {[key: string]: string} {
    return _.reduce(values, (result, key) => {
        result[key] = key;
        return result;
    }, Object.create(null));
}

export const ZeroExError = strEnum([
  'CONTRACT_DOES_NOT_EXIST',
  'UNHANDLED_ERROR',
  'USER_HAS_NO_ASSOCIATED_ADDRESSES',
  'INVALID_SIGNATURE',
]);
export type ZeroExError = keyof typeof ZeroExError;

/**
 * Elliptic Curve signature
 */
export interface ECSignature {
    v: number;
    r: string;
    s: string;
}

export type OrderAddresses = [string, string, string, string, string];

export type OrderValues = [
    BigNumber.BigNumber, BigNumber.BigNumber, BigNumber.BigNumber,
    BigNumber.BigNumber, BigNumber.BigNumber, BigNumber.BigNumber
];

export interface TxData {
    from: string;
}

export interface ExchangeContract {
    isValidSignature: any;
    fill: (
        orderAddresses: OrderAddresses, orderValues: OrderValues, fillAmount: BigNumber.BigNumber,
        shouldCheckTransfer: boolean, v: number, r: string, s: string, txData: TxData,
    ) => ContractResponse;
}

export const SolidityTypes = strEnum([
    'address',
    'uint256',
]);
export type SolidityTypes = keyof typeof SolidityTypes;

export enum ExchangeContractErrs {
    ERROR_FILL_EXPIRED, // Order has already expired
    ERROR_FILL_NO_VALUE, // Order has already been fully filled or cancelled
    ERROR_FILL_TRUNCATION, // Rounding error too large
    ERROR_FILL_BALANCE_ALLOWANCE, // Insufficient balance or allowance for token transfer
    ERROR_CANCEL_EXPIRED, // Order has already expired
    ERROR_CANCEL_NO_VALUE, // Order has already been fully filled or cancelled
};

export interface ContractResponse {
    logs: ContractEvent[];
}

export interface ContractEvent {
    event: string;
    args: any;
}
