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
import { spaceSortFn } from "core/superstate/utils/spaces";
import { saveColorForPaths } from "core/utils/emoji";
import { addTag, syncTagSpacesFromObsidian } from "core/superstate/utils/tags";
import { tagSpacePathFromTag } from "core/utils/strings";

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
                effectiveLabel: {
                    sticker: "lucide//hash",
                    color: "",
                },
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
                outlinks: [],
                hidden: false,
                label: { sticker: "", color: "" },
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
            outlinks: [],
            hidden: false,
            label: { sticker: "", color: "" },
        });

        const colorSave = savePathColor(superstate, "Projects/Alpha.md", "#123456");

        expect(superstate.pathsIndex.get("Projects/Alpha.md").effectiveLabel.color).toBe("#123456");

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
                        cache: JSON.stringify({ path: tagSpacePathFromTag("#project"), type: "space", subtype: "tag", label: { sticker: "", color: "" } }),
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
        expect(superstate.persister.remove).not.toHaveBeenCalledWith(tagSpacePathFromTag("#project"), "path");
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

    it("returns linked tag spaces as folder children without requiring tag path cache", () => {
        const { superstate } = createSuperstate();
        const tagPath = tagSpacePathFromTag("#📖/brain");
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
            name: "📖/brain",
            path: tagPath,
            metadata: {
                "rank-order": [],
                pinned: [],
            },
            space: { path: tagPath, name: "📖/brain", defPath: "", notePath: "", folderPath: "" },
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
                outlinks: [],
                hidden: false,
                label: { sticker: "", color: "" },
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
        superstate.spacesIndex.set("Atlas/Obsidian", {
            type: "folder",
            name: "Obsidian",
            path: "Atlas/Obsidian",
            metadata: {
                links: [],
                pinned: [],
            },
            space: { path: "Atlas/Obsidian", name: "Obsidian", defPath: "Atlas/Obsidian/.space/context.json", notePath: "", folderPath: "Atlas/Obsidian" },
        } as any);
        superstate.pathsIndex.set("Atlas/Obsidian", {
            path: "Atlas/Obsidian",
            name: "Obsidian",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            outlinks: [],
            hidden: true,
            parent: "Atlas",
            label: { sticker: "lucide//folder", color: "" },
            effectiveLabel: { sticker: "lucide//folder", color: "#123456" },
            metadata: {},
        } as any);
        superstate.pathsIndex.set("Atlas/Obsidian/Notes", {
            path: "Atlas/Obsidian/Notes",
            name: "Notes",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            outlinks: [],
            hidden: true,
            parent: "Atlas/Obsidian",
            label: { sticker: "lucide//notebook", color: "" },
            effectiveLabel: { sticker: "lucide//notebook", color: "#123456" },
            metadata: {},
        } as any);
        superstate.spacesIndex.set("Atlas/Obsidian/Notes", {
            type: "folder",
            name: "Notes",
            path: "Atlas/Obsidian/Notes",
            metadata: {},
            space: { path: "Atlas/Obsidian/Notes", name: "Notes", defPath: "Atlas/Obsidian/Notes/.space/context.json", notePath: "", folderPath: "Atlas/Obsidian/Notes" },
        } as any);

        const items = superstate.getSpaceItems("Atlas/Obsidian");

        expect(items.map((item: any) => [item.path, item.name])).toEqual([["Atlas/Obsidian/Notes", "Notes"]]);
        expect(spaceManager.spaceInfoForPath).not.toHaveBeenCalledWith("Atlas/Obsidian/Notes");
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
                outlinks: [],
                hidden,
                parent: path.startsWith("Projects/") ? "Projects" : "Archive",
                label: { sticker: "", color: "" },
                effectiveLabel: { sticker: "ui//file-text", color: "" },
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
                effectiveLabel: superstate.pathsIndex.get(eventPath)?.effectiveLabel,
                sortable: superstate.spacesIndex.get("Projects")?.sortable,
            });
        });
        spaceManager.uriByString = jest.fn(() => ({ path: "Projects" }));
        spaceManager.spaceTypeByString = jest.fn(() => "folder");
        spaceManager.spaceDefForSpace = jest.fn(() =>
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
                label: { sticker: "", color: "" },
                parent: "",
                tags: [],
                path,
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
                          outlinks: [] as string[],
                          hidden: false,
                          parent: "Projects",
                          label: { sticker: "", color: "" },
                          metadata: { file: { extension: "md" } },
                      }
                    : {
                          path: "Projects",
                          name: "Projects",
                          type: "space",
                          subtype: "folder",
                          tags: [] as string[],
                          spaces: [] as string[],
                          outlinks: [] as string[],
                          hidden: false,
                          parent: "",
                          label: { sticker: "", color: "" },
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
            sortable: true,
            space: { path: "Projects", name: "Projects", defPath: "Projects/.space/context.json", notePath: "", folderPath: "Projects" },
        } as any);
        superstate.pathsIndex.set("Projects", {
            path: "Projects",
            name: "Projects",
            type: "space",
            subtype: "folder",
            tags: [],
            spaces: [],
            outlinks: [],
            hidden: false,
            parent: "",
            label: { sticker: "", color: "" },
            effectiveLabel: { sticker: "ui//folder", color: "#ffaa00" },
            metadata: {},
        } as any);
        superstate.pathsIndex.set("Projects/Note.md", {
            path: "Projects/Note.md",
            name: "Note",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["Projects"],
            outlinks: [],
            hidden: false,
            parent: "Projects",
            label: { sticker: "", color: "" },
            effectiveLabel: { sticker: "ui//file-text", color: "#ffaa00" },
            metadata: { file: { extension: "md" } },
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
        expect(superstate.pathsIndex.get("Projects").effectiveLabel).toEqual({
            sticker: "ui//folder",
            color: "",
        });
        expect(superstate.pathsIndex.get("Projects/Note.md").effectiveLabel).toEqual({
            sticker: "ui//file-text",
            color: "",
        });
        expect(superstate.spacesIndex.get("Projects").sortable).toBe(false);
        superstate.getSpaceItems("Projects");
        expect(superstate.spacesIndex.get("Projects").metadata["rank-order"]).toEqual([]);
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: "pathStateUpdated",
                    payload: { path: "Projects/Note.md" },
                    effectiveLabel: { sticker: "ui//file-text", color: "" },
                }),
                expect.objectContaining({
                    event: "pathStateUpdated",
                    payload: { path: "Projects" },
                    effectiveLabel: { sticker: "ui//folder", color: "" },
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
        const oldPath = "Atlas/AI/0 Notes/работа с агентами при программировании.md";
        const newPath = "Atlas/AI/работа с агентами при программировании.md";

        superstate.spacesIndex.set("Atlas/AI/0 Notes", {
            type: "folder",
            name: "0 Notes",
            path: "Atlas/AI/0 Notes",
            metadata: {
                links: [],
                "rank-order": [],
                pinned: [oldPath],
                "file-colors": {},
            },
            space: { path: "Atlas/AI/0 Notes", name: "0 Notes", defPath: "Atlas/AI/0 Notes/.space/context.json", notePath: "", folderPath: "Atlas/AI/0 Notes" },
        } as any);
        superstate.pathsIndex.set(oldPath, {
            path: oldPath,
            name: "работа с агентами при программировании.md",
            type: "file",
            subtype: "md",
            tags: [],
            spaces: ["Atlas/AI/0 Notes"],
            outlinks: [],
            hidden: false,
            parent: "Atlas/AI/0 Notes",
            label: { sticker: "", color: "" },
        });
        superstate.spacesMap.set(oldPath, new Set(["Atlas/AI/0 Notes"]));
        superstate.reloadPath = jest.fn(async (path: string) => {
            if (path == newPath) {
                superstate.pathsIndex.set(newPath, {
                    path: newPath,
                    name: "работа с агентами при программировании.md",
                    type: "file",
                    subtype: "md",
                    tags: [],
                    spaces: ["Atlas/AI"],
                    outlinks: [],
                    hidden: false,
                    parent: "Atlas/AI",
                    label: { sticker: "", color: "" },
                });
                superstate.spacesMap.set(newPath, new Set(["Atlas/AI"]));
            }
            return true;
        });

        await superstate.onPathRename(oldPath, newPath);

        expect(superstate.spacesIndex.get("Atlas/AI/0 Notes").metadata.pinned).toEqual([]);
        expect(superstate.spaceManager.saveSpace).toHaveBeenCalledWith("Atlas/AI/0 Notes", expect.any(Function));
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
