import 'mocha';
import * as _ from 'lodash';
import * as chai from 'chai';
import * as BigNumber from 'bignumber.js';
import promisify = require('es6-promisify');
import {constants} from './utils/constants';
import {SchemaValidator} from '../src/utils/schema_validator';
import {addressSchema, numberSchema} from '../src/schemas/basic_type_schemas';

chai.config.includeStack = true;
const expect = chai.expect;

describe('Schema', () => {
    const validator = new SchemaValidator();
    const batchTestSchema = (testCases: any[], schema: any, shouldFail = false) => {
        _.forEach(testCases, (testCase: any) => {
            expect(validator.validate(testCase, schema).errors).to.be.lengthOf(shouldFail ? 1 : 0);
        });
    };
    describe('#numberSchema', () => {
        describe('number regex', () => {
            it('should validate valid numbers', () => {
                const testCases = ['42', '0', '1.3', '0.2', '00.00'];
                batchTestSchema(testCases, numberSchema);
            });
            it('should fail for invalid numbers', () => {
                const testCases = ['.3', '1.', 'abacaba', 'и', '1..0'];
                batchTestSchema(testCases, numberSchema, true);
            });
        });
    });
    describe('#addressSchema', () => {
        describe('address regex', () => {
            it('should validate valid addresses', () => {
                const testCases = ['0x8b0292B11a196601eD2ce54B665CaFEca0347D42', constants.NULL_ADDRESS];
                batchTestSchema(testCases, addressSchema);
            });
            it('should fail for invalid addresses', () => {
                const testCases = ['0x', '0', '0x00', '0xzzzzzzB11a196601eD2ce54B665CaFEca0347D42'];
                batchTestSchema(testCases, addressSchema, true);
            });
        });
    });
    describe('BigNumber serialization', () => {
        it('should correctly serialize BigNumbers', () => {
            const testCases = {
                '42': '42',
                '0': '0',
                '1.3': '1.3',
                '0.2': '0.2',
                '00.00': '0',
                '.3': '0.3',
            };
            _.forEach(testCases, (serialized: string, input: string) => {
                expect(SchemaValidator.convertToJSONSchemaCompatibleObject(new BigNumber(input)))
                    .to.be.equal(serialized);
            });
        });
    });
});
