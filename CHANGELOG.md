# CHANGELOG

v0.7.2 - _Jun. 26, 2017_
------------------------
    * Add the ability to use different Exchange contracts (#82)

v0.7.1 - _Jun. 26, 2017_
------------------------
    * Add the ability to convert Ether to wrapped Ether tokens and back via `zeroEx.etherToken.depostAsync` and `zeroEx.etherToken.withdrawAsync` (#81)

v0.7.0 - _Jun. 22, 2017_
------------------------
    * Add Kovan smart contract artifacts (#78)
    * Return fillAmount from `fillOrderAsync` and `fillUpToAsync` (#72)
    * Return cancelledAmount from `cancelOrderAsync` (#72)
    * Renamed type `LogCancelArgs` to `LogCancelContractEventArgs` and `LogFillArgs` to `LogFillContractEventArgs`

v0.6.2 - _Jun. 21, 2017_
------------------------
    * Reduced bundle size
    * Improved documentation

v0.6.1 - _Jun. 19, 2017_
------------------------
    * Improved documentation

v0.6.0 - _Jun. 19, 2017_
------------------------
    * Made `ZeroEx` class accept `Web3Provider` instance instead of `Web3` instance
    * Added types for contract event arguments

v0.5.2 - _Jun. 15, 2017_
------------------------
    * Fixed the bug in `postpublish` script that caused that only unminified UMD bundle was uploaded to release page

v0.5.1 - _Jun. 15, 2017_
------------------------
    * Added `postpublish` script to publish to Github Releases with assets.
