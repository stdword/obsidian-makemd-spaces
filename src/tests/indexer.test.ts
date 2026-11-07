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
        expect(workers[0].postMessage.mock.calls.filter((call: any[]) => call[0].job.type == "path")).toHaveLength(2);
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
        const pathJobs = workers[0].postMessage.mock.calls.filter((call: any[]) => call[0].job.type == "path");
        expect(pathJobs).toHaveLength(2);
        expect(pathJobs[1][0].job.path).toBe("Next.md");
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

describe("Indexer spaces mirror", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const { VersionedMap } = jest.requireActual("utils/versionedMap");
    const makeCache = (spacesIndex: Map<string, any>) => ({
        settings: {},
        spacesIndex,
        pathsIndex: new Map(),
        spaceManager: {
            parentPathForPath: jest.fn(() => ""),
            readPathCache: jest.fn(() => Promise.resolve({})),
            allCaches: jest.fn(() => Promise.resolve(new Map())),
        },
    });
    const messages = (worker: any) => worker.postMessage.mock.calls.map((call: any[]) => call[0]);

    beforeEach(() => {
        terminate.mockClear();
        workers.length = 0;
    });

    it("sends the spaces index once and then only the path payload while the index is unchanged", async () => {
        const spacesIndex = new VersionedMap();
        spacesIndex.set("Projects", { path: "Projects", metadata: {} });
        const indexer = new Indexer(1, makeCache(spacesIndex) as any);

        indexer.reload({ type: "path", path: "Projects/A.md" } as any);
        await flush();
        workers[0].onmessage({ data: { job: { type: "path", path: "Projects/A.md" }, result: { cache: {}, changed: false } } });
        indexer.reload({ type: "path", path: "Projects/B.md" } as any);
        await flush();

        const sent = messages(workers[0]);
        expect(sent.map((m: any) => m.job.type)).toEqual(["spaces", "path", "path"]);
        expect(sent[0].payload.spacesCache).toBe(spacesIndex);
        expect("spacesCache" in sent[1].payload).toBe(false);
        expect("spacesCache" in sent[2].payload).toBe(false);
    });

    it("resends the spaces index exactly once after the index changed", async () => {
        const spacesIndex = new VersionedMap();
        const indexer = new Indexer(1, makeCache(spacesIndex) as any);

        indexer.reload({ type: "path", path: "A.md" } as any);
        await flush();
        workers[0].onmessage({ data: { job: { type: "path", path: "A.md" }, result: {} } });

        spacesIndex.set("Projects", { path: "Projects", metadata: {} });
        indexer.reload({ type: "path", path: "B.md" } as any);
        await flush();
        workers[0].onmessage({ data: { job: { type: "path", path: "B.md" }, result: {} } });
        indexer.reload({ type: "path", path: "C.md" } as any);
        await flush();

        expect(messages(workers[0]).map((m: any) => m.job.type)).toEqual(["spaces", "path", "spaces", "path", "path"]);
    });

    it("syncs every worker separately and resyncs a worker after it crashed", async () => {
        const spacesIndex = new VersionedMap();
        const indexer = new Indexer(2, makeCache(spacesIndex) as any);

        indexer.reload({ type: "path", path: "A.md" } as any).catch((): void => undefined);
        indexer.reload({ type: "path", path: "B.md" } as any);
        await flush();
        expect(messages(workers[0]).map((m: any) => m.job.type)).toEqual(["spaces", "path"]);
        expect(messages(workers[1]).map((m: any) => m.job.type)).toEqual(["spaces", "path"]);

        workers[0].onerror({ message: "boom" });
        await flush();
        indexer.reload({ type: "path", path: "C.md" } as any);
        await flush();
        expect(messages(workers[0]).map((m: any) => m.job.type)).toEqual(["spaces", "path", "spaces", "path"]);
    });

    it("always resends when the index is a plain Map without a version", async () => {
        const indexer = new Indexer(1, makeCache(new Map()) as any);
        indexer.reload({ type: "path", path: "A.md" } as any);
        await flush();
        workers[0].onmessage({ data: { job: { type: "path", path: "A.md" }, result: {} } });
        indexer.reload({ type: "path", path: "B.md" } as any);
        await flush();
        expect(messages(workers[0]).map((m: any) => m.job.type)).toEqual(["spaces", "path", "spaces", "path"]);
    });

    it("ignores the worker's spaces acknowledgement if one ever arrives", async () => {
        const indexer = new Indexer(1, makeCache(new VersionedMap()) as any);
        indexer.reload({ type: "path", path: "A.md" } as any);
        await flush();
        expect(() => workers[0].onmessage({ data: { job: { type: "spaces", path: "" } } })).not.toThrow();
        expect(indexer.busy).toEqual([true]);
    });
});
