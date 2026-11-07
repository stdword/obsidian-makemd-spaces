jest.mock("makemd-core", () => ({}), { virtual: true });

import { EXTERNAL_DRAG_NODE, dropExternalFilesAtProjection, dropExternalFilesInSpace, splitDroppedFileName, uniqueDroppedFileName } from "core/utils/dnd/externalFileDrop";
import { getProjection } from "core/utils/dnd/dragPath";
import * as spaces from "core/utils/superstate/spaces";

import i18n from "shared/i18n";

const fileFromText = (name: string, text = "x") => ({
    name,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
});

describe("splitDroppedFileName", () => {
    it("keeps a compound excalidraw suffix intact", () => {
        expect(splitDroppedFileName("Sketch.excalidraw.md")).toEqual({ name: "Sketch", suffix: ".excalidraw.md" });
    });

    it("splits a plain extension", () => {
        expect(splitDroppedFileName("Report.pdf")).toEqual({ name: "Report", suffix: ".pdf" });
    });

    it("treats a dotfile as a name without a suffix", () => {
        expect(splitDroppedFileName(".gitignore")).toEqual({ name: ".gitignore", suffix: "" });
    });

    it("handles an extensionless name", () => {
        expect(splitDroppedFileName("LICENSE")).toEqual({ name: "LICENSE", suffix: "" });
    });
});

describe("uniqueDroppedFileName", () => {
    it("keeps the name when nothing collides", () => {
        expect(uniqueDroppedFileName("Report.pdf", ["Other.pdf"])).toBe("Report.pdf");
    });

    it("appends a counter on collision", () => {
        expect(uniqueDroppedFileName("Report.pdf", ["Report.pdf"])).toBe("Report 1.pdf");
    });

    it("skips counters already taken", () => {
        expect(uniqueDroppedFileName("Report.pdf", ["Report.pdf", "Report 1.pdf", "Report 2.pdf"])).toBe("Report 3.pdf");
    });

    it("preserves a compound suffix while deduplicating", () => {
        expect(uniqueDroppedFileName("Sketch.excalidraw.md", ["Sketch.excalidraw.md"])).toBe("Sketch 1.excalidraw.md");
    });

    it("deduplicates an extensionless name", () => {
        expect(uniqueDroppedFileName("LICENSE", ["LICENSE"])).toBe("LICENSE 1");
    });
});

describe("dropExternalFilesInSpace", () => {
    const superstateFor = (spaceType: string, children: string[] = []) => {
        const writeToPath = jest.fn(async (_path: string, _content: any, _binary?: boolean): Promise<void> => undefined);
        const notify = jest.fn();
        return {
            superstate: {
                spacesIndex: new Map([["Inbox", { path: "Inbox", type: spaceType, metadata: {} }]]),
                spaceManager: {
                    childrenForPath: jest.fn(async (): Promise<string[]> => children),
                    writeToPath,
                },
                ui: { notify, error: jest.fn() },
                getSpaceItems: (): { path: string }[] => [],
            } as any,
            writeToPath,
            notify,
        };
    };

    // A rank-sorted folder that already holds Alpha and Beta, so a drop has a
    // real order to be inserted into.
    const rankedSpaceFor = (sortField = "rank", order = ["Inbox/Alpha.md", "Inbox/Beta.md"]) => {
        const saveSpaceMetadataValue = jest.fn(async (_superstate: any, _space: string, _key: string, _value: any): Promise<void> => undefined);
        jest.spyOn(spaces, "saveSpaceMetadataValue").mockImplementation(saveSpaceMetadataValue as any);
        const superstate = {
            spacesIndex: new Map([["Inbox", { path: "Inbox", type: "folder", metadata: { "rank-order": order, sort: { field: sortField } } }]]),
            spaceManager: {
                childrenForPath: jest.fn(async (): Promise<string[]> => order),
                writeToPath: jest.fn(async (): Promise<void> => undefined),
            },
            ui: { notify: jest.fn(), error: jest.fn() },
            settings: {},
            getSpaceItems: (): { path: string }[] => order.map((path) => ({ path })),
        } as any;
        return { superstate, saveSpaceMetadataValue };
    };

    const rowFor = (path: string, rank: number) => ({ space: "Inbox", path, item: { path }, rank, type: "file" }) as any;

    it("writes a dropped file into the target space as binary", async () => {
        const { superstate, writeToPath } = superstateFor("folder");
        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox");
        expect(writeToPath).toHaveBeenCalledTimes(1);
        expect(writeToPath.mock.calls[0][0]).toBe("Inbox/Report.pdf");
        expect(writeToPath.mock.calls[0][2]).toBe(true);
    });

    it("deduplicates against a file already in the folder", async () => {
        const { superstate, writeToPath } = superstateFor("folder", ["Inbox/Report.pdf"]);
        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox");
        expect(writeToPath.mock.calls[0][0]).toBe("Inbox/Report 1.pdf");
    });

    it("deduplicates identically named files within one drop", async () => {
        const { superstate, writeToPath } = superstateFor("folder");
        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf", "a"), fileFromText("Report.pdf", "b")], "Inbox");
        expect(writeToPath.mock.calls.map((call) => call[0])).toEqual(["Inbox/Report.pdf", "Inbox/Report 1.pdf"]);
    });

    it("refuses a space that has no folder to write into", async () => {
        const { superstate, writeToPath, notify } = superstateFor("tag");
        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox");
        expect(writeToPath).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith(i18n.notice.cannotCopyToVirtualSpace);
    });

    it("reports a failed write instead of failing silently", async () => {
        const { superstate, notify } = superstateFor("folder");
        superstate.spaceManager.writeToPath = jest.fn(async (): Promise<void> => {
            throw new Error("disk full");
        });
        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox");
        expect(notify).toHaveBeenCalledWith(`${i18n.notice.copyFileFailed}: Report.pdf`);
    });

    it("keeps copying the rest of the batch after one file fails", async () => {
        const { superstate, notify } = superstateFor("folder");
        const written: string[] = [];
        superstate.spaceManager.writeToPath = jest.fn(async (path: string): Promise<void> => {
            if (path.includes("Broken")) throw new Error("disk full");
            written.push(path);
        });
        await dropExternalFilesInSpace(superstate, [fileFromText("Broken.pdf"), fileFromText("Good.pdf")], "Inbox");
        expect(written).toEqual(["Inbox/Good.pdf"]);
        expect(notify).toHaveBeenCalledTimes(1);
    });

    it("ranks copies at the insertion line on a rank-sorted space", async () => {
        const { superstate, saveSpaceMetadataValue } = rankedSpaceFor();

        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox", { node: rowFor("Inbox/Alpha.md", 0), position: "bottom" });

        // Dropped below Alpha, so the copy sits between Alpha and Beta.
        expect(saveSpaceMetadataValue).toHaveBeenCalledWith(superstate, "Inbox", "rank-order", ["Inbox/Alpha.md", "Inbox/Report.pdf", "Inbox/Beta.md"]);
        jest.restoreAllMocks();
    });

    it("keeps a multi-file drop in its original order at the line", async () => {
        const { superstate, saveSpaceMetadataValue } = rankedSpaceFor();

        await dropExternalFilesInSpace(superstate, [fileFromText("One.pdf"), fileFromText("Two.pdf")], "Inbox", { node: rowFor("Inbox/Beta.md", 1), position: "top" });

        expect(saveSpaceMetadataValue).toHaveBeenCalledWith(superstate, "Inbox", "rank-order", ["Inbox/Alpha.md", "Inbox/One.pdf", "Inbox/Two.pdf", "Inbox/Beta.md"]);
        jest.restoreAllMocks();
    });

    it("does not rank a space that is not sorted by rank", async () => {
        const { superstate, saveSpaceMetadataValue } = rankedSpaceFor("name");

        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox", { node: rowFor("Inbox/Alpha.md", 0), position: "bottom" });

        expect(saveSpaceMetadataValue).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    it("does not rank when the drop was on a space row rather than a line", async () => {
        const { superstate, saveSpaceMetadataValue } = rankedSpaceFor();

        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox");

        expect(saveSpaceMetadataValue).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    it("moves a name that is already ranked instead of duplicating its entry", async () => {
        // A file of this name is already listed in the order; the copy is
        // deduplicated to `Report 1.pdf`, so the stale entry must not move.
        const { superstate, saveSpaceMetadataValue } = rankedSpaceFor("rank", ["Inbox/Alpha.md", "Inbox/Report.pdf", "Inbox/Beta.md"]);

        await dropExternalFilesInSpace(superstate, [fileFromText("Report.pdf")], "Inbox", { node: rowFor("Inbox/Beta.md", 2), position: "bottom" });

        expect(saveSpaceMetadataValue).toHaveBeenCalledWith(superstate, "Inbox", "rank-order", ["Inbox/Alpha.md", "Inbox/Report.pdf", "Inbox/Beta.md", "Inbox/Report 1.pdf"]);
        jest.restoreAllMocks();
    });

    it("ignores an empty drop", async () => {
        const { superstate, writeToPath, notify } = superstateFor("folder");
        await dropExternalFilesInSpace(superstate, [], "Inbox");
        expect(writeToPath).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
    });
});

describe("EXTERNAL_DRAG_NODE projection", () => {
    // Same canonicalisation the internal DnD applies: the bottom zone of row A
    // and the top zone of row B are one insertion point, always drawn as a
    // top line on B (bottom only at the very end of a list).
    const tree = [
        { id: "Inbox", parentId: null, depth: 0, index: 0, space: "/", path: "Inbox", item: { path: "Inbox" }, type: "space", childrenCount: 2, collapsed: false, rank: 0, sortable: true },
        { id: "Inbox/A.md", parentId: "Inbox", depth: 1, index: 1, space: "Inbox", path: "Inbox/A.md", item: { path: "Inbox/A.md", parent: "Inbox" }, type: "file", childrenCount: 0, collapsed: false, rank: 0, sortable: true },
        { id: "Inbox/B.md", parentId: "Inbox", depth: 1, index: 2, space: "Inbox", path: "Inbox/B.md", item: { path: "Inbox/B.md", parent: "Inbox" }, type: "file", childrenCount: 0, collapsed: false, rank: 1, sortable: true },
    ] as any;

    it("canonicalises the bottom zone of a row into a top line on the next row", () => {
        const projection = getProjection(EXTERNAL_DRAG_NODE, tree, [EXTERNAL_DRAG_NODE.path], 1, 1, 25, true, "copy", "Inbox");
        expect(projection?.overId).toBe("Inbox/B.md");
        expect(projection?.linePosition).toBe("top");
    });

    it("keeps a bottom line only at the end of the list", () => {
        const projection = getProjection(EXTERNAL_DRAG_NODE, tree, [EXTERNAL_DRAG_NODE.path], 2, 1, 25, true, "copy", "Inbox");
        expect(projection?.overId).toBe("Inbox/B.md");
        expect(projection?.linePosition).toBe("bottom");
    });

    it("projects a top line on a row from its top zone", () => {
        const projection = getProjection(EXTERNAL_DRAG_NODE, tree, [EXTERNAL_DRAG_NODE.path], 2, 1, 0, true, "copy", "Inbox");
        expect(projection?.overId).toBe("Inbox/B.md");
        expect(projection?.linePosition).toBe("top");
    });
});

describe("dropExternalFilesAtProjection", () => {
    const tree: any = [
        { id: "Archive", parentId: null, depth: 0, type: "space", path: "Archive", item: { path: "Archive", type: "space" }, childrenCount: 1, collapsed: false, rank: 0, sortable: true },
        { id: "Archive/Reports", parentId: "Archive", depth: 1, type: "space", path: "Archive/Reports", item: { path: "Archive/Reports", type: "space" }, childrenCount: 1, collapsed: false, rank: 0, sortable: true },
        { id: "Archive/Reports/Q4.md", parentId: "Archive/Reports", depth: 2, type: "file", path: "Archive/Reports/Q4.md", item: { path: "Archive/Reports/Q4.md", parent: "Archive/Reports" }, type2: "file", childrenCount: 0, collapsed: false, rank: 0, sortable: true },
    ];
    const superstateFor = () => {
        const writeToPath = jest.fn(async (_p: string, _c: any, _b?: boolean): Promise<void> => undefined);
        return {
            superstate: {
                spacesIndex: new Map([
                    ["Archive", { path: "Archive", type: "folder", metadata: {} }],
                    ["Archive/Reports", { path: "Archive/Reports", type: "folder", metadata: {} }],
                ]),
                spaceManager: { childrenForPath: jest.fn(async (): Promise<string[]> => []), writeToPath },
                ui: { notify: jest.fn(), error: jest.fn() },
                settings: {},
                getSpaceItems: (): { path: string }[] => [],
            } as any,
            writeToPath,
        };
    };

    it("copies into the projected parent, not the row under the cursor", async () => {
        const { superstate, writeToPath } = superstateFor();
        // Insertion AFTER the trailing folder: over row is the folder's last
        // child, but the projected parent is the folder's own parent.
        const projection = { depth: 1, overId: "Archive/Reports/Q4.md", parentId: "Archive", insert: false, droppable: true, copy: true, reorder: false, linePosition: "bottom" } as any;
        await dropExternalFilesAtProjection(superstate, [fileFromText("New.pdf")], projection, tree);
        expect(writeToPath.mock.calls[0][0]).toBe("Archive/New.pdf");
    });

    it("copies into the folder itself for an inside projection", async () => {
        const { superstate, writeToPath } = superstateFor();
        const projection = { depth: 2, overId: "Archive/Reports", parentId: "Archive/Reports", insert: false, droppable: true, copy: true, reorder: false } as any;
        await dropExternalFilesAtProjection(superstate, [fileFromText("New.pdf")], projection, tree);
        expect(writeToPath.mock.calls[0][0]).toBe("Archive/Reports/New.pdf");
    });

    it("does nothing without a projection", async () => {
        const { superstate, writeToPath } = superstateFor();
        await dropExternalFilesAtProjection(superstate, [fileFromText("New.pdf")], null, tree);
        expect(writeToPath).not.toHaveBeenCalled();
    });
});

describe("dropExternalFilesAtProjection rank at a raised insertion", () => {
    it("ranks right after the folder in the rank-sorted ancestor", async () => {
        const saveSpaceMetadataValue = jest.fn(async (_s: any, _sp: string, _k: string, _v: any): Promise<void> => undefined);
        jest.spyOn(spaces, "saveSpaceMetadataValue").mockImplementation(saveSpaceMetadataValue as any);
        const order = ["Archive/Alpha.md", "Archive/Reports", "Archive/Omega.md"];
        const tree: any = [
            { id: "Archive", parentId: null, depth: 0, type: "space", path: "Archive", item: { path: "Archive", type: "space" }, childrenCount: 3, collapsed: false, rank: 0, sortable: true },
            { id: "Archive/Reports", parentId: "Archive", depth: 1, type: "space", path: "Archive/Reports", item: { path: "Archive/Reports", type: "space" }, childrenCount: 1, collapsed: false, rank: 1, sortable: true },
            { id: "Archive/Reports/Q4.md", parentId: "Archive/Reports", depth: 2, type: "file", path: "Archive/Reports/Q4.md", item: { path: "Archive/Reports/Q4.md", parent: "Archive/Reports" }, childrenCount: 0, collapsed: false, rank: 0, sortable: false },
        ];
        const superstate = {
            spacesIndex: new Map([["Archive", { path: "Archive", type: "folder", metadata: { "rank-order": order, sort: { field: "rank" } } }]]),
            spaceManager: { childrenForPath: jest.fn(async (): Promise<string[]> => order), writeToPath: jest.fn(async (): Promise<void> => undefined) },
            ui: { notify: jest.fn(), error: jest.fn() },
            settings: {},
            getSpaceItems: (): { path: string }[] => order.map((path) => ({ path })),
        } as any;
        // Raised insertion: line drawn at Reports' last child, target level is Archive.
        const projection = { depth: 1, overId: "Archive/Reports/Q4.md", parentId: "Archive", insert: false, droppable: true, copy: true, reorder: false, sortable: true, linePosition: "bottom" } as any;

        await dropExternalFilesAtProjection(superstate, [fileFromText("New.pdf")], projection, tree);

        expect(saveSpaceMetadataValue).toHaveBeenCalledWith(superstate, "Archive", "rank-order", ["Archive/Alpha.md", "Archive/Reports", "Archive/New.pdf", "Archive/Omega.md"]);
        jest.restoreAllMocks();
    });
});
