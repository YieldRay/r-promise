# R-Promise

[![ci](https://github.com/YieldRay/r-promise/actions/workflows/ci.yml/badge.svg)](https://github.com/YieldRay/r-promise/actions/workflows/ci.yml)

A Typescript [Promise](https://tc39.es/ecma262/#sec-promise-objects)
implementation that can pass [Promises/A+](https://promisesaplus.com/) tests

> [!NOTE]  
> Please note that Promise/A+ is slightly different from ECMA262 Promise, as the Promise/A+ cares more about the library interoperability.
> We can mostly say that Promise/A+ is a superset of ECMA262 Promise.

Most features of ECMAScript® 2025 have been implemented, including but not limited to:

-   RPromise.all
-   RPromise.allSettled
-   RPromise.any
-   RPromise.race
-   RPromise.try
-   RPromise.withResolvers
-   Unhandled Rejection Callbacks

Please note that the TypeScript definitions for these features may differ slightly from those found in TypeScript's built-in definitions (e.g. `lib.esXXXX.promise.d.ts`).
