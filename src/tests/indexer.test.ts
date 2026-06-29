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
