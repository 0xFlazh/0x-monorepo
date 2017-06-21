import find = require('lodash/find');
import filter = require('lodash/filter');
import isUndefined = require('lodash/isUndefined');
import {Token, ZeroExError} from '../../src';

const PROTOCOL_TOKEN_SYMBOL = 'ZRX';

export class TokenUtils {
    private tokens: Token[];
    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }
    public getProtocolTokenOrThrow(): Token {
        const zrxToken = find(this.tokens, {symbol: PROTOCOL_TOKEN_SYMBOL});
        if (isUndefined(zrxToken)) {
            throw new Error(ZeroExError.ZRX_NOT_IN_TOKEN_REGISTRY);
        }
        return zrxToken;
    }
    public getNonProtocolTokens(): Token[] {
        const nonProtocolTokens = filter(this.tokens, token => {
            return token.symbol !== PROTOCOL_TOKEN_SYMBOL;
        });
        return nonProtocolTokens;
    }
}
