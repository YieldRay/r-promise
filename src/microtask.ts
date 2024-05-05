/**
 * A example polyfill for queueMicrotask(), this module is NOT side-effect free
 *
 * For production, you may want to use polyfill from [core-js](https://github.com/zloirock/core-js/blob/master/packages/core-js/internals/microtask.js)
 */
let nextTick: (callback: VoidFunction) => void;

declare global {
    interface Window {
        MutationObserver: typeof MutationObserver;
        WebKitMutationObserver: typeof MutationObserver;
    }
}

if (typeof queueMicrotask === "function") {
    // standard
    nextTick = queueMicrotask;
} else if (typeof Promise === "function") {
    // Promise
    if (typeof Promise.resolve === "function") {
        nextTick = (callback) => {
            Promise.resolve().then(callback);
        };
    } else {
        nextTick = (callback) => {
            new Promise<void>((resolve) => resolve()).then(callback);
        };
    }
} else if (typeof process === "object" && typeof process.nextTick === "function") {
    // node.js
    nextTick = process.nextTick;
} else if (
    typeof window === "object" &&
    (typeof window.MutationObserver === "function" || typeof window.WebKitMutationObserver === "function")
) {
    // browser
    let counter = 0;
    const tasks: Array<VoidFunction> = []; // task queue
    const observer = new (window.MutationObserver || window.WebKitMutationObserver)(() => {
        for (const task of tasks) {
            task();
        }
    });
    const textNode = document.createTextNode(String(counter));
    observer.observe(textNode, { characterData: true });
    nextTick = (callback) => {
        // add task
        let task: VoidFunction;
        tasks.push(
            (task = () => {
                callback();
                tasks.splice(tasks.indexOf(task), 1);
            })
        );
        // run task
        counter = (counter + 1) % 2;
        textNode.textContent = String(counter);
    };
} else {
    // unknown
    nextTick = (callback) => setTimeout(callback, 0);
}

export { nextTick };
