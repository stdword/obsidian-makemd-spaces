import { parseMetadata } from "core/superstate/metadataParsing";

jest.mock("core/superstate/workers/indexer/indexer", () => ({
    Indexer: jest.fn().mockImplementation(() => ({
        reload: jest.fn(() => Promise.resolve({})),
    })),
}));

import { Superstate } from "core/superstate/superstate";

const parentForPath = (path: string) => {
    const index = path.lastIndexOf("/");
    return index == -1 ? "" : path.slice(0, index);
};

const createSuperstate = (existingFolders: Set<string>) => {
    const spaceManager = {
        allPaths: jest.fn((): string[] => []),
        allSpaces: jest.fn((): any[] => []),
        readTags: jest.fn((): string[] => []),
        readFocuses: jest.fn(() => Promise.resolve([])),
        saveFocuses: jest.fn(() => Promise.resolve()),
        pathsForTag: jest.fn((): string[] => []),
        pathExists: jest.fn(async (path: string) => existingFolders.has(path)),
        loadPath: jest.fn(),
        childrenForSpace: jest.fn((): string[] => []),
        saveSpace: jest.fn(() => Promise.resolve()),
        spaceDefinitionForPath: jest.fn(() => Promise.resolve({})),
        parentPathForPath: jest.fn((path: string) => parentForPath(path)),
        spaceInfoForPath: jest.fn((path: string) => ({
            path,
            name: path.split("/").pop() || "Home",
            space: { folderPath: path, defPath: `${path}/.space/context.json`, notePath: "" },
        })),
        readPathCache: jest.fn(async (path: string) => ({
            metadata: {},
            name: path.split("/").pop() ?? path,
            type: existingFolders.has(path) ? "space" : "file",
            subtype: existingFolders.has(path) ? "folder" : path.split(".").pop(),
            parent: parentForPath(path),
            tags: [] as string[],
            path,
            hidden: false,
        })),
        uriByString: jest.fn((path: string) => ({ path })),
        spaceTypeByString: jest.fn(() => "folder"),
        superstate: null as any,
        api: null as any,
    };
    const ui = { notify: jest.fn(), viewsByPath: jest.fn((): any[] => []), superstate: null as any };
    const superstate = Superstate.create("test", jest.fn(), spaceManager as any, ui as any) as any;
    superstate.persister = {
        loadAll: jest.fn(() => Promise.resolve([])),
        store: jest.fn(() => Promise.resolve()),
        remove: jest.fn(),
    };
    // Real indexer replaced by direct metadata parsing so the race is observable.
    superstate.indexer = {
        reload: jest.fn(async (job: { path: string }) => {
            const cache = await spaceManager.readPathCache(job.path);
            const spaceState = superstate.spacesIndex.get(job.path);
            return parseMetadata(
                job.path,
                superstate.settings,
                superstate.spacesIndex,
                cache as any,
                spaceState?.name ?? cache.name,
                spaceState ? "space" : cache.type,
                spaceState ? spaceState.type : cache.subtype,
                parentForPath(job.path),
                superstate.pathsIndex.get(job.path),
            );
        }),
    };
    return { superstate, spaceManager };
};

describe("externally created files", () => {
    it("links files to their parent space when folder and files are created back to back", async () => {
        const folders = new Set<string>(["Library", "Library/Clippings"]);
        const { superstate } = createSuperstate(folders);

        const files = [
            "Library/Clippings/First Note.md",
            "Library/Clippings/Second Note.md",
            "Library/Clippings/Third Note.md",
        ];

        const spaceUpdates: string[] = [];
        superstate.eventsDispatcher.addListener("spaceStateUpdated", (payload: { path: string }) => {
            spaceUpdates.push(payload.path);
        });

        // The filesystem adapter fires onSpaceCreated without awaiting it, then
        // immediately fires onPathCreated for each file that arrived in the same batch.
        const folderCreated = (async () => {
            const space = await superstate.reloadSpace(superstate.spaceManager.spaceInfoForPath("Library/Clippings"), null, true);
            await superstate.onSpaceDefinitionChanged(space);
            await superstate.onPathCreated("Library/Clippings");
        })();
        const filesCreated = files.map((path) => superstate.onPathCreated(path));
        await Promise.all([folderCreated, ...filesCreated]);

        for (const path of files) {
            expect(superstate.pathsIndex.get(path)?.spaces).toContain("Library/Clippings");
        }
        expect(spaceUpdates).toContain("Library/Clippings");
    });

    it("links files when the parent space is already indexed", async () => {
        const folders = new Set<string>(["Library", "Library/Clippings"]);
        const { superstate } = createSuperstate(folders);
        const space = await superstate.reloadSpace(superstate.spaceManager.spaceInfoForPath("Library/Clippings"), null, true);
        await superstate.onSpaceDefinitionChanged(space);

        const path = "Library/Clippings/Third Note.md";
        await superstate.onPathCreated(path);

        expect(superstate.pathsIndex.get(path)?.spaces).toContain("Library/Clippings");
    });
});
