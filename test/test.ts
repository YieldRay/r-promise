// @ts-ignore
import promisesAplusTests from "promises-aplus-tests";
import { RPromise } from "../src";

promisesAplusTests(RPromise, function (err: any) {
    // All done; output is in the console. Or check `err` for number of failures.
    console.error(err);
});
