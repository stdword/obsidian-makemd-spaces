jest.mock("core/superstate/api", () => ({
    API: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("core/superstate/workers/indexer/indexer", () => ({
    Indexer: jest.fn().mockImplementation(() => ({
        reload: jest.fn(() => Promise.resolve({})),
    })),
}));

import { Superstate } from "core/superstate/superstate";
import { tagSpacePathFromTag } from "core/utils/strings";

const createSuperstate = () => {
    const spaceManager = {
        allPaths: jest.fn(() => ["icons/logo.svg"]),
        readTags: jest.fn((): string[] => []),
        spaceDefForSpace: jest.fn(() => Promise.resolve({})),
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
        expect(superstate.persister.store).toHaveBeenCalledWith(
            "icons/logo.svg",
            expect.any(String),
            "path",
        );
    });
});
