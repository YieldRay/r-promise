import { nextTick } from "./microtask";
import type {
    Thenable,
    Awaitable,
    RPromiseSettledResult,
    RPromiseRejectionEvent,
} from "./types";

export class RPromise<T = any> implements Thenable<T> {
    #value?: T = undefined;
    #reason?: unknown = undefined;
    #state: "pending" | "fulfilled" | "rejected" = "pending";
    #fulfillReactions: Array<(value: T) => any> = [];
    #rejectReactions: Array<(reason: unknown) => any> = [];
    #isHandled = false;

    get status() {
        return this.#state;
    }

    get isHandled() {
        return this.#isHandled;
    }

    constructor(
        executor: (
            resolve: (value: Awaitable<T>) => void,
            reject: (reason: unknown) => void
        ) => void
    ) {
        if (typeof executor !== "function") {
            throw new TypeError(
                `RPromise resolver ${executor} is not a function`
            );
        }

        const resolve = (_value: Awaitable<T>) => {
            // NOTE: this step is NOT required by Promise/A+
            if (_value instanceof RPromise) {
                // in order to pass the Promise/A+, DO NOT use `isThenable` here
                _value.then(resolve, reject);
                return;
            }

            // now `value` is of type `T`
            const value = _value as T;
            nextTick(() => {
                if (this.#state !== "pending") return;
                this.#state = "fulfilled";
                this.#value = value;
                this.#fulfillReactions.forEach((onFulfilled) =>
                    onFulfilled(value)
                );
            });
        };

        const reject = (reason: unknown) => {
            nextTick(() => {
                if (this.#state !== "pending") return;
                this.#state = "rejected";
                this.#reason = reason;
                this.#rejectReactions.forEach((onRejected) =>
                    onRejected(reason)
                );
                if (this.#rejectReactions.length === 0) {
                    // TODO: unhandledRejection callback
                    // https://html.spec.whatwg.org/multipage/webappapis.html#unhandled-promise-rejections
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
            reject(e);
        }
    }

    then<R = T, S = never>(
        onFulfilled?: ((value: T) => Awaitable<R>) | null,
        onRejected?: ((reason: unknown) => Awaitable<S>) | null
    ): RPromise<R | S> {
        const onFulfilledCallback =
            onFulfilled instanceof Function
                ? onFulfilled.bind(undefined)
                : // `R` is `T` when `onFulfilled` is not provided, so `T` is `Awaitable<R>` here
                  (((v) => v) as (value: T) => Awaitable<R>);

        const onRejectedCallback =
            onRejected instanceof Function
                ? onRejected.bind(undefined)
                : <T>(r: T) => {
                      throw r;
                  };

        let promise2: RPromise<R | S>;
        this.#isHandled = true;

        switch (this.#state) {
            case "pending": {
                return (promise2 = new RPromise<R | S>((resolve, reject) => {
                    this.#fulfillReactions.push((value) => {
                        try {
                            const value2 = onFulfilledCallback(value);
                            resolvePromise(promise2, value2, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    });
                    this.#rejectReactions.push((reason) => {
                        try {
                            const value2 = onRejectedCallback(reason);
                            resolvePromise(promise2, value2, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    });
                }));
            }
            case "fulfilled": {
                return (promise2 = new RPromise<R | S>((resolve, reject) => {
                    nextTick(() => {
                        try {
                            const value2 = onFulfilledCallback(this.#value!);
                            resolvePromise(promise2, value2, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    });
                }));
            }
            case "rejected": {
                return (promise2 = new RPromise<R | S>((resolve, reject) => {
                    nextTick(() => {
                        try {
                            const value2 = onRejectedCallback(this.#reason);
                            resolvePromise(promise2, value2, resolve, reject);
                        } catch (r) {
                            reject(r);
                        }
                    });
                }));
            }
        }
    }

    catch<S>(onRejected?: ((reason: unknown) => Awaitable<S>) | null) {
        return this.then(undefined, onRejected);
    }

    finally(onFinally?: (() => void) | null): RPromise<T> {
        const thenFinally =
            onFinally instanceof Function
                ? (value: T) => {
                      return RPromise.resolve(onFinally()).then(() => value);
                  }
                : onFinally;

        const catchFinally =
            onFinally instanceof Function
                ? (reason: unknown) => {
                      return RPromise.resolve(onFinally()).then(() => {
                          throw reason;
                      });
                  }
                : onFinally;

        return this.then(thenFinally, catchFinally);
    }

    static resolve<T>(value: T): RPromise<Awaited<T>> {
        if (value instanceof RPromise) return value;
        return new RPromise((resolve, _) => resolve(value as Awaited<T>));
    }

    static reject<T = never>(reason: unknown): RPromise<T> {
        return new RPromise((_, reject) => reject(reason));
    }

    static withResolvers<T = any>() {
        let resolve: (value: Awaitable<T>) => void;
        let reject: (reason: unknown) => void;

        const promise = new RPromise<T>((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
        });

        // executor (promise constructor callback) is immediately invoked (in sync)
        // so `resolve` and `reject` are correctly assigned
        return {
            promise,
            // @ts-ignore
            resolve,
            // @ts-ignore
            reject,
        };
    }

    static try<T, Args extends unknown[]>(
        func: (...args: Args) => Awaitable<T>,
        ...args: Args
    ): RPromise<T> {
        return new RPromise<T>((resolve, reject) => {
            try {
                if (typeof func !== "function")
                    throw new TypeError(`${func} is not a function`);
                const result = func.apply(undefined, args);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    }

    static all<T>(
        iterable: Iterable<Awaitable<T>>
    ): RPromise<Array<Awaited<T>>> {
        return new RPromise<Array<Awaited<T>>>((resolve, reject) => {
            const values: Array<Awaited<T>> = [];
            let remainingElementsCount = 1; // start with 1 to handle the edge case of an empty iterable
            let index = 0;

            for (const item of iterable) {
                const currentIndex = index++;
                remainingElementsCount++;

                RPromise.resolve(item).then(
                    (value) => {
                        values[currentIndex] = value;

                        if (--remainingElementsCount === 0) {
                            resolve(values);
                        }
                    },
                    (reason) => {
                        reject(reason);
                    }
                );
            }

            // decrement for the initial increment
            if (--remainingElementsCount === 0) {
                resolve(values);
            }
        });
    }

    static allSettled<T>(
        iterable: Iterable<Awaitable<T>>
    ): RPromise<RPromiseSettledResult<Awaited<T>>[]> {
        return new RPromise<RPromiseSettledResult<Awaited<T>>[]>((resolve) => {
            const values: Array<RPromiseSettledResult<Awaited<T>>> = [];
            let remainingElementsCount = 1; // start with 1 to handle the empty iterable case
            let index = 0;

            for (const item of iterable) {
                const currentIndex = index++;
                remainingElementsCount++;

                RPromise.resolve(item).then(
                    (value) => {
                        values[currentIndex] = { status: "fulfilled", value };

                        if (--remainingElementsCount === 0) {
                            resolve(values);
                        }
                    },
                    (reason) => {
                        values[currentIndex] = { status: "rejected", reason };

                        if (--remainingElementsCount === 0) {
                            resolve(values);
                        }
                    }
                );
            }

            if (--remainingElementsCount === 0) {
                // decrement for the initial increment
                resolve(values);
            }
        });
    }

    static any<T>(iterable: Iterable<Awaitable<T>>): RPromise<Awaited<T>> {
        return new RPromise<Awaited<T>>((resolve, reject) => {
            const errors: unknown[] = [];
            let remainingElementsCount = 1; // start with 1 to handle the edge case of an empty iterable
            let index = 0;

            for (const item of iterable) {
                const currentIndex = index++;
                remainingElementsCount++;

                RPromise.resolve(item).then(
                    (value) => {
                        resolve(value);
                    },
                    (reason) => {
                        errors[currentIndex] = reason;

                        if (--remainingElementsCount === 0) {
                            reject(
                                new AggregateError(
                                    errors,
                                    "All promises were rejected"
                                )
                            );
                        }
                    }
                );
            }

            if (--remainingElementsCount === 0) {
                // decrement for the initial increment
                reject(
                    new AggregateError(errors, "All promises were rejected")
                );
            }
        });
    }

    static race<T>(iterable: Iterable<Awaitable<T>>): RPromise<Awaited<T>> {
        return new RPromise<Awaited<T>>((resolve, reject) => {
            for (const item of iterable) {
                RPromise.resolve(item).then(resolve, reject);
            }
        });
    }

    // unhandled rejections
    static addUnhandledRejectionCallback(
        callback: (ev: RPromiseRejectionEvent) => void
    ) {
        if (typeof callback === "function") {
            onUnhandledRejectionList.push(callback);
        }
    }

    static removeUnhandledRejectionCallback(
        callback: (ev: RPromiseRejectionEvent) => void
    ) {
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

const onUnhandledRejectionList: Array<(ev: RPromiseRejectionEvent) => void> =
    [];

/**
 * Returns `x.then` if `x` is [thenable](https://promisesaplus.com/#the-promise-resolution-procedure)
 *
 * Note that this is different from [ECMA262 IsPromise](https://tc39.es/ecma262/#sec-ispromise)
 * as it rely on the language internal slot which only accept the standard Promise
 */
export function isThenable(x: unknown): Thenable<any>["then"] | false {
    if (
        x !== null &&
        (typeof x === "object" || typeof x === "function") &&
        Reflect.has(x, "then")
    ) {
        const then = Reflect.get(x, "then");
        if (typeof then === "function") return then.bind(x);

        // [warn]
        // do not use: then instanceof Function
        // which is a wrong way to check the function type
        // why? because it checks the prototype rather than check if it is able to invoke
        // [example]
        // var o = { __proto__ : Function.prototype }
        // o instanceof Function // => true
    }
    return false;
}

function resolvePromise<T>(
    promise2: RPromise<T>,
    value2: Awaitable<T>,
    resolve: (value: Awaitable<T>) => void,
    reject: (reason: unknown) => void
) {
    if (value2 === promise2) {
        throw new TypeError("Chaining cycle detected for promise #<RPromise>");
    }

    let thenCalledOrThrow = false;

    try {
        const then = isThenable(value2);
        if (then) {
            then(
                (value: T) => {
                    if (thenCalledOrThrow) return;
                    thenCalledOrThrow = true;
                    return resolvePromise(promise2, value, resolve, reject);
                },
                (reason: unknown) => {
                    if (thenCalledOrThrow) return;
                    thenCalledOrThrow = true;
                    return reject(reason);
                }
            );
        } else {
            resolve(value2);
        }
    } catch (e) {
        if (thenCalledOrThrow) return;
        thenCalledOrThrow = true;
        reject(e);
    }
}
