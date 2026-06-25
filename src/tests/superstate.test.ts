jest.mock("core/superstate/api", () => ({
    API: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("core/superstate/workers/indexer/indexer", () => ({
    Indexer: jest.fn().mockImplementation(() => ({
        reload: jest.fn(() => Promise.resolve({})),
    })),
}));

import { Superstate } from "core/superstate/superstate";
import { addTag } from "core/superstate/utils/tags";
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
    it("creates space states for tags read from the vault", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.readTags = jest.fn(() => ["#project"]);
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await superstate.initializeTags();

        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
        expect(superstate.pathsIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
    });

    it("adds new tag spaces to the live space index", async () => {
        const { superstate, spaceManager } = createSuperstate();
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");

        await addTag(superstate, "project");

        expect(spaceManager.createSpace).toHaveBeenCalledWith("#project", "/", null);
        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
        expect(superstate.pathsIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
    });

    it("creates configured tag parent folders before adding a new tag space", async () => {
        const { superstate, spaceManager } = createSuperstate();
        superstate.settings = { tagSpaceFolderPath: "Meta/Tags" };
        spaceManager.uriByString = jest.fn(() => ({}));
        spaceManager.spaceTypeByString = jest.fn(() => "tag");
        spaceManager.pathExists = jest.fn((path: string) => path == "/");

        await addTag(superstate, "project");

        expect(spaceManager.createSpace).toHaveBeenNthCalledWith(1, "Meta", "/", null);
        expect(spaceManager.createSpace).toHaveBeenNthCalledWith(2, "Tags", "Meta", null);
        expect(spaceManager.createSpace).toHaveBeenNthCalledWith(3, "#project", "Meta/Tags", null);
        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
    });

    it("adds tag spaces when a file metadata reload introduces a new tag", async () => {
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

        expect(superstate.spacesIndex.has(tagSpacePathFromTag("#project"))).toBe(true);
        expect(dispatchEvent).toHaveBeenCalledWith("spaceStateUpdated", { path: "spaces://$tags" });
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
