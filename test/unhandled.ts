import { RPromise, RPromiseRejectionEvent } from "../src";
import { describe, it } from "mocha";
import assert from "node:assert";

type Callback = (ev: RPromiseRejectionEvent<any>) => void;
describe("RPromise.addUnhandledRejectionCallback", function () {
    it("unhandled RPromise with 1 callback", async function () {
        return new Promise<void>((resolve) => {
            const cb: Callback = ({ promise, reason }) => {
                assert.equal(promise, p);
                assert.equal(reason, "unhandled1");
                RPromise.removeUnhandledRejectionCallback(cb);
                resolve();
            };
            RPromise.addUnhandledRejectionCallback(cb);
            const p = RPromise.reject("unhandled1");
        });
    });

    it("unhandled RPromise with 2 callback", function () {
        return new Promise<void>((resolve) => {
            const map = {
                cb1: false,
                cb2: false,
            };
            const ok = () => {
                if (Object.values(map).every(Boolean)) {
                    RPromise.removeUnhandledRejectionCallback(cb1);
                    RPromise.removeUnhandledRejectionCallback(cb2);
                    resolve();
                }
            };
            const cb1: Callback = ({ promise, reason }) => {
                assert.equal(promise, p);
                assert.equal(reason, "unhandled2");
                map.cb1 = true;
                ok();
            };
            const cb2: Callback = ({ promise, reason }) => {
                assert.equal(promise, p);
                assert.equal(reason, "unhandled2");
                map.cb2 = true;
                ok();
            };
            RPromise.addUnhandledRejectionCallback(cb1);
            RPromise.addUnhandledRejectionCallback(cb2);
            const p = RPromise.reject("unhandled2");
        });
    });
});
