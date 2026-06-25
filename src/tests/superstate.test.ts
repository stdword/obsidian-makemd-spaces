jest.mock("core/superstate/api", () => ({
    API: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("core/superstate/workers/indexer/indexer", () => ({
    Indexer: jest.fn().mockImplementation(() => ({
        reload: jest.fn(() => Promise.resolve({})),
    })),
}));

import { Superstate } from "core/superstate/superstate";
import { savePathColor } from "core/superstate/utils/label";
import { addTag, syncTagSpacesFromObsidian } from "core/superstate/utils/tags";
import { tagSpacePathFromTag } from "core/utils/strings";

const createSuperstate = () => {
    const spaceManager = {
        allPaths: jest.fn(() => ["icons/logo.svg"]),
        readTags: jest.fn((): string[] => []),
        pathsForTag: jest.fn((): string[] => []),
        pathExists: jest.fn((_path: string) => false),
        loadPath: jest.fn(),
        createSpace: jest.fn(() => Promise.resolve()),
        spaceDefForSpace: jest.fn(() => Promise.resolve({})),
        spaceInfoForPath: jest.fn((path: string) => ({ path, name: path.replace("spaces://#", "") })),
        readPathCache: jest.fn((path: string) =>
            Promise.resolve({
                metadata: {},
                label: { sticker: "", color: "" },
                parent: "",
                tags: [],
                path,
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
        const [path, cache, type] = superstate.persister.store.mock.calls[0];
        expect(path).toBe(tagSpacePathFromTag("#project"));
        expect(type).toBe("space");
        expect(JSON.parse(cache)).toEqual({
            type: "tag",
            name: "project",
            path: tagSpacePathFromTag("#project"),
            metadata: {
                sort: {
                    field: "rank",
                    asc: true,
                },
                "rank-order": [],
                pinned: [],
            },
            space: {
                dbPath: "",
                defPath: "",
                folderPath: "",
                notePath: "",
            },
        });
        expect(superstate.persister.store).not.toHaveBeenCalledWith(tagSpacePathFromTag("#project"), expect.any(String), "path");
    });

    it("does not persist context cache for tag spaces", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await addTag(superstate, "project");

        await expect(superstate.reloadContext(superstate.spacesIndex.get(tagSpacePathFromTag("#project")).space)).resolves.toBe(false);
        expect(superstate.contextsIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        expect(superstate.persister.store).not.toHaveBeenCalledWith(tagSpacePathFromTag("#project"), expect.any(String), "context");
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

    it("hydrates tag spaces from space cache and softly ignores old tag path and context cache", async () => {
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
                        cache: JSON.stringify({ path: tagSpacePathFromTag("#project"), type: "space", subtype: "tag", label: { sticker: "", color: "" } }),
                    },
                ]);
            if (type == "context")
                return Promise.resolve([
                    {
                        path: tagSpacePathFromTag("#project"),
                        cache: JSON.stringify({ path: tagSpacePathFromTag("#project"), contextTable: {}, dbExists: true }),
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
        expect(superstate.spacesIndex.get(tagSpacePathFromTag("#project")).space.path).toBe(tagSpacePathFromTag("#project"));
        expect(superstate.pathsIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        expect(superstate.contextsIndex.has(tagSpacePathFromTag("#project"))).toBe(false);
        expect(superstate.persister.remove).not.toHaveBeenCalledWith(tagSpacePathFromTag("#project"), "path");
        expect(superstate.persister.remove).not.toHaveBeenCalledWith(tagSpacePathFromTag("#project"), "context");
    });

    it("prefers virtual tag space state over stale tag path cache for display names", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await addTag(superstate, "📖/psy/self");
        superstate.pathsIndex.set(tagSpacePathFromTag("#📖/psy/self"), {
            path: tagSpacePathFromTag("#📖/psy/self"),
            name: tagSpacePathFromTag("#📖/psy/self"),
            type: "space",
            subtype: "tag",
            tags: [],
            spaces: [],
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
        });

        expect(superstate.pathStateForPath(tagSpacePathFromTag("#📖/psy/self")).name).toBe("📖/psy/self");
    });

    it("trusts stored tag space names from cache without read-time normalization", async () => {
        const { superstate } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#📖/psy/self");
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
        const tagPath = tagSpacePathFromTag("#📖/psy/self");
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
        expect(stored.name).toBe("📖/psy/self");
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
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
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
                outlinks: [],
                hidden: false,
                label: { sticker: "", color: "" },
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
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
        });
        superstate.pathsIndex.set("Other.md", {
            path: "Other.md",
            name: "Other",
            type: "file",
            subtype: "md",
            tags: ["#other"],
            spaces: [],
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
        });
        superstate.tagsMap.set("Tagged.md", new Set(["#project"]));
        superstate.tagsMap.set("Other.md", new Set(["#other"]));

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => item.path)).toEqual(["Tagged.md"]);
        expect(spaceManager.pathsForTag).toHaveBeenCalledWith("#project");
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
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
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
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
        });
        superstate.pathsIndex.set("Other.md", {
            path: "Other.md",
            name: "Other",
            type: "file",
            subtype: "md",
            tags: ["#project"],
            spaces: [],
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
        });
        superstate.tagsMap.set("Tagged.md", new Set(["#project"]));
        superstate.tagsMap.set("Other.md", new Set(["#project"]));

        expect(superstate.getSpaceItems(tagSpacePathFromTag("#project")).map((item: any) => [item.path, item.rank])).toEqual([
            ["Tagged.md", 1],
            ["Other.md", 0],
        ]);
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
                metadata: {
                    file: {
                        filename: "logo.svg",
                        extension: "svg",
                    },
                },
                tags: [],
                spaces: [],
                outlinks: [],
            },
            true,
            true,
        );

        expect(superstate.imagesCache.has("logo.svg")).toBe(false);
        expect(superstate.spaceManager.readPath).not.toHaveBeenCalled();
        expect(superstate.persister.store).toHaveBeenCalledTimes(1);
        expect(superstate.persister.store).toHaveBeenCalledWith("icons/logo.svg", expect.any(String), "path");
    });
});
