// @ts-ignore
import promisesAplusTests from "promises-aplus-tests";
import { RPromise } from "../src";

// withResolvers() is standard method, while deferred() is required by the test
// @ts-ignore
RPromise.deferred = RPromise.withResolvers;

promisesAplusTests(RPromise, function (err: any) {
    // All done; output is in the console. Or check `err` for number of failures.
    if (err) console.error(err);
});
