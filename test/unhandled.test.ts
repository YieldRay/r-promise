import { RPromise } from "../src/index";
import type { RPromiseRejectionEvent } from "../src/types";
import { describe, it } from "node:test";
import assert from "node:assert";

describe("RPromise.addUnhandledRejectionCallback", function () {
    it("unhandled RPromise with 1 callback", async function () {
        return new Promise<void>((resolve) => {
            const cb = ({ promise, reason }: RPromiseRejectionEvent) => {
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
            const cb1 = ({ promise, reason }: RPromiseRejectionEvent) => {
                assert.equal(promise, p);
                assert.equal(reason, "unhandled2");
                map.cb1 = true;
                ok();
            };
            const cb2 = ({ promise, reason }: RPromiseRejectionEvent) => {
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
