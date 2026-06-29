jest.mock("core/utils/superstate/serializer", () => ({
    stringifyJob: jest.fn((job) => `${job.type}:${job.path}`),
}));

const terminate = jest.fn();

jest.mock("core/superstate/workers/indexer/indexer.worker", () =>
    jest.fn().mockImplementation(() => ({
        postMessage: jest.fn(),
        terminate,
    })),
);

import { Indexer } from "core/superstate/workers/indexer/indexer";

describe("Indexer lifecycle", () => {
    beforeEach(() => {
        terminate.mockClear();
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
});
