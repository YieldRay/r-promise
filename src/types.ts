/**
 * The difference is that `RPromise` hold the rejected value as `unknown` instead of `any`
 */
import type { RPromise } from "./index";

export type Awaitable<T> = T | Thenable<T>;

/** equals to `PromiseLike` */
export interface Thenable<T> {
    then: <R = T, S = never>(
        onFulfilled?: ((value: T) => Awaitable<R>) | null,
        onRejected?: ((reason: unknown) => Awaitable<S>) | null,
    ) => Thenable<R | S>;
}

export interface RPromiseFulfilledResult<T> {
    status: "fulfilled";
    value: T;
}

export interface RPromiseRejectedResult {
    status: "rejected";
    reason: unknown;
}

export type RPromiseSettledResult<T> =
    | PromiseFulfilledResult<T>
    | PromiseRejectedResult;

export interface RPromiseRejectionEvent {
    readonly promise: RPromise<any>;
    readonly reason: unknown;
}
