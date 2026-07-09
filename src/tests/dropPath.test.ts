jest.mock(
    "makemd-core",
    () => ({
        SelectOptionType: {
            Submenu: "submenu",
            Separator: "separator",
            Radio: "radio",
        },
    }),
    { virtual: true },
);

import { dropPathInSpaceAtIndex, dropPathsInSpaceAtIndex } from "core/utils/dnd/dropPath";

describe("dropPathInSpaceAtIndex", () => {
    it("awaits tag space rank-order updates when reordering inside the same custom-sorted tag space", async () => {
        let resolveUpdate: () => void;
        const updateDone = new Promise<void>((resolve) => {
            resolveUpdate = resolve;
        });
        const tagSpacePath = "spaces://#project";
        const updateSpaceMetadata = jest.fn(() => updateDone);
        const superstate = {
            settings: {},
            pathsIndex: new Map([
                ["Alpha.md", { path: "Alpha.md", name: "Alpha", type: "file" }],
                ["Beta.md", { path: "Beta.md", name: "Beta", type: "file" }],
                ["Gamma.md", { path: "Gamma.md", name: "Gamma", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#project",
                        type: "tag",
                        metadata: {
                            sort: { field: "rank", asc: true },
                            "rank-order": ["Alpha.md", "Beta.md", "Gamma.md"],
                        },
                    },
                ],
            ]),
            updateSpaceMetadata,
        } as any;

        const drop = dropPathInSpaceAtIndex(superstate, "Gamma.md", tagSpacePath, tagSpacePath, 0);
        let settled = false;
        drop.then(() => {
            settled = true;
        });
        await Promise.resolve();

        expect(updateSpaceMetadata).toHaveBeenCalledWith(tagSpacePath, expect.objectContaining({
            "rank-order": ["Gamma.md", "Alpha.md", "Beta.md"],
        }));
        expect(settled).toBe(false);

        resolveUpdate();
        await drop;

        expect(settled).toBe(true);
    });

    it("does not add tags by dropping an external path into a tag space", async () => {
        const tagSpacePath = "spaces://#project";
        const superstate = {
            pathsIndex: new Map([
                ["External.md", { path: "External.md", name: "External", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#project",
                        type: "tag",
                        metadata: {
                            sort: { field: "rank", asc: true },
                            "rank-order": [],
                        },
                    },
                ],
            ]),
            spaceManager: {},
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
        } as any;

        await dropPathInSpaceAtIndex(superstate, "External.md", "Projects", tagSpacePath, 0);

        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
    });

    it("does not add tags by dropping external multiple paths into a tag space", async () => {
        const tagSpacePath = "spaces://#project";
        const addTag = jest.fn(() => Promise.resolve());
        const superstate = {
            pathsIndex: new Map([
                ["External.md", { path: "External.md", name: "External", type: "file" }],
            ]),
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#project",
                        type: "tag",
                        metadata: {
                            sort: { field: "rank", asc: true },
                            "rank-order": [],
                        },
                    },
                ],
            ]),
            spaceManager: {
                addTag,
            },
        } as any;

        await dropPathsInSpaceAtIndex(superstate, ["External.md"], tagSpacePath, 0, "link");

        expect(addTag).not.toHaveBeenCalled();
    });

    it("keeps explicit link-to-tag actions working outside drag and drop", async () => {
        const tagSpacePath = "spaces://#project";
        const addTag = jest.fn(() => Promise.resolve());
        const superstate = {
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#project",
                        type: "tag",
                    },
                ],
            ]),
            spaceManager: {
            },
        } as any;

        await dropPathsInSpaceAtIndex(superstate, ["External.md"], tagSpacePath, -1, "link");

        expect(superstate.spacesIndex.has(tagSpacePath)).toBe(true);
    });
});
