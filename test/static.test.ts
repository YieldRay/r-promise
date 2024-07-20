import { RPromise } from "../src";
import { describe, it } from "node:test";
import assert from "node:assert";

describe("RPromise.all", () => {
    it("should resolve when all promises resolve", async () => {
        const promises = [RPromise.resolve(1), RPromise.resolve(2), RPromise.resolve(3)];
        const result = await RPromise.all(promises);
        assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it("should reject when any promise rejects", async () => {
        const promises = [RPromise.resolve(1), RPromise.reject(new Error("Failed")), RPromise.resolve(3)];
        try {
            await RPromise.all(promises);
            assert.fail("Expected RPromise.all to reject");
        } catch (error) {
            assert.strictEqual(error.message, "Failed");
        }
    });
});

describe("RPromise.allSettled", () => {
    it("should resolve with an array of results when all promises resolve", async () => {
        const promises = [RPromise.resolve(1), RPromise.resolve(2), RPromise.resolve(3)];
        const result = await RPromise.allSettled(promises);
        assert.deepStrictEqual(result, [
            { status: "fulfilled", value: 1 },
            { status: "fulfilled", value: 2 },
            { status: "fulfilled", value: 3 },
        ]);
    });

    it("should resolve with an array of results when some promises reject", async () => {
        const promises = [RPromise.resolve(1), RPromise.reject(new Error("Failed")), RPromise.resolve(3)];
        const result = await RPromise.allSettled(promises);
        assert.deepStrictEqual(result, [
            { status: "fulfilled", value: 1 },
            { status: "rejected", reason: new Error("Failed") },
            { status: "fulfilled", value: 3 },
        ]);
    });
});

describe("RPromise.any", () => {
    it("should resolve with the first resolved promise", async () => {
        const promises = [RPromise.reject(new Error("Failed")), RPromise.resolve(2), RPromise.resolve(3)];
        const result = await RPromise.any(promises);
        assert.strictEqual(result, 2);
    });

    it("should reject with an AggregateError if all promises reject", async () => {
        const promises = [
            RPromise.reject(new Error("Failed 1")),
            RPromise.reject(new Error("Failed 2")),
            RPromise.reject(new Error("Failed 3")),
        ];
        try {
            await RPromise.any(promises);
            assert.fail("Expected RPromise.any to reject");
        } catch (error) {
            assert.strictEqual(error.name, "AggregateError");
            assert.strictEqual(error.errors.length, 3);
        }
    });
});

describe("RPromise.race", () => {
    it("should resolve with the first resolved promise", async () => {
        const promises = [
            new RPromise((resolve) => setTimeout(() => resolve(1), 100)),
            new RPromise((resolve) => setTimeout(() => resolve(2), 50)),
            new RPromise((resolve) => setTimeout(() => resolve(3), 200)),
        ];
        const result = await RPromise.race(promises);
        assert.strictEqual(result, 2);
    });

    it("should reject with the first rejected promise", async () => {
        const promises = [
            new RPromise((resolve, reject) => setTimeout(() => reject(new Error("Failed 1")), 100)),
            new RPromise((resolve, reject) => setTimeout(() => reject(new Error("Failed 2")), 50)),
            new RPromise((resolve, reject) => setTimeout(() => reject(new Error("Failed 3")), 200)),
        ];
        try {
            await RPromise.race(promises);
            assert.fail("Expected RPromise.race to reject");
        } catch (error) {
            assert.strictEqual(error.message, "Failed 2");
        }
    });
});

describe("RPromise.withResolvers", () => {
    it("should return an object with resolve and reject functions", () => {
        const { promise, resolve, reject } = RPromise.withResolvers();
        assert.strictEqual(typeof resolve, "function");
        assert.strictEqual(typeof reject, "function");
        assert(promise instanceof RPromise);
    });

    it("should resolve the promise when resolve is called", async () => {
        const { promise, resolve } = RPromise.withResolvers();
        resolve(42);
        const result = await promise;
        assert.strictEqual(result, 42);
    });

    it("should reject the promise when reject is called", async () => {
        const { promise, reject } = RPromise.withResolvers();
        reject(new Error("Failed"));
        try {
            await promise;
            assert.fail("Expected promise to reject");
        } catch (error) {
            assert.strictEqual(error.message, "Failed");
        }
    });
});
