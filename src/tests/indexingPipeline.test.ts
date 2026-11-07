// End-to-end over the indexing pipeline with the real Indexer and the real worker parser:
// Superstate.reloadPath -> Indexer.send (payload + spaces mirror sync) -> parsePath ->
// Indexer.finish -> Superstate.pathReloaded -> pathsIndex / tagsMap / spacesMap.
// Only the Worker transport is faked: messages are answered on the next tick.
jest.mock("core/superstate/workers/indexer/indexer.worker", () => {
    const { parsePath, parseAllPaths } = jest.requireActual("core/superstate/workers/indexer/impl");
    class FakeWorker {
        onmessage: (evt: { data: any }) => void = () => undefined;
        onerror: (evt: any) => void = () => undefined;
        onmessageerror: () => void = () => undefined;
        spaces = new Map();
        syncs = 0;
        postMessage(message: { job: { type: string; path: string }; payload: any }) {
            const { job, payload } = message;
            if (job.type == "spaces") {
                this.spaces = payload.spacesCache;
                this.syncs++;
                return;
            }
            const result = job.type == "path" ? parsePath(payload, this.spaces) : parseAllPaths(payload, this.spaces);
            setTimeout(() => this.onmessage({ data: { job, result } }), 0);
        }
        terminate(): void {
            return undefined;
        }
    }
    return jest.fn().mockImplementation(() => new FakeWorker());
});

import { Superstate } from "core/superstate/superstate";
import { tagSpacePathFromTag } from "schemas/builtin";

type FixtureCache = { path: string; name: string; type: string; subtype: string; parent: string; tags: string[] };

const createSuperstate = (caches: Record<string, FixtureCache>) => {
    const spaceManager = {
        allPaths: jest.fn((): string[] => Object.keys(caches)),
        allSpaces: jest.fn((): any[] => []),
        readTags: jest.fn((): string[] => []),
        readFocuses: jest.fn(() => Promise.resolve([])),
        saveFocuses: jest.fn(() => Promise.resolve()),
        pathsForTag: jest.fn((): string[] => []),
        pathExists: jest.fn((path: string) => path in caches),
        parentPathForPath: jest.fn((path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/")),
        readPathCache: jest.fn((path: string) => Promise.resolve(caches[path] ? { metadata: {}, hidden: false, ...caches[path] } : null)),
        allCaches: jest.fn(() => Promise.resolve(new Map(Object.entries(caches)))),
        spaceInfoForPath: jest.fn((path: string) => ({ path, name: path.split("/").pop() })),
        uriByString: jest.fn(),
        spaceTypeByString: jest.fn(),
        superstate: null as any,
    };
    const ui = { notify: jest.fn(), viewsByPath: jest.fn((): any[] => []), superstate: null as any };
    const superstate = Superstate.create("test", jest.fn(), spaceManager as any, ui as any) as any;
    superstate.settings = { hiddenExtensions: [], hiddenFiles: [] };
    superstate.persister = { loadAll: jest.fn(() => Promise.resolve([])), store: jest.fn(() => Promise.resolve()), remove: jest.fn() };
    const folderSpace = { path: "Projects", name: "Projects", type: "folder", space: { path: "Projects", folderPath: "Projects", defPath: "Projects/.space/def.json" }, metadata: {} };
    superstate.spacesIndex.set("Projects", folderSpace);
    return { superstate, spaceManager, worker: superstate.indexer.workers[0] };
};

describe("indexing pipeline", () => {
    const plan: FixtureCache = { path: "Projects/Plan.md", name: "Plan", type: "file", subtype: "md", parent: "Projects", tags: ["#work"] };

    it("indexes a path into pathsIndex, tagsMap and spacesMap through the worker parser", async () => {
        const { superstate } = createSuperstate({ "Projects/Plan.md": plan });

        await expect(superstate.reloadPath("Projects/Plan.md")).resolves.toBe(true);

        const state = superstate.pathsIndex.get("Projects/Plan.md");
        expect(state.name).toBe("Plan");
        expect(state.tags).toEqual(["#work"]);
        expect(state.spaces).toEqual(expect.arrayContaining(["Projects", tagSpacePathFromTag("#work")]));
        expect([...superstate.tagsMap.get("Projects/Plan.md")]).toEqual(["#work"]);
        expect([...superstate.spacesMap.getInverse("Projects")]).toEqual(["Projects/Plan.md"]);
        expect(superstate.persister.store).toHaveBeenCalledWith("Projects/Plan.md", expect.any(String), "path");
    });

    it("sends the spaces index to the worker once until it changes", async () => {
        const { superstate, worker } = createSuperstate({ "Projects/Plan.md": plan });

        await superstate.reloadPath("Projects/Plan.md");
        await superstate.reloadPath("Projects/Plan.md");
        expect(worker.syncs).toBe(1);

        superstate.spacesIndex.set("Archive", { path: "Archive", name: "Archive", type: "folder", space: { folderPath: "Archive" }, metadata: { pinned: ["Projects/Plan.md"] } });
        await superstate.reloadPath("Projects/Plan.md");

        expect(worker.syncs).toBe(2);
        expect(superstate.pathsIndex.get("Projects/Plan.md").pinnedSpaces).toEqual(["Archive"]);
        expect([...superstate.spacesMap.getInverse("Archive")]).toEqual(["Projects/Plan.md"]);
    });

    it("leaves the index untouched for a path without a cache", async () => {
        const { superstate } = createSuperstate({ "Projects/Plan.md": plan });

        await superstate.reloadPath("Projects/Missing.md");

        expect(superstate.pathsIndex.has("Projects/Missing.md")).toBe(false);
        expect(superstate.tagsMap.map.has("Projects/Missing.md")).toBe(false);
    });
});
