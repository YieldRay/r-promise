let nextTick: (callback: VoidFunction) => void;

if (typeof queueMicrotask === "function") {
    // standard
    nextTick = queueMicrotask;
} else if (typeof process === "object" && typeof process.nextTick === "function") {
    // node
    nextTick = process.nextTick;
} else if (typeof window === "object" && typeof window.MutationObserver === "function") {
    // browser
    let counter = 0;
    const tasks: Array<VoidFunction> = []; // task queue
    const observer = new MutationObserver(() => {
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
        textNode.textContent = String(++counter);
    };
} else {
    // unknown
    nextTick = setTimeout;
}

export { nextTick };
