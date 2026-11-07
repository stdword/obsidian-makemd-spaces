jest.mock("core/utils/superstate/serializer", () => ({
    stringifyJob: jest.fn((job) => `${job.type}:${job.path}`),
}));

const terminate = jest.fn();
const workers: any[] = [];

jest.mock("core/superstate/workers/indexer/indexer.worker", () =>
    jest.fn().mockImplementation(() => {
        const worker = {
            postMessage: jest.fn(),
            terminate,
        };
        workers.push(worker);
        return worker;
    }),
);

import { Indexer } from "core/superstate/workers/indexer/indexer";

describe("Indexer lifecycle", () => {
    beforeEach(() => {
        terminate.mockClear();
        workers.length = 0;
    });

    it("terminates every worker and clears queued work", async () => {
        const cache = {
            settings: {},
            spacesIndex: new Map(),
            pathsIndex: new Map(),
            spaceManager: {
                parentPathForPath: jest.fn(() => ""),
                readPathCache: jest.fn(() => Promise.resolve({})),
            },
        };
        const indexer = new Indexer(2, cache as any);
        const pending = indexer.reload({ type: "path", path: "A.md" } as any).catch((error) => error);

        indexer.terminate();

        await expect(pending).resolves.toEqual(new Error("Indexer terminated"));
        expect(terminate).toHaveBeenCalledTimes(2);
        expect(indexer.reloadQueue).toEqual([]);
        expect(indexer.reloadSet.size).toBe(0);
        expect(indexer.callbacks.size).toBe(0);
    });

    it("reserves workers while preparing async payloads", () => {
        const pendingRead = new Promise(() => null);
        const cache = {
            settings: {},
            spacesIndex: new Map(),
            pathsIndex: new Map(),
            spaceManager: {
                parentPathForPath: jest.fn(() => ""),
                readPathCache: jest.fn(() => pendingRead),
            },
        };
        const indexer = new Indexer(2, cache as any);

        indexer.reload({ type: "path", path: "A.md" } as any);
        indexer.reload({ type: "path", path: "B.md" } as any);
        indexer.reload({ type: "path", path: "C.md" } as any);

        expect(indexer.busy).toEqual([true, true]);
        expect(indexer.reloadQueue.map((job) => job.path)).toEqual(["C.md"]);
        expect(indexer.reloadSet.size).toBe(3);
        expect(indexer.callbacks.size).toBe(3);
        expect(workers[0].postMessage).not.toHaveBeenCalled();
        expect(workers[1].postMessage).not.toHaveBeenCalled();
    });

});

describe("Indexer failure recovery", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const makeCache = () => ({
        settings: {},
        spacesIndex: new Map(),
        pathsIndex: new Map(),
        spaceManager: {
            parentPathForPath: jest.fn(() => ""),
            readPathCache: jest.fn(() => Promise.resolve({})),
        },
    });

    beforeEach(() => {
        terminate.mockClear();
        workers.length = 0;
    });

    it("rejects the job and frees the worker when the worker reports an error result", async () => {
        const indexer = new Indexer(1, makeCache() as any);
        const job = { type: "path", path: "Broken.md" };
        const failed = indexer.reload(job as any).catch((error) => error);
        await flush();

        workers[0].onmessage({ data: { job, result: { $error: "parse failed" } } });

        await expect(failed).resolves.toBe("parse failed");
        expect(indexer.busy).toEqual([false]);
        expect(indexer.reloadSet.size).toBe(0);

        // The same path can be indexed again instead of returning the dead promise.
        indexer.reload(job as any);
        await flush();
        expect(workers[0].postMessage).toHaveBeenCalledTimes(2);
    });

    it("rejects the active job and frees the worker when the worker itself crashes", async () => {
        const indexer = new Indexer(1, makeCache() as any);
        const first = indexer.reload({ type: "path", path: "Crash.md" } as any).catch((error) => error);
        indexer.reload({ type: "path", path: "Next.md" } as any);
        await flush();
        expect(indexer.reloadQueue.map((job) => job.path)).toEqual(["Next.md"]);

        workers[0].onerror({ message: "Uncaught RangeError" });

        await expect(first).resolves.toContain("Uncaught RangeError");
        await flush();
        expect(indexer.reloadQueue).toEqual([]);
        expect(indexer.busy).toEqual([true]);
        expect(workers[0].postMessage).toHaveBeenCalledTimes(2);
        expect(workers[0].postMessage.mock.calls[1][0].job.path).toBe("Next.md");
    });

    it("treats a missing result as an error instead of throwing in the message handler", async () => {
        const indexer = new Indexer(1, makeCache() as any);
        const job = { type: "path", path: "Empty.md" };
        const failed = indexer.reload(job as any).catch((error) => error);
        await flush();

        expect(() => workers[0].onmessage({ data: { job, result: undefined } })).not.toThrow();
        await expect(failed).resolves.toBeDefined();
        expect(indexer.busy).toEqual([false]);
    });
});
