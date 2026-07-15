jest.mock("core/superstate/workers/indexer/indexer", () => ({
    Indexer: jest.fn().mockImplementation(() => ({
        reload: jest.fn(() => Promise.resolve({})),
    })),
}));

import { Superstate } from "core/superstate/superstate";
import { savePathColor } from "core/utils/superstate/label";
import { isSpaceSortable, spaceSortFn } from "core/utils/superstate/spaces";
import { saveColorForPaths } from "core/utils/emoji";
import { addTag, mergeTagSpaceMetadata, syncTagSpacesFromObsidian } from "core/utils/superstate/tags";
import { SPACE_SEPARATOR_PATH, tagSpacePathFromTag } from "schemas/builtin";

const createSuperstate = () => {
    const spaceManager = {
        allPaths: jest.fn(() => ["icons/logo.svg"]),
        allSpaces: jest.fn((): any[] => []),
        readTags: jest.fn((): string[] => []),
        readFocuses: jest.fn(() => Promise.resolve([])),
        saveFocuses: jest.fn(() => Promise.resolve()),
        pathsForTag: jest.fn((): string[] => []),
        pathExists: jest.fn((_path: string) => false),
        loadPath: jest.fn(),
        createSpace: jest.fn(() => Promise.resolve()),
        childrenForSpace: jest.fn((): string[] => []),
        saveSpace: jest.fn(() => Promise.resolve()),
        spaceDefinitionForPath: jest.fn(() => Promise.resolve({})),
        spaceInfoForPath: jest.fn((path: string) => ({ path, name: path.replace("spaces://#", "") })),
        readPathCache: jest.fn((path: string) =>
            Promise.resolve({
                metadata: {},
                name: path.split("/").pop() ?? path,
                type: path.includes(".") ? "file" : "space",
                subtype: path.includes(".") ? path.split(".").pop() : "folder",
                parent: "",
                tags: [],
                path,
                hidden: false,
                spaces: [],
                linkedSpaces: [],
            }),
        ),
        uriByString: jest.fn(),
        spaceTypeByString: jest.fn(),
        superstate: null as any,
        api: null as any,
    };
    const ui = {
        notify: jest.fn(),
        viewsByPath: jest.fn((): any[] => []),
        superstate: null as any,
    };

    const superstate = Superstate.create("test", jest.fn(), spaceManager as any, ui as any) as any;
    superstate.persister = {
        loadAll: jest.fn(() => Promise.resolve([])),
        store: jest.fn(() => Promise.resolve()),
        remove: jest.fn(),
    };
    superstate.spaceManager.readPath = jest.fn(() => Promise.resolve("<svg />"));

    return { superstate, spaceManager };
};

describe("Superstate tag initialization", () => {
    it("restores filtered tag-space links while loading the persisted cache", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const folderPath = "Library";
        const tagPath = tagSpacePathFromTag("#reading");
        const filteredLink = `${tagPath}?filter`;
        const cachedSpaces = [
            {
                path: folderPath,
                cache: JSON.stringify({
                    path: folderPath,
                    name: "Library",
                    type: "folder",
                    space: { defPath: `${folderPath}/_space.md` },
                    metadata: { links: [filteredLink] },
                }),
            },
            {
                path: tagPath,
                cache: JSON.stringify({ path: tagPath, name: "reading", type: "tag", space: {}, metadata: {} }),
            },
        ];
        superstate.persister.loadAll = jest.fn((type: string) => Promise.resolve(type == "space" ? cachedSpaces : []));
        spaceManager.pathExists = jest.fn((_path: string) => true);

        await superstate.loadFromCache();

        expect(superstate.spacesIndex.get(folderPath).metadata.links).toEqual([filteredLink]);
        expect([...superstate.spacesMap.get(tagPath)]).toEqual([folderPath]);
        expect([...superstate.spacesMap.get(filteredLink)]).toEqual([]);
    });

    it("restores a filtered tag-space link under its canonical path after reloading a folder", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const folderPath = "Library";
        const tagPath = tagSpacePathFromTag("#reading");
        const filteredLink = `${tagPath}?filter`;
        superstate.spacesIndex.set(tagPath, { path: tagPath, type: "tag", metadata: {}, space: {} } as any);
        spaceManager.uriByString = jest.fn(() => ({ authority: "Library", path: "" }));
        spaceManager.spaceTypeByString = jest.fn(() => "folder");
        spaceManager.readPathCache = jest.fn((_path: string) => Promise.resolve(null as any));

        const reloaded = await superstate.reloadSpace(
            { path: folderPath, name: "Library", type: "folder", metadata: {}, space: {} } as any,
            { links: [filteredLink] },
        );

        expect(reloaded.metadata.links).toEqual([filteredLink]);
        expect([...superstate.spacesMap.get(tagPath)]).toEqual([folderPath]);
        expect([...superstate.spacesMap.get(filteredLink)]).toEqual([]);
    });

    it("keeps a canonical spacesMap entry when only a linked tag query changes", async () => {
        const { superstate } = createSuperstate();
        const folderPath = "Folder";
        const tagPath = tagSpacePathFromTag("#project");
        superstate.spacesMap.set(tagPath, new Set([folderPath]));
        await superstate.onSpaceDefinitionChanged(
            { path: folderPath, type: "folder", metadata: { links: [`${tagPath}?filter`] } } as any,
            { links: [tagPath] },
        );
        expect([...superstate.spacesMap.get(tagPath)]).toEqual([folderPath]);
        expect([...superstate.spacesMap.get(`${tagPath}?filter`)]).toEqual([]);
        expect([...superstate.spacesMap.getInverse(folderPath)]).toEqual([tagPath]);
    });
    it("removes an externally deleted folder section from every focus", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const path = "Projects/Removed";
        superstate.spacesIndex.set(path, { type: "folder", path, name: "Removed", metadata: {}, space: {} } as any);
        superstate.focuses = [
            { name: "Primary", paths: ["Before", path, "After"] },
            { name: "Secondary", paths: [path] },
        ] as any;
        superstate.dispatchEvent = jest.fn();

        await superstate.onSpaceDeleted(path);

        expect(spaceManager.saveFocuses).toHaveBeenCalledWith([
            expect.objectContaining({ paths: ["Before", "After"] }),
            expect.objectContaining({ paths: [] }),
        ]);
        expect(superstate.spacesIndex.has(path)).toBe(false);
        expect(superstate.dispatchEvent).toHaveBeenCalledWith("spaceDeleted", { path });
    });

    it("refreshes the old loaded tag space when metadata removes a file tag", async () => {
        const { superstate } = createSuperstate();
        const path = "Notes/Untagged.md";
        const tagSpace = tagSpacePathFromTag("#active");
        superstate.spacesIndex.set(tagSpace, { type: "tag", path: tagSpace, name: "active", metadata: {}, space: {} } as any);
        superstate.pathsIndex.set(path, {
            path,
            name: "Untagged",
            type: "file",
            subtype: "md",
            parent: "Notes",
            tags: ["#active"],
            spaces: ["Notes", tagSpace],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: false,
            metadata: {},
        } as any);
        (superstate as any).reloadPath = jest.fn(async () => {
            superstate.pathsIndex.set(path, {
                ...superstate.pathsIndex.get(path),
                tags: [],
                spaces: ["Notes"],
            });
            return true;
        });
        superstate.dispatchEvent = jest.fn();

        await superstate.onMetadataChange(path);

        expect(superstate.dispatchEvent).toHaveBeenCalledWith("spaceStateUpdated", { path: tagSpace });
    });

    it("refreshes loaded tag spaces and clears the tag index when a tagged file is deleted", async () => {
        const { superstate } = createSuperstate();
        const path = "Notes/Archived.md";
        const tagSpace = tagSpacePathFromTag("#archive");
        superstate.spacesIndex.set(tagSpace, { type: "tag", path: tagSpace, name: "archive", metadata: {}, space: {} } as any);
        superstate.pathsIndex.set(path, {
            path,
            name: "Archived",
            type: "file",
            subtype: "md",
            parent: "Notes",
            tags: ["#archive"],
            spaces: ["Notes"],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: false,
            metadata: {},
        } as any);
        superstate.tagsMap.set(path, new Set(["#archive"]));
        superstate.dispatchEvent = jest.fn();

        await superstate.onPathDeleted(path);

        expect(superstate.tagsMap.get(path).size).toBe(0);
        expect(superstate.dispatchEvent).toHaveBeenCalledWith("spaceStateUpdated", { path: tagSpace });
    });

    it("refreshes loaded parent tag spaces when a file with a nested tag is deleted", async () => {
        const { superstate } = createSuperstate();
        const path = "Notes/Nested.md";
        const parentTagSpace = tagSpacePathFromTag("#topic");
        superstate.spacesIndex.set(parentTagSpace, { type: "tag", path: parentTagSpace, name: "topic", metadata: {}, space: {} } as any);
        superstate.pathsIndex.set(path, {
            path,
            name: "Nested",
            type: "file",
            subtype: "md",
            parent: "Notes",
            tags: ["#topic/child"],
            spaces: ["Notes"],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: false,
            metadata: {},
        } as any);
        superstate.dispatchEvent = jest.fn();

        await superstate.onPathDeleted(path);

        expect(superstate.dispatchEvent).toHaveBeenCalledWith("spaceStateUpdated", { path: parentTagSpace });
    });

    it("refreshes a loaded old tag space when a tagged file is renamed", async () => {
        const { superstate } = createSuperstate();
        const oldPath = "Inbox/Draft.md";
        const newPath = "Notes/Draft.md";
        const tagSpace = tagSpacePathFromTag("#writing");
        superstate.spacesIndex.set(tagSpace, { type: "tag", path: tagSpace, name: "writing", metadata: {}, space: {} } as any);
        superstate.pathsIndex.set(oldPath, {
            path: oldPath,
            name: "Draft",
            type: "file",
            subtype: "md",
            parent: "Inbox",
            tags: ["#writing"],
            spaces: ["Inbox"],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: false,
            metadata: {},
        } as any);
        (superstate as any).reloadPath = jest.fn(async () => {
            superstate.pathsIndex.set(newPath, {
                ...superstate.pathsIndex.get(oldPath),
                path: newPath,
                parent: "Notes",
                spaces: ["Notes"],
            });
            return true;
        });
        superstate.dispatchEvent = jest.fn();

        await superstate.onPathRename(oldPath, newPath);

        expect(superstate.dispatchEvent).toHaveBeenCalledWith("spaceStateUpdated", { path: tagSpace });
    });

    it("handles a newly created root-level space without previous metadata", async () => {
        const { superstate } = createSuperstate();
        const space = {
            type: "folder",
            name: "Root Space",
            path: "Root Space",
            metadata: {},
            space: {
                folderPath: "Root Space",
                defPath: "Root Space/.space/context.json",
                notePath: "Root Space/Root Space.md",
            },
        } as any;

        await expect(superstate.onSpaceDefinitionChanged(space, null)).resolves.toBeUndefined();
    });

    it("loads folder rank-order from context metadata during initialization", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const rankedSpace = {
            type: "folder",
            name: "RankedSpace",
            path: "RankedSpace",
            metadata: {},
            space: {
                folderPath: "RankedSpace",
                defPath: "RankedSpace/.space/context.json",
                notePath: "RankedSpace/RankedSpace.md",
            },
        } as any;
        spaceManager.allSpaces = jest.fn(() => [rankedSpace]);
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "folder");
        spaceManager.spaceDefinitionForPath = jest.fn().mockResolvedValue({
            sort: { field: "rank", asc: true },
            "rank-order": ["RankedSpace/ChildA", "RankedSpace/ChildB"],
        });
        superstate.persister.cleanType = jest.fn();

        await superstate.initialize();

        expect(spaceManager.spaceDefinitionForPath).toHaveBeenCalledTimes(1);
        expect(superstate.spacesIndex.get("RankedSpace").metadata["rank-order"]).toEqual(["RankedSpace/ChildA", "RankedSpace/ChildB"]);
    });

    it("stores the detected folder note path when a folder space is cached", async () => {
        const { superstate, spaceManager } = createSuperstate();
        (superstate.ui as any).plugin = {
            app: {
                plugins: {
                    getPlugin: jest.fn(() => ({
                        settings: {
                            folderNoteName: "{{folder_name}}",
                            supportedFileTypes: ["md"],
                            hideFolderNote: true,
                        },
                    })),
                },
            },
        };
        spaceManager.childrenForSpace = jest.fn(() => ["Atlas/Atlas.md", "Atlas/Notes.md"]);
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "folder");

        const cached = await superstate.reloadSpace({
            type: "folder",
            name: "Atlas",
            path: "Atlas",
            metadata: {},
            space: { folderPath: "Atlas", defPath: "Atlas/.space/context.json", notePath: "" },
        }, {});

        expect(cached.space.notePath).toBe("Atlas/Atlas.md");
        expect(superstate.spacesIndex.get("Atlas").space.notePath).toBe("Atlas/Atlas.md");
    });

    it("does not trim folder rank-order while path indexes are being initialized", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const rankedSpace = {
            type: "folder",
            name: "Atlas",
            path: "Atlas",
            metadata: {},
            space: { folderPath: "Atlas", defPath: "Atlas/.space/context.json", notePath: "" },
        } as any;
        spaceManager.allSpaces = jest.fn(() => [rankedSpace]);
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "folder");
        spaceManager.spaceDefinitionForPath = jest.fn().mockResolvedValue({
            sort: { field: "rank", asc: true },
            "rank-order": ["Atlas/First", "Atlas/Second"],
        });
        superstate.persister.cleanType = jest.fn();
        (superstate as any).initializePaths = jest.fn(async () => {
            expect(superstate.getSpaceItems("Atlas")).toEqual([]);
            expect(superstate.spacesIndex.get("Atlas").metadata["rank-order"]).toEqual(["Atlas/First", "Atlas/Second"]);
        });

        await superstate.initialize();

        expect(superstate.spacesIndex.get("Atlas").metadata["rank-order"]).toEqual(["Atlas/First", "Atlas/Second"]);
    });

    it("does not create space states for Obsidian tags during initialization", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.readTags = jest.fn(() => ["#project"]);
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await superstate.initializeTags();

        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        expect(superstate.pathsIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
    });

    it("initializes spaces and paths with hidden items included in the index", async () => {
        const { superstate, spaceManager } = createSuperstate();
        (superstate as any).indexer.reload = jest.fn(() => Promise.resolve({}));
        spaceManager.allSpaces = jest.fn((): any[] => []);
        spaceManager.allPaths = jest.fn((): string[] => []);

        await superstate.initializeSpaces();
        await superstate.initializePaths();

        expect(spaceManager.allSpaces).toHaveBeenCalledWith(true);
        expect(spaceManager.allPaths).toHaveBeenCalledWith(undefined, true);
    });

    it("waits for space metadata persistence before completing path deletion", async () => {
        const { superstate, spaceManager } = createSuperstate();
        let finishSave: () => void;
        spaceManager.saveSpace = jest.fn(() => new Promise<void>((resolve) => {
            finishSave = resolve;
        }));
        superstate.spacesIndex.set("Atlas", {
            type: "folder",
            name: "Atlas",
            path: "Atlas",
            metadata: {
                "rank-order": ["Atlas/Removed.md", "Atlas/Kept.md"],
                links: [],
                pinned: [],
                "file-colors": {},
            },
            space: { folderPath: "Atlas", defPath: "Atlas/.space/context.json", notePath: "" },
        });
        superstate.pathsIndex.set("Atlas/Removed.md", {
            path: "Atlas/Removed.md",
            name: "Removed",
            type: "file",
            subtype: "md",
            parent: "Atlas",
            metadata: {},
            tags: [],
            spaces: ["Atlas"],
            hidden: false,
        });

        let completed = false;
        const deletion = superstate.onPathDeleted("Atlas/Removed.md").then(() => {
            completed = true;
        });
        await Promise.resolve();

        expect(completed).toBe(false);
        finishSave();
        await deletion;
        expect(completed).toBe(true);
        expect(superstate.spacesIndex.get("Atlas").metadata["rank-order"]).toEqual(["Atlas/Kept.md"]);
    });

    it("adds new tag spaces to the live space index", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await addTag(superstate, "project");

        expect(spaceManager.createSpace).not.toHaveBeenCalled();
        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
        expect(superstate.pathsIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        expect(superstate.pathStateForPath(tagSpacePathFromTag("#project"))).toEqual(
            expect.objectContaining({
                path: tagSpacePathFromTag("#project"),
                type: "space",
                subtype: "tag",
                sticker: "lucide//hash",
                color: "",
            }),
        );
    });

    it("syncs missing Obsidian tags into virtual tag spaces on demand", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.readTags = jest.fn(() => ["#project"]);
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        const visibleTagPaths = await syncTagSpacesFromObsidian(superstate);

        expect(visibleTagPaths).toEqual(new Set([tagSpacePathFromTag("#project")]));
        expect(spaceManager.createSpace).not.toHaveBeenCalled();
        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
    });

    it("keeps virtual tags without Obsidian records visible during tag sync", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.readTags = jest.fn((): string[] => []);
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");
        await addTag(superstate, "empty-tag");

        const visibleTagPaths = await syncTagSpacesFromObsidian(superstate);

        expect(visibleTagPaths).toContain(tagSpacePathFromTag("#empty-tag"));
        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#empty-tag"))).toBe(true);
    });

    it("merges source tag metadata into the target tag", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");
        const source = await addTag(superstate, "source");
        const target = await addTag(superstate, "target");
        await superstate.updateSpaceMetadata(source.path, {
            color: "red",
            sort: { field: "mtime", asc: false },
            pinned: ["Shared.md", "Source.md"],
            "rank-order": ["Source.md", "Shared.md"],
            "file-colors": { "Shared.md": "red", "Source.md": "orange" },
        });
        await superstate.updateSpaceMetadata(target.path, {
            color: "blue",
            sort: { field: "name", asc: true },
            pinned: ["Target.md", "Shared.md"],
            "rank-order": ["Target.md", "Shared.md"],
            "file-colors": { "Shared.md": "blue", "Target.md": "green" },
        });
        superstate.focuses = [
            { id: "main", name: "Main", paths: ["Before", source.path, "After"] },
            { id: "existing", name: "Existing target", paths: [source.path, "Middle", target.path] },
        ] as any;
        const parent = {
            type: "folder",
            path: "Parent",
            name: "Parent",
            metadata: {
                links: ["Before.md", source.path],
                pinned: [source.path],
                "rank-order": [source.path, "Before.md"],
                "file-colors": { [source.path]: "purple" },
            },
            space: {},
        } as any;
        superstate.spacesIndex.set(parent.path, parent);
        superstate.spacesMap.set(source.path, new Set([parent.path]));
        const dispatchEvent = jest.spyOn(superstate, "dispatchEvent");

        await mergeTagSpaceMetadata(superstate, source.path, target.path);

        expect(superstate.spacesIndex.get(target.path).metadata).toEqual(expect.objectContaining({
            color: "red",
            sort: { field: "mtime", asc: false },
            pinned: ["Shared.md", "Source.md", "Target.md"],
            "rank-order": ["Source.md", "Shared.md", "Target.md"],
            "file-colors": { "Shared.md": "red", "Source.md": "orange", "Target.md": "green" },
        }));
        expect(superstate.spacesIndex.has(source.path)).toBe(false);
        expect(superstate.persister.remove).toHaveBeenCalledWith(source.path, "space");
        expect(superstate.spacesMap.get(source.path).size).toBe(0);
        expect(superstate.spacesIndex.get(parent.path).metadata).toEqual(expect.objectContaining({
            links: ["Before.md", target.path],
            pinned: [target.path],
            "rank-order": [target.path, "Before.md"],
            "file-colors": { [target.path]: "purple" },
        }));
        expect(spaceManager.saveSpace).toHaveBeenCalledWith(parent.path, expect.any(Function));
        expect(superstate.focuses[0].paths).toEqual(["Before", target.path, "After"]);
        expect(superstate.focuses[1].paths).toEqual(["Middle", target.path]);
        expect(spaceManager.saveFocuses).toHaveBeenCalledWith(superstate.focuses);
        expect(dispatchEvent).toHaveBeenCalledWith("spaceDeleted", { path: source.path });
    });

    it("deletes tag-space metadata without removing Obsidian tags from file indexes", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");
        const tagSpace = await addTag(superstate, "obsolete");
        superstate.focuses = [{ id: "main", name: "Main", paths: [tagSpace.path, "Folder"] }] as any;
        superstate.tagsMap.set("Note.md", new Set(["#obsolete"]));

        await superstate.onTagDeleted("obsolete");

        expect(superstate.spacesIndex.has(tagSpace.path)).toBe(false);
        expect(spaceManager.saveFocuses).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ paths: ["Folder"] }),
        ]));
        expect(superstate.tagsMap.get("Note.md")).toEqual(new Set(["#obsolete"]));
        expect(superstate.persister.remove).toHaveBeenCalledWith(tagSpace.path, "space");
    });

    it("stores tag spaces only in compact space cache", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await addTag(superstate, "project");

        expect(superstate.persister.store).toHaveBeenCalledTimes(1);
        const [path, cache, type, version] = superstate.persister.store.mock.calls[0];
        expect(path).toBe(tagSpacePathFromTag("#project"));
        expect(type).toBe("space");
        expect(version).toBe("");
        expect(JSON.parse(cache)).toEqual({
            type: "tag",
            name: "project",
            path: tagSpacePathFromTag("#project"),
            metadata: {
                "rank-order": [],
                pinned: [],
                "file-colors": {},
            },
            space: {
                defPath: "",
                folderPath: "",
                notePath: "",
            },
        });
        expect(superstate.persister.store).not.toHaveBeenCalledWith(tagSpacePathFromTag("#project"), expect.any(String), "path");
    });

    it("stores tag color in space metadata", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await addTag(superstate, "project");
        superstate.persister.store.mockClear();

        await savePathColor(superstate, tagSpacePathFromTag("#project"), "var(--mk-color-teal)");

        expect(superstate.spacesIndex.get(tagSpacePathFromTag("#project")).metadata.color).toBe("var(--mk-color-teal)");
        expect(superstate.pathsIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        const stored = JSON.parse(superstate.persister.store.mock.calls[0][1]);
        expect(stored.metadata.color).toBe("var(--mk-color-teal)");
    });

    it("stores and displays an item color inside a tag space without filesystem metadata", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#project");
        const itemPath = "NoteFolder/Tagged.md";
        spaceManager.pathsForTag = jest.fn(() => [itemPath]);
        superstate.spacesIndex.set(tagPath, {
            type: "tag",
            name: "project",
            path: tagPath,
            metadata: {
                "file-colors": {},
                "rank-order": [],
            },
        } as any);
        superstate.pathsIndex.set(itemPath, {
            path: itemPath,
            name: "Tagged",
            parent: "NoteFolder",
            type: "file",
            subtype: "md",
            tags: ["#project"],
            spaces: [tagPath],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: false,
            color: "",
            sticker: "ui//file-text",
            metadata: {},
        });

        await savePathColor(superstate, itemPath, "#123456", tagPath);

        expect(superstate.spacesIndex.get(tagPath).metadata["file-colors"]).toEqual({
            [itemPath]: "#123456",
        });
        expect(superstate.getSpaceItems(tagPath)[0].color).toBe("#123456");
        expect(spaceManager.saveSpace).not.toHaveBeenCalled();
    });

    it("persists the home space color to its context.json metadata", async () => {
        const { superstate, spaceManager } = createSuperstate();
        superstate.spacesIndex.set("/", {
            type: "vault",
            name: "Home",
            path: "/",
            metadata: {},
            space: { path: "/", name: "Home", defPath: ".space/context.json", notePath: "", folderPath: "/" },
        } as any);
        superstate.pathsIndex.set("/", {
            path: "/",
            name: "Home",
            type: "space",
            subtype: "vault",
            tags: [],
            spaces: [],
            hidden: false,
            color: "",
            sticker: "ui//home",
            metadata: {},
        } as any);

        await savePathColor(superstate, "/", "#123456");

        expect(superstate.spacesIndex.get("/").metadata.color).toBe("#123456");
        expect(spaceManager.saveSpace).toHaveBeenCalledWith("/", expect.any(Function));
        const saveDefinition = (spaceManager.saveSpace as jest.Mock).mock.calls[0][1];
        expect(saveDefinition({ color: "", sticker: "" })).toEqual({ color: "#123456", sticker: "" });
    });

    it("stores color for every selected file in the same space", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.saveSpace = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 0)));
        superstate.spacesIndex.set("FolderSpace", {
            type: "folder",
            name: "FolderSpace",
            path: "FolderSpace",
            metadata: {
                "file-colors": {},
            },
            space: { path: "FolderSpace", name: "FolderSpace", defPath: "", notePath: "", folderPath: "" },
        } as any);
        ["FolderSpace/Alpha.md", "FolderSpace/Beta.md"].forEach((path) => {
            superstate.pathsIndex.set(path, {
                path,
                name: path.split("/").pop(),
                type: "file",
                subtype: "md",
                tags: [],
                spaces: ["FolderSpace"],
                hidden: false,
            });
        });

        await saveColorForPaths(superstate, ["FolderSpace/Alpha.md", "FolderSpace/Beta.md"], "#123456");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(superstate.spacesIndex.get("FolderSpace").metadata["file-colors"]).toEqual({
            "FolderSpace/Alpha.md": "#123456",
            "FolderSpace/Beta.md": "#123456",
        });
    });

    it("updates a file color in memory before the space save finishes", async () => {
        const { superstate, spaceManager } = createSuperstate();
        let resolveSave: () => void;
        spaceManager.saveSpace = jest.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveSave = resolve;
                }),
        );
        superstate.spacesIndex.set("FolderSpace", {
            type: "folder",
            name: "FolderSpace",
            path: "FolderSpace",
            metadata: {
                "file-colors": {},
            },
            space: { path: "FolderSpace", name: "FolderSpace", defPath: "", notePath: "", folderPath: "" },
        } as any);
        superstate.pathsIndex.set("FolderSpace/Alpha.md", {
            path: "FolderSpace/Alpha.md",
            name: "Alpha.md",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["FolderSpace"],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: false,
            color: "",
            sticker: "ui//file-text",
            metadata: {},
        });

        const colorSave = savePathColor(superstate, "FolderSpace/Alpha.md", "#123456");

        expect(superstate.pathsIndex.get("FolderSpace/Alpha.md").color).toBe("#123456");

        await Promise.resolve();
        resolveSave();
        await colorSave;
    });

    it("hydrates tag spaces from space cache and softly ignores old tag path cache", async () => {
        const { superstate } = createSuperstate();
        superstate.persister.loadAll = jest.fn((type: string) => {
            if (type == "space")
                return Promise.resolve([
                    {
                        path: tagSpacePathFromTag("#project"),
                        cache: JSON.stringify({
                            type: "tag",
                            name: "project",
                            path: tagSpacePathFromTag("#project"),
                            metadata: { color: "teal", sort: { field: "rank", asc: false }, "rank-order": ["Tagged.md"], pinned: [] },
                            space: { dbPath: "", defPath: "", folderPath: "", notePath: "" },
                        }),
                    },
                ]);
            if (type == "path")
                return Promise.resolve([
                    {
                        path: tagSpacePathFromTag("#project"),
                        cache: JSON.stringify({ path: tagSpacePathFromTag("#project"), type: "space", subtype: "tag", name: "project", parent: "", metadata: {}, tags: [], hidden: false, spaces: [], linkedSpaces: [] }),
                    },
                ]);
            return Promise.resolve([]);
        });

        await superstate.loadFromCache();

        expect(superstate.spacesIndex.get(tagSpacePathFromTag("#project")).metadata).toEqual({
            color: "teal",
            sort: { field: "rank", asc: false },
            "rank-order": ["Tagged.md"],
            pinned: [],
            "file-colors": {},
        });
        expect(superstate.spacesIndex.get(tagSpacePathFromTag("#project")).path).toBe(tagSpacePathFromTag("#project"));
        expect(superstate.pathsIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        expect(superstate.persister.remove).not.toHaveBeenCalledWith(tagSpacePathFromTag("#project"), "path");
    });

    it("prefers virtual tag space state over stale tag path cache for display names", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await addTag(superstate, "sample/category/item");
        superstate.pathsIndex.set(tagSpacePathFromTag("#sample/category/item"), {
            path: tagSpacePathFromTag("#sample/category/item"),
            name: tagSpacePathFromTag("#sample/category/item"),
            type: "space",
            subtype: "tag",
            tags: [],
            spaces: [],
            hidden: false,
        });

        expect(superstate.pathStateForPath(tagSpacePathFromTag("#sample/category/item")).name).toBe("sample/category/item");
    });

    it("exposes the parent tag space in hierarchical tag PathState", async () => {
        const { superstate } = createSuperstate();
        const parentPath = tagSpacePathFromTag("#sample/category");
        const childPath = tagSpacePathFromTag("#sample/category/item");
        const rootPath = tagSpacePathFromTag("#sample");
        superstate.spacesIndex.set(childPath, { path: childPath, name: "sample/category/item", type: "tag", metadata: {}, space: {} } as any);
        superstate.spacesIndex.set(rootPath, { path: rootPath, name: "sample", type: "tag", metadata: {}, space: {} } as any);

        expect(superstate.pathStateForPath(childPath)).toEqual(expect.objectContaining({
            path: childPath,
            parent: parentPath,
        }));
        expect(superstate.pathStateForPath(rootPath)).toEqual(expect.objectContaining({ parent: "" }));
    });

    it("trusts stored tag space names from cache without read-time normalization", async () => {
        const { superstate } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#sample/category/item");
        superstate.persister.loadAll = jest.fn((type: string) =>
            Promise.resolve(
                type == "space"
                    ? [
                          {
                              path: tagPath,
                              cache: JSON.stringify({
                                  type: "tag",
                                  name: tagPath,
                                  path: tagPath,
                                  metadata: {
                                      sort: { field: "rank", asc: true },
                                      "rank-order": [],
                                      pinned: [],
                                  },
                                  space: {
                                      defPath: "",
                                      notePath: "",
                                      folderPath: "",
                                      dbPath: "",
                                  },
                              }),
                          },
                      ]
                    : [],
            ),
        );

        await superstate.loadFromCache();

        expect(superstate.spacesIndex.get(tagPath).name).toBe(tagPath);
        expect(superstate.pathStateForPath(tagPath).name).toBe(tagPath);
    });

    it("stores tag space names normalized from tag paths", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#sample/category/item");
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await superstate.reloadSpace(
            {
                path: tagPath,
                name: tagPath,
                defPath: "",
                notePath: "",
                folderPath: "",
                dbPath: "",
            },
            undefined,
            true,
        );

        const stored = JSON.parse(superstate.persister.store.mock.calls[0][1]);
        expect(stored.name).toBe("sample/category/item");
    });

    it("does not add tag spaces when a file metadata reload introduces a new Obsidian tag", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");
        const dispatchEvent = jest.spyOn(superstate, "dispatchEvent");

        superstate.pathsIndex.set("Tagged.md", {
            path: "Tagged.md",
            name: "Tagged",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: [],
            hidden: false,
        });
        superstate.tagsMap.set("Tagged.md", new Set());

        await superstate.pathReloaded(
            "Tagged.md",
            {
                path: "Tagged.md",
                name: "Tagged",
                type: "file",
                subtype: "md",
                tags: ["#project"],
                spaces: [],
                hidden: false,
            },
            true,
            false,
        );

        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        expect(dispatchEvent).not.toHaveBeenCalledWith("spaceStateUpdated", { path: "spaces://$tags" });
    });

    it("reads tag space children from path tag cache", () => {
        const { superstate, spaceManager } = createSuperstate();
        superstate.pathsIndex.set("Tagged.md", {
            path: "Tagged.md",
            name: "Tagged",
            type: "file",
            subtype: "md",
            tags: ["#project"],
            spaces: [],
            hidden: false,
        });
        superstate.pathsIndex.set("Other.md", {
            path: "Other.md",
            name: "Other",
            type: "file",
            subtype: "md",
            tags: ["#other"],
            spaces: [],
            hidden: false,
        });
        superstate.tagsMap.set("Tagged.md", new Set(["#project"]));
        superstate.tagsMap.set("Other.md", new Set(["#other"]));

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => item.path)).toEqual(["Tagged.md"]);
        expect(spaceManager.pathsForTag).toHaveBeenCalledWith("#project");
    });

    it("shows a folder in a tag space when its Markdown folder note has the tag", () => {
        const { superstate } = createSuperstate();
        const folderPath = "Projects/Atlas";
        const notePath = `${folderPath}/Atlas.md`;
        superstate.pathsIndex.set(folderPath, {
            path: folderPath,
            name: "Atlas",
            type: "space",
            subtype: "folder",
            parent: "Projects",
            tags: [],
            spaces: ["Projects"],
            hidden: false,
        });
        superstate.pathsIndex.set(notePath, {
            path: notePath,
            name: "Atlas",
            type: "file",
            subtype: "md",
            parent: folderPath,
            tags: ["#project"],
            spaces: [folderPath],
            hidden: false,
        });
        superstate.spacesIndex.set(folderPath, {
            type: "folder",
            path: folderPath,
            name: "Atlas",
            metadata: {},
            space: { notePath },
        });
        superstate.tagsMap.set(notePath, new Set(["#project"]));
        superstate.spaceManager.pathsForTag.mockReturnValue([notePath]);

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => item.path)).toEqual([folderPath]);
    });

    it("keeps a tagged non-Markdown folder note as a file in a tag space", () => {
        const { superstate } = createSuperstate();
        const folderPath = "Projects/Board";
        const notePath = `${folderPath}/Board.canvas`;
        superstate.pathsIndex.set(notePath, {
            path: notePath,
            name: "Board",
            type: "file",
            subtype: "canvas",
            parent: folderPath,
            tags: ["#project"],
            spaces: [folderPath],
            hidden: false,
        });
        superstate.spacesIndex.set(folderPath, {
            type: "folder",
            path: folderPath,
            name: "Board",
            metadata: {},
            space: { notePath },
        });
        superstate.tagsMap.set(notePath, new Set(["#project"]));

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => item.path)).toEqual([notePath]);
    });

    it("shows hierarchical tags under their parent instead of their tagged files", () => {
        const { superstate, spaceManager } = createSuperstate();
        superstate.pathsIndex.set("Tagged.md", {
            path: "Tagged.md",
            name: "Tagged",
            type: "file",
            subtype: "md",
            tags: ["#sample/group/item"],
            spaces: [],
            hidden: false,
        });
        superstate.tagsMap.set("Tagged.md", new Set(["#sample/group/item"]));

        const childTagPath = tagSpacePathFromTag("#sample/group/item");
        expect(superstate.getSpaceItems(tagSpacePathFromTag("#sample/group")).map((item: any) => item.path)).toEqual([childTagPath]);
        expect(superstate.getSpaceItems(tagSpacePathFromTag("#sample/group"))[0].name).toBe("item");
        expect(superstate.getSpaceItems(childTagPath).map((item: any) => item.path)).toEqual(["Tagged.md"]);
        expect(spaceManager.pathsForTag).toHaveBeenCalledWith("#sample/group");
        expect(spaceManager.pathsForTag).toHaveBeenCalledWith("#sample/group/item");
    });

    it("does not create an empty nested tag space from a stale inverse-index key", async () => {
        const { superstate } = createSuperstate();
        const parentPath = tagSpacePathFromTag("#category");
        const childPath = tagSpacePathFromTag("#category/unused");
        superstate.tagsMap.invMap.set("#category/unused", new Set());

        expect(superstate.getSpaceItems(parentPath).map((item: any) => item.path)).not.toContain(childPath);
    });

    it("shows a stored empty nested tag space until it is deleted", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");
        const parent = await addTag(superstate, "workspace");
        const child = await addTag(superstate, "workspace/archive");

        expect(superstate.getSpaceItems(parent.path).map((item: any) => item.path)).toContain(child.path);

        await superstate.onTagDeleted(child.name);

        expect(superstate.spacesIndex.has(child.path)).toBe(false);
        expect(superstate.getSpaceItems(parent.path).map((item: any) => item.path)).not.toContain(child.path);
    });

    it("shows descendant-tagged files directly when grouping by sub-tags is disabled", () => {
        const { superstate } = createSuperstate();
        const parentTagPath = tagSpacePathFromTag("#topic");
        superstate.spacesIndex.set(parentTagPath, {
            type: "tag",
            name: "topic",
            path: parentTagPath,
            metadata: { sort: { subtags: false } },
            space: {},
        });
        superstate.pathsIndex.set("Nested.md", {
            path: "Nested.md",
            name: "Nested",
            type: "file",
            subtype: "md",
            tags: ["#topic/child"],
            spaces: [],
            hidden: false,
        });
        superstate.tagsMap.set("Nested.md", new Set(["#topic/child"]));

        expect(superstate.getSpaceItems(parentTagPath).map((item: any) => item.path)).toEqual(["Nested.md"]);
        expect(superstate.getSpaceItems(parentTagPath).some((item: any) => item.subtype == "tag")).toBe(false);
    });

    it("hides hidden tagged files inside tag spaces", () => {
        const { superstate } = createSuperstate();
        superstate.pathsIndex.set("Tagged.md", {
            path: "Tagged.md",
            name: "Tagged",
            type: "file",
            subtype: "md",
            tags: ["#project"],
            spaces: [],
            hidden: true,
        });
        superstate.tagsMap.set("Tagged.md", new Set(["#project"]));

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => item.path)).toEqual([]);
    });

    it("hides a hidden folder whose Markdown folder note has the tag", () => {
        const { superstate } = createSuperstate();
        const folderPath = "Projects/Hidden";
        const notePath = `${folderPath}/Hidden.md`;
        superstate.pathsIndex.set(folderPath, {
            path: folderPath,
            name: "Hidden",
            type: "space",
            subtype: "folder",
            parent: "Projects",
            tags: [],
            spaces: ["Projects"],
            hidden: true,
        });
        superstate.pathsIndex.set(notePath, {
            path: notePath,
            name: "Hidden",
            type: "file",
            subtype: "md",
            parent: folderPath,
            tags: ["#project"],
            spaces: [folderPath],
            hidden: false,
        });
        superstate.spacesIndex.set(folderPath, {
            type: "folder",
            path: folderPath,
            name: "Hidden",
            metadata: {},
            space: { notePath },
        });
        superstate.tagsMap.set(notePath, new Set(["#project"]));

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => item.path)).toEqual([]);
    });

    it("syncs tag space rank-order from the same item lookup used by the tree", () => {
        const { superstate } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#project");
        superstate.spacesIndex.set(tagPath, {
            type: "tag",
            name: "project",
            path: tagPath,
            metadata: {
                sort: { field: "rank", asc: true },
                "rank-order": [],
                pinned: [],
            },
            space: { path: tagPath, name: "project", defPath: "", notePath: "", folderPath: "", dbPath: "" },
        } as any);
        superstate.pathsIndex.set("Tagged.md", {
            path: "Tagged.md",
            name: "Tagged",
            type: "file",
            subtype: "md",
            tags: ["#project"],
            spaces: [],
            hidden: false,
        });
        superstate.tagsMap.set("Tagged.md", new Set(["#project"]));
        superstate.persister.store.mockClear();

        expect(superstate.getSpaceItems(tagPath).map((item: any) => item.path)).toEqual(["Tagged.md"]);

        expect(superstate.spacesIndex.get(tagPath).metadata["rank-order"]).toEqual(["Tagged.md"]);
        expect(JSON.parse(superstate.persister.store.mock.calls[0][1]).metadata["rank-order"]).toEqual(["Tagged.md"]);
    });

    it("uses tag metadata rank-order for tag space item ranks", () => {
        const { superstate } = createSuperstate();
        superstate.spacesIndex.set(tagSpacePathFromTag("#project"), {
            type: "tag",
            name: "project",
            path: tagSpacePathFromTag("#project"),
            metadata: {
                sort: { field: "rank", asc: true },
                "rank-order": ["Other.md", "Tagged.md"],
                pinned: [],
            },
            space: { path: tagSpacePathFromTag("#project"), name: "project", defPath: "", notePath: "" },
        } as any);
        superstate.pathsIndex.set("Tagged.md", {
            path: "Tagged.md",
            name: "Tagged",
            type: "file",
            subtype: "md",
            tags: ["#project"],
            spaces: [],
            hidden: false,
        });
        superstate.pathsIndex.set("Other.md", {
            path: "Other.md",
            name: "Other",
            type: "file",
            subtype: "md",
            tags: ["#project"],
            spaces: [],
            hidden: false,
        });
        superstate.tagsMap.set("Tagged.md", new Set(["#project"]));
        superstate.tagsMap.set("Other.md", new Set(["#project"]));

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => [item.path, item.rank])).toEqual([
            ["Tagged.md", 1],
            ["Other.md", 0],
        ]);
    });

    it("marks custom-sorted tag spaces as sortable when metadata is updated", async () => {
        const { superstate } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#project");
        superstate.spacesIndex.set(tagPath, {
            type: "tag",
            name: "project",
            path: tagPath,
            metadata: {
                sort: { field: "name", asc: true },
                "rank-order": [],
                pinned: [],
            },
            space: { path: tagPath, name: "project", defPath: "", notePath: "" },
        } as any);

        await superstate.updateSpaceMetadata(tagPath, {
            sort: { field: "rank", asc: true },
            "rank-order": ["Tagged.md"],
            pinned: [],
        });

        expect(isSpaceSortable(superstate.spacesIndex.get(tagPath), superstate.settings)).toBe(true);
    });

    it("returns linked tag spaces as folder children without requiring tag path cache", () => {
        const { superstate } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#sample/linked");
        superstate.spacesIndex.set("FolderSpace", {
            type: "folder",
            name: "FolderSpace",
            path: "FolderSpace",
            metadata: {
                links: [tagPath],
                "rank-order": [],
                pinned: [],
            },
            space: { path: "FolderSpace", name: "FolderSpace", defPath: "", notePath: "", folderPath: "" },
        } as any);
        superstate.spacesIndex.set(tagPath, {
            type: "tag",
            name: "sample/linked",
            path: tagPath,
            metadata: {
                "rank-order": [],
                pinned: [],
            },
            space: { path: tagPath, name: "sample/linked", defPath: "", notePath: "", folderPath: "" },
        } as any);
        superstate.spacesMap.set(tagPath, new Set(["FolderSpace"]));

        const items = superstate.getSpaceItems("FolderSpace");

        expect(items.map((item: any) => [item.path, item.subtype])).toEqual([[tagPath, "tag"]]);
        expect(superstate.pathsIndex.has(tagPath)).toBe(false);
    });

    it("leaves empty folder rank-order unset so manual sort falls back to name ascending", () => {
        const { superstate } = createSuperstate();
        superstate.spacesIndex.set("FolderSpace", {
            type: "folder",
            name: "FolderSpace",
            path: "FolderSpace",
            metadata: {
                sort: { field: "rank", asc: true },
                "rank-order": [],
                pinned: [],
            },
            space: { path: "FolderSpace", name: "FolderSpace", defPath: "", notePath: "", folderPath: "" },
        } as any);
        [
            ["FolderSpace/2 Gamma", "2 Gamma"],
            ["FolderSpace/0 Alpha", "0 Alpha"],
            ["FolderSpace/1 Beta", "1 Beta"],
        ].forEach(([path, name]) => {
            superstate.pathsIndex.set(path, {
                path,
                name,
                type: "space",
                subtype: "folder",
                tags: [],
                spaces: ["FolderSpace"],
                hidden: false,
            });
            superstate.spacesMap.set(path, new Set(["FolderSpace"]));
        });
        superstate.persister.store.mockClear();

        const items = superstate.getSpaceItems("FolderSpace");

        expect(superstate.spacesIndex.get("FolderSpace").metadata["rank-order"]).toEqual([]);
        expect(superstate.persister.store).not.toHaveBeenCalled();
        expect([...items].sort(spaceSortFn({ field: "rank", asc: true, group: true, recursive: false })).map((item: any) => item.name)).toEqual(["0 Alpha", "1 Beta", "2 Gamma"]);
    });

    it("shows indexed hidden children inside a hidden folder section without creating fallback cache entries", () => {
        const { superstate, spaceManager } = createSuperstate();
        superstate.spacesIndex.set("VaultRoot/HiddenFolder", {
            type: "folder",
            name: "HiddenFolder",
            path: "VaultRoot/HiddenFolder",
            metadata: {
                links: [],
                pinned: [],
            },
            space: { path: "VaultRoot/HiddenFolder", name: "HiddenFolder", defPath: "VaultRoot/HiddenFolder/.space/context.json", notePath: "", folderPath: "VaultRoot/HiddenFolder" },
        } as any);
        superstate.pathsIndex.set("VaultRoot/HiddenFolder", {
            path: "VaultRoot/HiddenFolder",
            name: "HiddenFolder",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            hidden: true,
            parent: "VaultRoot",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#123456",
            sticker: "lucide//folder",
            metadata: {},
        } as any);
        superstate.pathsIndex.set("VaultRoot/HiddenFolder/ChildFolder", {
            path: "VaultRoot/HiddenFolder/ChildFolder",
            name: "ChildFolder",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            hidden: true,
            parent: "VaultRoot/HiddenFolder",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#123456",
            sticker: "lucide//notebook",
            metadata: {},
        } as any);
        superstate.spacesIndex.set("VaultRoot/HiddenFolder/ChildFolder", {
            type: "folder",
            name: "ChildFolder",
            path: "VaultRoot/HiddenFolder/ChildFolder",
            metadata: {},
            space: { path: "VaultRoot/HiddenFolder/ChildFolder", name: "ChildFolder", defPath: "VaultRoot/HiddenFolder/ChildFolder/.space/context.json", notePath: "", folderPath: "VaultRoot/HiddenFolder/ChildFolder" },
        } as any);

        const items = superstate.getSpaceItems("VaultRoot/HiddenFolder");

        expect(items.map((item: any) => [item.path, item.name])).toEqual([["VaultRoot/HiddenFolder/ChildFolder", "ChildFolder"]]);
        expect(spaceManager.spaceInfoForPath).not.toHaveBeenCalledWith("VaultRoot/HiddenFolder/ChildFolder");
    });

    it("filters hidden children from normal folder spaces unless they are explicitly linked", () => {
        const { superstate } = createSuperstate();
        superstate.spacesIndex.set("FolderSpace", {
            type: "folder",
            name: "FolderSpace",
            path: "FolderSpace",
            metadata: {
                links: ["ExternalFolder/Linked.md"],
                pinned: [],
            },
            space: { path: "FolderSpace", name: "FolderSpace", defPath: "FolderSpace/.space/context.json", notePath: "", folderPath: "FolderSpace" },
        } as any);
        [
            ["FolderSpace/Visible.md", false, ["FolderSpace"], []],
            ["FolderSpace/Hidden.md", true, ["FolderSpace"], []],
            ["ExternalFolder/Linked.md", true, ["FolderSpace"], ["FolderSpace"]],
        ].forEach(([path, hidden, spaces, linkedSpaces]: any[]) => {
            superstate.pathsIndex.set(path, {
                path,
                name: path.split("/").pop()?.replace(".md", ""),
                type: "file",
                subtype: "md",
                tags: [],
                spaces,
                linkedSpaces,
                hidden,
                parent: path.startsWith("FolderSpace/") ? "FolderSpace" : "ExternalFolder",
                pinnedSpaces: [],
                color: "",
                sticker: "ui//file-text",
                metadata: {},
            } as any);
            spaces.forEach((space: string) => superstate.spacesMap.set(path, new Set([space])));
        });

        expect(superstate.getSpaceItems("FolderSpace").map((item: any) => item.path)).toEqual(["FolderSpace/Visible.md", "ExternalFolder/Linked.md"]);
    });

    it("refreshes folder display metadata after context.json is removed", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const events: any[] = [];
        superstate.dispatchEvent = jest.fn((event: string, payload: any) => {
            const eventPath = payload?.path ?? "FolderSpace";
            events.push({
                event,
                payload,
                metadata: superstate.spacesIndex.get("FolderSpace")?.metadata,
                display: superstate.pathsIndex.get(eventPath)
                    ? {
                          sticker: superstate.pathsIndex.get(eventPath)?.sticker,
                          color: superstate.pathsIndex.get(eventPath)?.color,
                      }
                    : undefined,
                sortable: isSpaceSortable(superstate.spacesIndex.get("FolderSpace"), superstate.settings),
            });
        });
        spaceManager.uriByString = jest.fn(() => ({ path: "FolderSpace" }));
        spaceManager.spaceTypeByString = jest.fn(() => "folder");
        spaceManager.spaceDefinitionForPath = jest.fn(() =>
            Promise.resolve({
                color: "",
                sticker: "",
                defaultColor: "",
                defaultSticker: "",
                sort: undefined,
                "rank-order": [],
                links: [],
                pinned: [],
                "file-colors": {},
            }),
        );
        spaceManager.readPathCache = jest.fn((path: string) =>
            Promise.resolve({
                metadata: {},
                name: path.split("/").pop() ?? path,
                type: path.includes(".") ? "file" : "space",
                subtype: path.includes(".") ? path.split(".").pop() : "folder",
                parent: "",
                tags: [],
                path,
                hidden: false,
                spaces: [],
                linkedSpaces: [],
            }),
        );
        (superstate as any).indexer.reload = jest.fn((job: any) => {
            const cache =
                job.path == "FolderSpace/Note.md"
                    ? {
                          path: "FolderSpace/Note.md",
                          name: "Note",
                          type: "file",
                          subtype: "md",
                          tags: [] as string[],
                          spaces: ["FolderSpace"],
                          linkedSpaces: [] as string[],
                          pinnedSpaces: [] as string[],
                          hidden: false,
                          parent: "FolderSpace",
                          color: "",
                          sticker: "ui//file-text",
                          metadata: {},
                      }
                    : {
                          path: "FolderSpace",
                          name: "FolderSpace",
                          type: "space",
                          subtype: "folder",
                          tags: [] as string[],
                          spaces: [] as string[],
                          linkedSpaces: [] as string[],
                          pinnedSpaces: [] as string[],
                          hidden: false,
                          parent: "",
                          color: "",
                          sticker: "lucide//folder-closed",
                          metadata: {},
                      };
            return Promise.resolve({ cache, changed: true });
        });
        superstate.spacesIndex.set("FolderSpace", {
            type: "folder",
            name: "FolderSpace",
            path: "FolderSpace",
            metadata: {
                sticker: "lucide//folder-closed",
                color: "#ffaa00",
                sort: { field: "rank", asc: true },
                links: [],
            },
            space: { path: "FolderSpace", name: "FolderSpace", defPath: "FolderSpace/.space/context.json", notePath: "", folderPath: "FolderSpace" },
        } as any);
        superstate.pathsIndex.set("FolderSpace", {
            path: "FolderSpace",
            name: "FolderSpace",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            hidden: false,
            parent: "",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#ffaa00",
            sticker: "lucide//folder-closed",
            metadata: {},
        } as any);
        superstate.pathsIndex.set("FolderSpace/Note.md", {
            path: "FolderSpace/Note.md",
            name: "Note",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["FolderSpace"],
            hidden: false,
            parent: "FolderSpace",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#ffaa00",
            sticker: "ui//file-text",
            metadata: {},
        } as any);
        superstate.spacesMap.set("FolderSpace/Note.md", new Set(["FolderSpace"]));

        await superstate.onMetadataChange("FolderSpace");

        expect(superstate.spacesIndex.get("FolderSpace").metadata).toEqual({
            color: "",
            sticker: "",
            defaultColor: "",
            defaultSticker: "",
            sort: undefined,
            "rank-order": [],
            links: [],
            pinned: [],
            "file-colors": {},
        });
        expect(superstate.pathsIndex.get("FolderSpace")).toMatchObject({ sticker: "lucide//folder-closed", color: "" });
        expect(superstate.pathsIndex.get("FolderSpace/Note.md")).toMatchObject({ sticker: "ui//file-text", color: "" });
        expect(isSpaceSortable(superstate.spacesIndex.get("FolderSpace"), superstate.settings)).toBe(false);
        superstate.getSpaceItems("FolderSpace");
        expect(superstate.spacesIndex.get("FolderSpace").metadata["rank-order"]).toEqual([]);
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: "pathStateUpdated",
                    payload: { path: "FolderSpace/Note.md" },
                    display: { sticker: "ui//file-text", color: "" },
                }),
                expect.objectContaining({
                    event: "pathStateUpdated",
                    payload: { path: "FolderSpace" },
                    display: { sticker: "lucide//folder-closed", color: "" },
                    sortable: false,
                }),
                expect.objectContaining({
                    event: "spaceStateUpdated",
                    payload: { path: "FolderSpace" },
                    metadata: expect.objectContaining({ sticker: "", color: "", sort: undefined }),
                    sortable: false,
                }),
            ]),
        );
    });

    it("unpins a file from its old folder space when moving it out", async () => {
        const { superstate } = createSuperstate();
        const oldPath = "VaultRoot/ParentFolder/PinnedFolder/example-note.md";
        const newPath = "VaultRoot/ParentFolder/example-note.md";

        superstate.spacesIndex.set("VaultRoot/ParentFolder/PinnedFolder", {
            type: "folder",
            name: "PinnedFolder",
            path: "VaultRoot/ParentFolder/PinnedFolder",
            metadata: {
                links: [],
                "rank-order": [],
                pinned: [oldPath],
                "file-colors": {},
            },
            space: { path: "VaultRoot/ParentFolder/PinnedFolder", name: "PinnedFolder", defPath: "VaultRoot/ParentFolder/PinnedFolder/.space/context.json", notePath: "", folderPath: "VaultRoot/ParentFolder/PinnedFolder" },
        } as any);
        superstate.pathsIndex.set(oldPath, {
            path: oldPath,
            name: "example-note.md",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["VaultRoot/ParentFolder/PinnedFolder"],
            hidden: false,
            parent: "VaultRoot/ParentFolder/PinnedFolder",
        });
        superstate.spacesMap.set(oldPath, new Set(["VaultRoot/ParentFolder/PinnedFolder"]));
        superstate.spaceManager.pathExists.mockResolvedValue(true);
        superstate.reloadPath = jest.fn(async (path: string) => {
            if (path == newPath) {
                superstate.pathsIndex.set(newPath, {
                    path: newPath,
                    name: "example-note.md",
                    type: "file",
                    subtype: "md",
                    tags: [],
                    spaces: ["VaultRoot/ParentFolder"],
                    hidden: false,
                    parent: "VaultRoot/ParentFolder",
                });
                superstate.spacesMap.set(newPath, new Set(["VaultRoot/ParentFolder"]));
            }
            return true;
        });

        await superstate.onPathRename(oldPath, newPath);

        expect(superstate.spacesIndex.get("VaultRoot/ParentFolder/PinnedFolder").metadata.pinned).toEqual([]);
        expect(superstate.spaceManager.saveSpace).toHaveBeenCalledWith("VaultRoot/ParentFolder/PinnedFolder", expect.any(Function));
    });

    it("preserves repeated separators when renaming a file in a manually sorted folder", async () => {
        const { superstate } = createSuperstate();
        const folderPath = "Reading";
        const oldPath = "Reading/Draft.md";
        const newPath = "Reading/Published.md";
        const folder = {
            type: "folder",
            name: "Reading",
            path: folderPath,
            metadata: {
                sort: { field: "rank", asc: true },
                links: [],
                "rank-order": [
                    "Reading/First.md",
                    SPACE_SEPARATOR_PATH,
                    oldPath,
                    SPACE_SEPARATOR_PATH,
                    "Reading/Last.md",
                ],
                pinned: [],
                "file-colors": {},
            },
            space: { folderPath },
        } as any;
        superstate.spacesIndex.set(folderPath, folder);
        superstate.pathsIndex.set(oldPath, {
            path: oldPath,
            name: "Draft",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: [folderPath],
            hidden: false,
            parent: folderPath,
        });
        superstate.spacesMap.set(oldPath, new Set([folderPath]));
        superstate.spaceManager.pathExists.mockResolvedValue(true);
        superstate.reloadPath = jest.fn(async (path: string) => {
            if (path == newPath) {
                superstate.pathsIndex.set(newPath, {
                    path: newPath,
                    name: "Published",
                    type: "file",
                    subtype: "md",
                    tags: [],
                    spaces: [folderPath],
                    hidden: false,
                    parent: folderPath,
                });
                superstate.spacesMap.set(newPath, new Set([folderPath]));
            }
            return true;
        });
        superstate.updateSpaceMetadata = jest.fn(async (path: string, metadata: any) => {
            superstate.spacesIndex.set(path, { ...superstate.spacesIndex.get(path), metadata });
            return superstate.spacesIndex.get(path);
        });

        await superstate.onPathRename(oldPath, newPath);

        expect(superstate.spacesIndex.get(folderPath).metadata["rank-order"]).toEqual([
            "Reading/First.md",
            SPACE_SEPARATOR_PATH,
            newPath,
            SPACE_SEPARATOR_PATH,
            "Reading/Last.md",
        ]);
    });

    it("keeps a renamed folder at the same manual-sort position", async () => {
        const { superstate } = createSuperstate();
        const oldPath = "Projects/Second";
        const newPath = "Projects/Renamed";
        const parent = {
            type: "folder",
            name: "Projects",
            path: "Projects",
            metadata: {
                sort: { field: "rank", asc: true },
                links: [],
                "rank-order": ["Projects/First", SPACE_SEPARATOR_PATH, oldPath, SPACE_SEPARATOR_PATH, "Projects/Third"],
                pinned: [],
                "file-colors": {},
            },
            space: { path: "Projects", name: "Projects", defPath: "Projects/.space/context.json", notePath: "", folderPath: "Projects" },
        } as any;
        const renamed = {
            type: "folder",
            name: "Second",
            path: oldPath,
            metadata: {},
            space: { path: oldPath, name: "Second", defPath: `${oldPath}/.space/context.json`, notePath: "", folderPath: oldPath },
        } as any;
        superstate.spacesIndex.set(parent.path, parent);
        superstate.spacesIndex.set(oldPath, renamed);
        superstate.focuses = [{ name: "Main", paths: ["Before", oldPath, "After"] }] as any;
        superstate.spaceManager.pathExists.mockResolvedValue(true);
        superstate.reloadSpace = jest.fn(async (space: any) => space);
        superstate.onSpaceDefinitionChanged = jest.fn(() => Promise.resolve());

        await superstate.onSpaceRenamed(oldPath, {
            ...renamed,
            name: "Renamed",
            path: newPath,
            space: { ...renamed.space, path: newPath, folderPath: newPath },
        });

        expect(superstate.spacesIndex.get(parent.path).metadata["rank-order"]).toEqual(["Projects/First", SPACE_SEPARATOR_PATH, newPath, SPACE_SEPARATOR_PATH, "Projects/Third"]);
        expect(superstate.spaceManager.saveSpace).toHaveBeenCalledWith(parent.path, expect.any(Function));
        expect(superstate.spaceManager.saveFocuses).toHaveBeenCalledWith([
            expect.objectContaining({ paths: ["Before", newPath, "After"] }),
        ]);
    });

    it("does not recreate a moved parent while processing descendant folder rename events", async () => {
        const { superstate } = createSuperstate();
        const oldPath = "Projects/Area/Notes";
        const newPath = "Projects/Renamed/Notes";
        const staleParent = {
            type: "folder",
            name: "Area",
            path: "Projects/Area",
            metadata: {
                links: [],
                "rank-order": [oldPath],
                pinned: [],
                "file-colors": {},
            },
            space: { folderPath: "Projects/Area" },
        } as any;
        const renamed = {
            type: "folder",
            name: "Notes",
            path: oldPath,
            metadata: {},
            space: { folderPath: oldPath },
        } as any;
        superstate.spacesIndex.set(staleParent.path, staleParent);
        superstate.spacesIndex.set(oldPath, renamed);
        superstate.spaceManager.pathExists.mockResolvedValue(false);
        superstate.reloadSpace = jest.fn(async (space: any) => space);
        superstate.onSpaceDefinitionChanged = jest.fn(() => Promise.resolve());

        await superstate.onSpaceRenamed(oldPath, {
            ...renamed,
            name: "Notes",
            path: newPath,
            space: { folderPath: newPath },
        });

        expect(superstate.spaceManager.saveSpace).not.toHaveBeenCalledWith(staleParent.path, expect.any(Function));
        expect(superstate.spacesIndex.get(staleParent.path).metadata["rank-order"]).toEqual([newPath]);
    });
});

describe("Superstate SVG handling", () => {
    it("does not treat SVG file reloads as image cache work", async () => {
        const { superstate } = createSuperstate();

        await superstate.pathReloaded(
            "icons/logo.svg",
            {
                path: "icons/logo.svg",
                name: "logo.svg",
                type: "file",
                subtype: "svg",
                metadata: {},
                tags: [],
                spaces: [],
                linkedSpaces: [],
                hidden: false,
                parent: "icons",
                color: "",
                sticker: "ui//file",
                pinnedSpaces: [],
            },
            true,
            true,
        );

        expect(superstate.spaceManager.readPath).not.toHaveBeenCalled();
        expect(superstate.persister.store).toHaveBeenCalledTimes(1);
        expect(superstate.persister.store).toHaveBeenCalledWith("icons/logo.svg", expect.any(String), "path");
    });
});
