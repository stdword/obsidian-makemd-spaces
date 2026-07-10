jest.mock("core/superstate/api", () => ({
    API: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("core/superstate/workers/indexer/indexer", () => ({
    Indexer: jest.fn().mockImplementation(() => ({
        reload: jest.fn(() => Promise.resolve({})),
    })),
}));

import { Superstate } from "core/superstate/superstate";
import { savePathColor } from "core/utils/superstate/label";
import { isSpaceSortable, spaceSortFn } from "core/utils/superstate/spaces";
import { saveColorForPaths } from "core/utils/emoji";
import { addTag, syncTagSpacesFromObsidian } from "core/utils/superstate/tags";
import { tagSpacePathFromTag } from "schemas/builtin";

const createSuperstate = () => {
    const spaceManager = {
        allPaths: jest.fn(() => ["icons/logo.svg"]),
        allSpaces: jest.fn((): any[] => []),
        readTags: jest.fn((): string[] => []),
        pathsForTag: jest.fn((): string[] => []),
        pathExists: jest.fn((_path: string) => false),
        loadPath: jest.fn(),
        createSpace: jest.fn(() => Promise.resolve()),
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
        superstate.spacesIndex.set("Projects", {
            type: "folder",
            name: "Projects",
            path: "Projects",
            metadata: {
                "file-colors": {},
            },
            space: { path: "Projects", name: "Projects", defPath: "", notePath: "", folderPath: "" },
        } as any);
        ["Projects/Alpha.md", "Projects/Beta.md"].forEach((path) => {
            superstate.pathsIndex.set(path, {
                path,
                name: path.split("/").pop(),
                type: "file",
                subtype: "md",
                tags: [],
                spaces: ["Projects"],
                hidden: false,
            });
        });

        await saveColorForPaths(superstate, ["Projects/Alpha.md", "Projects/Beta.md"], "#123456");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(superstate.spacesIndex.get("Projects").metadata["file-colors"]).toEqual({
            "Projects/Alpha.md": "#123456",
            "Projects/Beta.md": "#123456",
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
        superstate.spacesIndex.set("Projects", {
            type: "folder",
            name: "Projects",
            path: "Projects",
            metadata: {
                "file-colors": {},
            },
            space: { path: "Projects", name: "Projects", defPath: "", notePath: "", folderPath: "" },
        } as any);
        superstate.pathsIndex.set("Projects/Alpha.md", {
            path: "Projects/Alpha.md",
            name: "Alpha.md",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["Projects"],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: false,
            color: "",
            sticker: "ui//file-text",
            metadata: {},
        });

        const colorSave = savePathColor(superstate, "Projects/Alpha.md", "#123456");

        expect(superstate.pathsIndex.get("Projects/Alpha.md").color).toBe("#123456");

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

    it("reads child tag items from parent tag spaces", () => {
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

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#sample/group")).map((item: any) => item.path)).toEqual(["Tagged.md"]);
        expect(spaceManager.pathsForTag).toHaveBeenCalledWith("#sample/group");
    });

    it("shows hidden tagged files inside tag spaces", () => {
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

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => item.path)).toEqual(["Tagged.md"]);
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
        superstate.spacesIndex.set("Projects", {
            type: "folder",
            name: "Projects",
            path: "Projects",
            metadata: {
                links: [tagPath],
                "rank-order": [],
                pinned: [],
            },
            space: { path: "Projects", name: "Projects", defPath: "", notePath: "", folderPath: "" },
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
        superstate.spacesMap.set(tagPath, new Set(["Projects"]));

        const items = superstate.getSpaceItems("Projects");

        expect(items.map((item: any) => [item.path, item.subtype])).toEqual([[tagPath, "tag"]]);
        expect(superstate.pathsIndex.has(tagPath)).toBe(false);
    });

    it("leaves empty folder rank-order unset so manual sort falls back to name ascending", () => {
        const { superstate } = createSuperstate();
        superstate.spacesIndex.set("Projects", {
            type: "folder",
            name: "Projects",
            path: "Projects",
            metadata: {
                sort: { field: "rank", asc: true },
                "rank-order": [],
                pinned: [],
            },
            space: { path: "Projects", name: "Projects", defPath: "", notePath: "", folderPath: "" },
        } as any);
        [
            ["Projects/2 Resources", "2 Resources"],
            ["Projects/0 Notes", "0 Notes"],
            ["Projects/1 Collections", "1 Collections"],
        ].forEach(([path, name]) => {
            superstate.pathsIndex.set(path, {
                path,
                name,
                type: "space",
                subtype: "folder",
                tags: [],
                spaces: ["Projects"],
                hidden: false,
            });
            superstate.spacesMap.set(path, new Set(["Projects"]));
        });
        superstate.persister.store.mockClear();

        const items = superstate.getSpaceItems("Projects");

        expect(superstate.spacesIndex.get("Projects").metadata["rank-order"]).toEqual([]);
        expect(superstate.persister.store).not.toHaveBeenCalled();
        expect([...items].sort(spaceSortFn({ field: "rank", asc: true, group: true, recursive: false })).map((item: any) => item.name)).toEqual(["0 Notes", "1 Collections", "2 Resources"]);
    });

    it("shows indexed hidden children inside a hidden folder section without creating fallback cache entries", () => {
        const { superstate, spaceManager } = createSuperstate();
        superstate.spacesIndex.set("Workspace/HiddenFolder", {
            type: "folder",
            name: "HiddenFolder",
            path: "Workspace/HiddenFolder",
            metadata: {
                links: [],
                pinned: [],
            },
            space: { path: "Workspace/HiddenFolder", name: "HiddenFolder", defPath: "Workspace/HiddenFolder/.space/context.json", notePath: "", folderPath: "Workspace/HiddenFolder" },
        } as any);
        superstate.pathsIndex.set("Workspace/HiddenFolder", {
            path: "Workspace/HiddenFolder",
            name: "HiddenFolder",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            hidden: true,
            parent: "Workspace",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#123456",
            sticker: "lucide//folder",
            metadata: {},
        } as any);
        superstate.pathsIndex.set("Workspace/HiddenFolder/ChildFolder", {
            path: "Workspace/HiddenFolder/ChildFolder",
            name: "ChildFolder",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            hidden: true,
            parent: "Workspace/HiddenFolder",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#123456",
            sticker: "lucide//notebook",
            metadata: {},
        } as any);
        superstate.spacesIndex.set("Workspace/HiddenFolder/ChildFolder", {
            type: "folder",
            name: "ChildFolder",
            path: "Workspace/HiddenFolder/ChildFolder",
            metadata: {},
            space: { path: "Workspace/HiddenFolder/ChildFolder", name: "ChildFolder", defPath: "Workspace/HiddenFolder/ChildFolder/.space/context.json", notePath: "", folderPath: "Workspace/HiddenFolder/ChildFolder" },
        } as any);

        const items = superstate.getSpaceItems("Workspace/HiddenFolder");

        expect(items.map((item: any) => [item.path, item.name])).toEqual([["Workspace/HiddenFolder/ChildFolder", "ChildFolder"]]);
        expect(spaceManager.spaceInfoForPath).not.toHaveBeenCalledWith("Workspace/HiddenFolder/ChildFolder");
    });

    it("filters hidden children from normal folder spaces unless they are explicitly linked", () => {
        const { superstate } = createSuperstate();
        superstate.spacesIndex.set("Projects", {
            type: "folder",
            name: "Projects",
            path: "Projects",
            metadata: {
                links: ["Archive/Linked.md"],
                pinned: [],
            },
            space: { path: "Projects", name: "Projects", defPath: "Projects/.space/context.json", notePath: "", folderPath: "Projects" },
        } as any);
        [
            ["Projects/Visible.md", false, ["Projects"], []],
            ["Projects/Hidden.md", true, ["Projects"], []],
            ["Archive/Linked.md", true, ["Projects"], ["Projects"]],
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
                parent: path.startsWith("Projects/") ? "Projects" : "Archive",
                pinnedSpaces: [],
                color: "",
                sticker: "ui//file-text",
                metadata: {},
            } as any);
            spaces.forEach((space: string) => superstate.spacesMap.set(path, new Set([space])));
        });

        expect(superstate.getSpaceItems("Projects").map((item: any) => item.path)).toEqual(["Projects/Visible.md", "Archive/Linked.md"]);
    });

    it("refreshes folder display metadata after context.json is removed", async () => {
        const { superstate, spaceManager } = createSuperstate();
        const events: any[] = [];
        superstate.dispatchEvent = jest.fn((event: string, payload: any) => {
            const eventPath = payload?.path ?? "Projects";
            events.push({
                event,
                payload,
                metadata: superstate.spacesIndex.get("Projects")?.metadata,
                display: superstate.pathsIndex.get(eventPath)
                    ? {
                          sticker: superstate.pathsIndex.get(eventPath)?.sticker,
                          color: superstate.pathsIndex.get(eventPath)?.color,
                      }
                    : undefined,
                sortable: isSpaceSortable(superstate.spacesIndex.get("Projects"), superstate.settings),
            });
        });
        spaceManager.uriByString = jest.fn(() => ({ path: "Projects" }));
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
                job.path == "Projects/Note.md"
                    ? {
                          path: "Projects/Note.md",
                          name: "Note",
                          type: "file",
                          subtype: "md",
                          tags: [] as string[],
                          spaces: ["Projects"],
                          linkedSpaces: [] as string[],
                          pinnedSpaces: [] as string[],
                          hidden: false,
                          parent: "Projects",
                          color: "",
                          sticker: "ui//file-text",
                          metadata: {},
                      }
                    : {
                          path: "Projects",
                          name: "Projects",
                          type: "space",
                          subtype: "folder",
                          tags: [] as string[],
                          spaces: [] as string[],
                          linkedSpaces: [] as string[],
                          pinnedSpaces: [] as string[],
                          hidden: false,
                          parent: "",
                          color: "",
                          sticker: "ui//folder",
                          metadata: {},
                      };
            return Promise.resolve({ cache, changed: true });
        });
        superstate.spacesIndex.set("Projects", {
            type: "folder",
            name: "Projects",
            path: "Projects",
            metadata: {
                sticker: "ui//folder",
                color: "#ffaa00",
                sort: { field: "rank", asc: true },
                links: [],
            },
            space: { path: "Projects", name: "Projects", defPath: "Projects/.space/context.json", notePath: "", folderPath: "Projects" },
        } as any);
        superstate.pathsIndex.set("Projects", {
            path: "Projects",
            name: "Projects",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            hidden: false,
            parent: "",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#ffaa00",
            sticker: "ui//folder",
            metadata: {},
        } as any);
        superstate.pathsIndex.set("Projects/Note.md", {
            path: "Projects/Note.md",
            name: "Note",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["Projects"],
            hidden: false,
            parent: "Projects",
            linkedSpaces: [],
            pinnedSpaces: [],
            color: "#ffaa00",
            sticker: "ui//file-text",
            metadata: {},
        } as any);
        superstate.spacesMap.set("Projects/Note.md", new Set(["Projects"]));

        await superstate.onMetadataChange("Projects");

        expect(superstate.spacesIndex.get("Projects").metadata).toEqual({
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
        expect(superstate.pathsIndex.get("Projects")).toMatchObject({ sticker: "ui//folder", color: "" });
        expect(superstate.pathsIndex.get("Projects/Note.md")).toMatchObject({ sticker: "ui//file-text", color: "" });
        expect(isSpaceSortable(superstate.spacesIndex.get("Projects"), superstate.settings)).toBe(false);
        superstate.getSpaceItems("Projects");
        expect(superstate.spacesIndex.get("Projects").metadata["rank-order"]).toEqual([]);
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: "pathStateUpdated",
                    payload: { path: "Projects/Note.md" },
                    display: { sticker: "ui//file-text", color: "" },
                }),
                expect.objectContaining({
                    event: "pathStateUpdated",
                    payload: { path: "Projects" },
                    display: { sticker: "ui//folder", color: "" },
                    sortable: false,
                }),
                expect.objectContaining({
                    event: "spaceStateUpdated",
                    payload: { path: "Projects" },
                    metadata: expect.objectContaining({ sticker: "", color: "", sort: undefined }),
                    sortable: false,
                }),
            ]),
        );
    });

    it("unpins a file from its old folder space when moving it out", async () => {
        const { superstate } = createSuperstate();
        const oldPath = "Workspace/Sample Area/0 Inbox/example-note.md";
        const newPath = "Workspace/Sample Area/example-note.md";

        superstate.spacesIndex.set("Workspace/Sample Area/0 Inbox", {
            type: "folder",
            name: "0 Inbox",
            path: "Workspace/Sample Area/0 Inbox",
            metadata: {
                links: [],
                "rank-order": [],
                pinned: [oldPath],
                "file-colors": {},
            },
            space: { path: "Workspace/Sample Area/0 Inbox", name: "0 Inbox", defPath: "Workspace/Sample Area/0 Inbox/.space/context.json", notePath: "", folderPath: "Workspace/Sample Area/0 Inbox" },
        } as any);
        superstate.pathsIndex.set(oldPath, {
            path: oldPath,
            name: "example-note.md",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["Workspace/Sample Area/0 Inbox"],
            hidden: false,
            parent: "Workspace/Sample Area/0 Inbox",
        });
        superstate.spacesMap.set(oldPath, new Set(["Workspace/Sample Area/0 Inbox"]));
        superstate.reloadPath = jest.fn(async (path: string) => {
            if (path == newPath) {
                superstate.pathsIndex.set(newPath, {
                    path: newPath,
                    name: "example-note.md",
                    type: "file",
                    subtype: "md",
                    tags: [],
                    spaces: ["Workspace/Sample Area"],
                    hidden: false,
                    parent: "Workspace/Sample Area",
                });
                superstate.spacesMap.set(newPath, new Set(["Workspace/Sample Area"]));
            }
            return true;
        });

        await superstate.onPathRename(oldPath, newPath);

        expect(superstate.spacesIndex.get("Workspace/Sample Area/0 Inbox").metadata.pinned).toEqual([]);
        expect(superstate.spaceManager.saveSpace).toHaveBeenCalledWith("Workspace/Sample Area/0 Inbox", expect.any(Function));
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
