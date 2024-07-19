import { nextTick } from "./microtask";

type Thenable = {
    then: (
        onFulfilled?: <T = any, U = any>(value: T) => U,
        onRejected?: <T = any, U = any>(reason: T) => U
    ) => Thenable;
};

export class RPromise<T = any, U = any> {
    #value?: T = undefined;
    #reason?: U = undefined;
    #state: "pending" | "fulfilled" | "rejected" = "pending";
    #fulfillReactions: Array<(value: T) => any> = [];
    #rejectReactions: Array<(reason: U) => any> = [];

    get status() {
        return this.#state;
    }

    constructor(executor: (resolve: (value: T) => void, reject: (reason: U) => void) => void) {
        if (typeof executor !== "function") {
            throw new TypeError(`RPromise resolver ${executor} is not a function`);
        }

        const resolve = (value: T) => {
            if (value instanceof RPromise) {
                value.then(resolve, reject);
                return;
            }

            nextTick(() => {
                if (this.#state !== "pending") return;
                this.#state = "fulfilled";
                this.#value = value;
                this.#fulfillReactions.forEach((onFulfilled) => onFulfilled(value));
            });
        };
        const reject = (reason: U) => {
            nextTick(() => {
                if (this.#state !== "pending") return;
                this.#state = "rejected";
                this.#reason = reason;
                this.#rejectReactions.forEach((onRejected) => onRejected(reason));
                if (this.#rejectReactions.length === 0) {
                    // unhandledRejection callback
                    onUnhandledRejectionList.forEach((onUnhandledRejection) =>
                        onUnhandledRejection({
                            promise: this,
                            reason,
                        })
                    );
                }
            });
        };
        try {
            executor(resolve, reject);
        } catch (e) {
            reject(e as U);
        }
    }

    then<R = any, S = any>(onFulfilled?: (value: T) => R, onRejected?: (reason: U) => S) {
        const onFulfilledCallback =
            onFulfilled instanceof Function
                ? onFulfilled.bind(undefined)
                : <T>(v: T) => {
                      return v;
                  };
        const onRejectedCallback =
            onRejected instanceof Function
                ? onRejected.bind(undefined)
                : <T>(r: T) => {
                      throw r;
                  };

        let promise2: RPromise;

        switch (this.#state) {
            case "fulfilled": {
                return (promise2 = new RPromise((resolve, reject) => {
                    nextTick(() => {
                        try {
                            const x = onFulfilledCallback(this.#value!);
                            resolvePromise(promise2, x, resolve, reject);
                        } catch (r) {
                            reject(r);
                        }
                    });
                }));
            }
            case "rejected": {
                return (promise2 = new RPromise((resolve, reject) => {
                    nextTick(() => {
                        try {
                            const x = onRejectedCallback(this.#reason!);
                            resolvePromise(promise2, x, resolve, reject);
                        } catch (r) {
                            reject(r);
                        }
                    });
                }));
            }
            case "pending": {
                return (promise2 = new RPromise((resolve, reject) => {
                    this.#fulfillReactions.push((value) => {
                        try {
                            const x = onFulfilledCallback(value);
                            resolvePromise(promise2, x, resolve, reject);
                        } catch (r) {
                            reject(r);
                        }
                    });
                    this.#rejectReactions.push((reason) => {
                        try {
                            const x = onRejectedCallback(reason);
                            resolvePromise(promise2, x, resolve, reject);
                        } catch (r) {
                            reject(r);
                        }
                    });
                }));
            }
        }
    }

    catch<S>(onRejected?: (reason: U) => S) {
        return this.then(undefined, onRejected);
    }

    static resolve<T>(value: T) {
        return new RPromise((resolve, _) => {
            resolve(value);
        });
    }

    static reject<U>(reason: U) {
        return new RPromise((_, reject) => {
            reject(reason);
        });
    }

    static promise = new RPromise(() => {});

    static withResolvers<T = any, U = any>() {
        let resolve: (value: T) => void;
        let reject: (reason: U) => void;

        const promise = new RPromise<T, U>((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
        });

        // executor(promise constructor callback) is immediately invoked (in sync)
        // so `resolve` and `reject` are correctly assigned
        return {
            promise,
            //@ts-ignore
            resolve,
            //@ts-ignore
            reject,
        };
    }

    static addUnhandledRejectionCallback(callback: (ev: RPromiseRejectionEvent) => void) {
        if (typeof callback === "function") {
            onUnhandledRejectionList.push(callback);
        }
    }
    static removeUnhandledRejectionCallback(callback: (ev: RPromiseRejectionEvent) => void) {
        const index = onUnhandledRejectionList.indexOf(callback);
        if (index > -1) onUnhandledRejectionList.splice(index, 1);
    }
    static clearUnhandledRejectionCallback() {
        onUnhandledRejectionList.splice(0, onUnhandledRejectionList.length);
    }
}

Object.defineProperty(RPromise.prototype, Symbol.toStringTag, {
    writable: false,
    enumerable: false,
    configurable: true,
    value: RPromise.name,
});

export interface RPromiseRejectionEvent<U = any> {
    readonly promise: RPromise<any, U>;
    readonly reason: U;
}

const onUnhandledRejectionList: Array<(ev: RPromiseRejectionEvent) => void> = [];

/**
 * Returns `x.then` if `x` is [thenable](https://promisesaplus.com/#the-promise-resolution-procedure)
 *
 * Note that this is different from [ECMA262 IsPromise](https://tc39.es/ecma262/#sec-ispromise)
 * as it rely on the language internal slot which only accept the standard Promise
 */
function isThenable(x: unknown) {
    if (x !== null && (typeof x === "object" || typeof x === "function") && Reflect.has(x, "then")) {
        const then = Reflect.get(x, "then");
        if (typeof then === "function") return then.bind(x);

        // [warn]
        // do not use: then instanceof Function
        // which is a wrong way to check a function
        // why? because it check prototype rather than check if it is able to invoke
        // [example]
        // var o = { __proto__ : Function.prototype }
        // o instanceof Function // => true
    }
    return false;
}

function resolvePromise<T, U>(
    promise2: RPromise<T, U>,
    x: T,
    resolve: (value: T) => void,
    reject: (reason: U) => void
) {
    if (x === promise2) {
        throw new TypeError("Chaining cycle detected for promise #<RPromise>");
    }

    let thenCalledOrThrow = false;

    try {
        const then = isThenable(x);
        if (then) {
            then(
                (y: T) => {
                    if (thenCalledOrThrow) return;
                    thenCalledOrThrow = true;
                    return resolvePromise(promise2, y, resolve, reject);
                },
                (r: U) => {
                    if (thenCalledOrThrow) return;
                    thenCalledOrThrow = true;
                    return reject(r);
                }
            );
        } else {
            resolve(x);
        }
    } catch (e) {
        if (thenCalledOrThrow) return;
        thenCalledOrThrow = true;
        reject(e as U);
    }
}
