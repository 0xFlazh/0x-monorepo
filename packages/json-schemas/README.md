json-schemas
------

Contains 0x-related json schemas

## Installation

```bash
yarn add @0xproject/json-schemas
```

## Usage

```javascript
import {SchemaValidator, ValidatorResult, schemas} from '@0xproject/json-schemas';

const {orderSchema} = schemas;
const validator = new SchemaValidator();

const order = {
    ...
};
const validatorResult: ValidatorResult = validator.validate(order, orderSchema); // Contains all errors
const isValid: boolean = validator.isValid(order, orderSchema); // Only returns boolean
```

## Contributing

We strongly encourage our community members to help us make improvements and to determine the future direction of the protocol. To report bugs within this package, please create an issue in this repository.

[CONTRIBUTING.md](../../CONTRIBUTING.md)

## Install Dependencies

If you don't have yarn workspaces enabled - enable them:
`yarn config set workspaces-experimental true`

Then install dependencies
`yarn install`

## Build

`yarn build`

## Lint

`yarn lint`

## Run Tests

`yarn test`
