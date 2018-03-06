import { SignedOrder, ZeroEx } from '0x.js';
import { HttpClient } from '@0xproject/connect';
import { Schema, schemas as schemasByName } from '@0xproject/json-schemas';
import * as _ from 'lodash';

import { addresses as kovanAddresses } from './contract_addresses/kovan_addresses';
import { addresses as mainnetAddresses } from './contract_addresses/mainnet_addresses';

interface EnvironmentValue {
    key: string;
}

export const postmanEnvironmentFactory = {
    /**
     * Dynamically generates a postman environment (https://www.getpostman.com/docs/v6/postman/environments_and_globals/manage_environments)
     * When running the postman collection via newman, we provide it a set of environment variables
     * These variables include:
     *  - 0x JSON schemas for response body validation
     *  - Contract addresses based on the network id for making specific queries (ex. baseTokenAddress=ZRX_address)
     *  - Order properties for making specific queries (ex. maker=orderMaker)
     */
    async createPostmanEnvironmentAsync(url: string, networkId: number) {
        const schemas: Schema[] = _.values(schemasByName);
        const schemaEnvironmentValues = _.compact(
            _.map(schemas, (schema: Schema) => {
                if (_.isUndefined(schema.id)) {
                    return undefined;
                } else {
                    const schemaKey = convertSchemaIdToKey(schema.id);
                    const stringifiedSchema = JSON.stringify(schema);
                    const schemaEnvironmentValue = createEnvironmentValue(schemaKey, stringifiedSchema);
                    return schemaEnvironmentValue;
                }
            }),
        );
        const schemaKeys = _.map(schemaEnvironmentValues, (environmentValue: EnvironmentValue) => {
            return environmentValue.key;
        });
        const contractAddresses = getContractAddresses(networkId);
        const contractAddressEnvironmentValues = _.map(_.keys(contractAddresses), (key: string) => {
            const contractAddress = _.get(contractAddresses, key);
            return createEnvironmentValue(key, contractAddress);
        });
        const httpClient = new HttpClient(url);
        const orders = await httpClient.getOrdersAsync();
        const firstOrder = _.head(orders);
        if (_.isUndefined(firstOrder)) {
            throw new Error('Could not get any orders from /orders endpoint');
        }
        const allEnvironmentValues = _.concat(
            schemaEnvironmentValues,
            contractAddressEnvironmentValues,
            createEnvironmentValue('schemaKeys', JSON.stringify(schemaKeys)),
            createEnvironmentValue('url', url),
            createEnvironmentValue('order', JSON.stringify(firstOrder)),
            createEnvironmentValue('orderMaker', firstOrder.maker),
            createEnvironmentValue('orderTaker', firstOrder.taker),
            createEnvironmentValue('orderFeeRecipient', firstOrder.feeRecipient),
            createEnvironmentValue('orderHash', ZeroEx.getOrderHashHex(firstOrder)),
        );
        const environment = {
            values: allEnvironmentValues,
        };
        return environment;
    },
};
function getContractAddresses(networkId: number) {
    switch (networkId) {
        case 1:
            return mainnetAddresses;
        case 42:
            return kovanAddresses;
        default:
            throw new Error('Unsupported network id');
    }
}
function convertSchemaIdToKey(schemaId: string) {
    let result = schemaId;
    if (_.startsWith(result, '/')) {
        result = result.substr(1);
    }
    result = `${result}Schema`;
    return result;
}
function createEnvironmentValue(key: string, value: string) {
    return {
        key,
        value,
        enabled: true,
        type: 'text',
    };
}
