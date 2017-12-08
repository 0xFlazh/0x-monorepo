import {promisify} from '@0xproject/utils';
import * as _ from 'lodash';
import RpcSubprovider = require('web3-provider-engine/subproviders/rpc');

import {JSONRPCPayload} from '../types';

import {Subprovider} from './subprovider';

export class RedundantRPCSubprovider extends Subprovider {
    private rpcs: RpcSubprovider[];
    private static async firstSuccessAsync(
        rpcs: RpcSubprovider[], payload: JSONRPCPayload, next: () => void,
    ): Promise<any> {
        let lastErr: Error|undefined;
        for (const rpc of rpcs) {
            try {
                const data = await promisify(rpc.handleRequest.bind(rpc))(payload, next);
                return data;
            } catch (err) {
                lastErr = err;
                continue;
            }
        }
        if (!_.isUndefined(lastErr)) {
            throw lastErr;
        }
    }
    constructor(endpoints: string[]) {
        super();
        this.rpcs = _.map(endpoints, endpoint => {
            return new RpcSubprovider({
                rpcUrl: endpoint,
            });
        });
    }
    public async handleRequest(payload: JSONRPCPayload, next: () => void,
                               end: (err: Error|null, data?: any) =>  void): Promise<void> {
        const rpcsCopy = this.rpcs.slice();
        try {
            const data = await RedundantRPCSubprovider.firstSuccessAsync(rpcsCopy, payload, next);
            end(null, data);
        } catch (err) {
            end(err);
        }

    }
}
