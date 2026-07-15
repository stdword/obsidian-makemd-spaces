import { getMultiProjection, getProjection } from "core/utils/dnd/dragPath";

describe("nested folder drag projections", () => {
    it("does not project a line above the first linked child already in place", () => {
        const parent: any = {
            id: "Talks",
            parentId: null,
            depth: 0,
            type: "space",
            item: { path: "Talks", type: "space" },
            collapsed: false,
            childrenCount: 2,
            sortable: true,
        };
        const active: any = {
            id: "Talks/Collections",
            parentId: parent.id,
            depth: 1,
            type: "space",
            space: "Talks",
            item: { path: "Collections", type: "space", linkedSpaces: ["Talks"] },
            sortable: true,
            rank: 0,
        };
        const sibling: any = { ...active, id: "Talks/Home", item: { path: "Home", type: "space" }, rank: 1 };

        expect(getProjection(active, [parent, active, sibling], [active.item.path], 0, 0, 29, false, "link", parent.item.path)).toBeNull();
    });

    it("projects the top of a separator as the bottom line of the sibling above", () => {
        const parent: any = { id: "Folder", parentId: null, depth: 0, type: "space", item: { path: "Folder", type: "space" } };
        const active: any = { id: "active", parentId: "Folder", depth: 1, type: "file", item: { path: "active" }, sortable: true, rank: 0 };
        const above: any = { id: "above", parentId: "Folder", depth: 1, type: "file", item: { path: "above" }, sortable: true, rank: 1 };
        const separator: any = { id: "separator", parentId: "Folder", depth: 1, type: "separator", sortable: false, rank: 2 };
        const below: any = { id: "below", parentId: "Folder", depth: 1, type: "file", item: { path: "below" }, sortable: true, rank: 3 };
        const items = [parent, active, above, separator, below];

        expect(getProjection(active, items, [active.item.path], 3, 1, 0, true, "move", "Folder")).toEqual(expect.objectContaining({
            overId: above.id,
            parentId: parent.id,
            sortable: true,
            linePosition: "bottom",
        }));
    });

    it("allows moving a nested file one level up into an ancestor folder", () => {
        const root: any = {
            id: "Workspace",
            parentId: null,
            depth: 0,
            type: "space",
            item: { path: "Workspace", type: "space", subtype: "folder" },
            collapsed: false,
            childrenCount: 1,
            sortable: true,
        };
        const nested: any = {
            id: "Workspace/Nested",
            parentId: "Workspace",
            depth: 1,
            type: "space",
            item: { path: "Workspace/Nested", parent: "Workspace", type: "space", subtype: "folder" },
            collapsed: false,
            childrenCount: 2,
            sortable: true,
        };
        const active: any = {
            id: "Workspace/Nested/First.md",
            parentId: "Workspace/Nested",
            depth: 2,
            type: "file",
            item: { path: "Workspace/Nested/First.md", parent: "Workspace/Nested", type: "file" },
            collapsed: false,
            childrenCount: 0,
            sortable: true,
            rank: 0,
        };
        const sibling: any = {
            ...active,
            id: "Workspace/Nested/Second.md",
            item: { path: "Workspace/Nested/Second.md", parent: "Workspace/Nested", type: "file" },
            rank: 1,
        };

        const projection = getProjection(active, [root, nested, active, sibling], [active.item.path], 3, 1, 29, true, "move", nested.item.path);

        expect(projection).toEqual(expect.objectContaining({
            parentId: "Workspace",
            droppable: true,
        }));
    });
});

describe("tag space drag projections", () => {
    const tagNode: any = {
        id: "spaces://#fixture",
        parentId: null,
        depth: 0,
        type: "space",
        path: "spaces://#fixture",
        item: { path: "spaces://#fixture", type: "space", subtype: "tag" },
        collapsed: false,
        childrenCount: 2,
        sortable: true,
        rank: 0,
    };
    const collapsedTagNode: any = {
        ...tagNode,
        collapsed: true,
    };
    const alphaNode: any = {
        id: "spaces://#fixture/EntryOne.md",
        parentId: "spaces://#fixture",
        depth: 1,
        type: "file",
        path: "EntryOne.md",
        item: { path: "EntryOne.md", type: "file" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };
    const betaNode: any = {
        id: "spaces://#fixture/EntryTwo.md",
        parentId: "spaces://#fixture",
        depth: 1,
        type: "file",
        path: "EntryTwo.md",
        item: { path: "EntryTwo.md", type: "file" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 1,
    };
    const externalNode: any = {
        id: "Source/Outside.md",
        parentId: "Source",
        depth: 1,
        type: "file",
        path: "Source/Outside.md",
        item: { path: "Source/Outside.md", type: "file" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };
    const rootFolderNode: any = {
        id: "RootFolder",
        parentId: null,
        depth: 0,
        type: "group",
        path: "RootFolder",
        item: { path: "RootFolder", type: "space", subtype: "folder", name: "RootFolder" },
        collapsed: false,
        childrenCount: 1,
        sortable: true,
        rank: 0,
    };
    const draggedFromTagNode: any = {
        id: "spaces://#collection/DraggedNote.md",
        parentId: "spaces://#collection",
        depth: 1,
        type: "file",
        path: "DraggedNote.md",
        space: "spaces://#collection",
        item: { path: "DraggedNote.md", parent: "RootFolder", type: "file", name: "Dragged Note" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };
    const draggedFromFolderNode: any = {
        id: "RootFolder/DraggedNote.md",
        parentId: "RootFolder",
        depth: 1,
        type: "file",
        path: "RootFolder/DraggedNote.md",
        space: "RootFolder",
        item: { path: "RootFolder/DraggedNote.md", parent: "RootFolder", type: "file", name: "Dragged Note" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };
    const childFolderNode: any = {
        id: "RootFolder/ChildFolder",
        parentId: "RootFolder",
        depth: 1,
        type: "space",
        path: "ChildFolder",
        item: { path: "ChildFolder", type: "space", subtype: "folder", name: "ChildFolder" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };
    const linkedTagNode: any = {
        id: "RootFolder/spaces://#linked-tag",
        parentId: "RootFolder",
        depth: 1,
        type: "space",
        path: "spaces://#linked-tag",
        item: { path: "spaces://#linked-tag", type: "space", subtype: "tag", name: "linked-tag" },
        collapsed: true,
        childrenCount: 3,
        sortable: true,
        rank: 1,
    };
    const linkedTagChildNode: any = {
        id: "RootFolder/spaces://#linked-tag/TaggedNote.md",
        parentId: "RootFolder/spaces://#linked-tag",
        depth: 2,
        type: "file",
        path: "TaggedNote.md",
        item: { path: "TaggedNote.md", type: "file", name: "Tagged Note" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };
    const focusFileNode: any = {
        id: "null/Anchor.md",
        parentId: null,
        depth: 0,
        type: "group",
        path: "Anchor.md",
        item: { path: "Anchor.md", type: "file", name: "Anchor" },
        collapsed: false,
        childrenCount: 0,
        sortable: false,
        rank: 1,
    };

    it("does not allow dragging an external item into a tag space", () => {
        const projection = getProjection(externalNode, [tagNode, alphaNode, betaNode, externalNode], ["Source/Outside.md"], 0, 1, 14, true, "move", "Source");

        expect(projection).toBeNull();
    });

    it("does not allow dragging an external item onto a collapsed tag space row", () => {
        const projection = getProjection(externalNode, [collapsedTagNode, externalNode], ["Source/Outside.md"], 0, 0, 13, true, "move", "Source");

        expect(projection).toBeNull();
    });

    it("does not allow dragging an external item onto a linked tag space row", () => {
        const projection = getProjection(externalNode, [rootFolderNode, linkedTagNode, externalNode], ["Source/Outside.md"], 1, 1, 13, true, "move", "Source");

        expect(projection).toBeNull();
    });

    it("does not allow dragging an external item onto linked tag space contents", () => {
        const projection = getProjection(externalNode, [rootFolderNode, linkedTagNode, linkedTagChildNode, externalNode], ["Source/Outside.md"], 2, 2, 13, true, "move", "Source");

        expect(projection).toBeNull();
    });

    it("allows reordering an item already inside the same tag space", () => {
        const projection = getProjection(betaNode, [tagNode, alphaNode, betaNode], ["EntryTwo.md"], 1, 1, 0, false, "move", "spaces://#fixture");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "spaces://#fixture",
            sortable: true,
            reorder: true,
        }));
    });

    it("treats linking a tag space into another tag space as a no-op", () => {
        const sourceTag: any = {
            ...tagNode,
            id: "spaces://#fixture/source",
            parentId: tagNode.id,
            depth: 1,
            item: { path: "spaces://#fixture/source", type: "space", subtype: "tag" },
            collapsed: true,
            childrenCount: 0,
        };
        const targetTag: any = {
            ...sourceTag,
            id: "spaces://#fixture/target",
            item: { path: "spaces://#fixture/target", type: "space", subtype: "tag" },
            rank: 1,
        };

        expect(getProjection(sourceTag, [tagNode, sourceTag, targetTag], [sourceTag.item.path], 2, 1, 13, true, "link", tagNode.item.path)).toBeNull();
    });

    it("does not allow dragging external multiple items into a tag space", () => {
        const projection = getMultiProjection([tagNode, alphaNode, betaNode, externalNode], ["Source/Outside.md"], 1, 0, "link");

        expect(projection).toBeNull();
    });

    it("allows reordering multiple items already inside the same tag space", () => {
        const projection = getMultiProjection([tagNode, alphaNode, betaNode], ["EntryOne.md", "EntryTwo.md"], 1, 0, "move");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "spaces://#fixture",
            droppable: true,
        }));
    });

    it("does not mark moving an item from a tag space into another space as reorder", () => {
        const draggedFromOtherFolder: any = {
            ...draggedFromTagNode,
            item: { ...draggedFromTagNode.item, parent: "OtherFolder" },
        };
        const projection = getProjection(draggedFromOtherFolder, [rootFolderNode, childFolderNode, draggedFromOtherFolder], ["DraggedNote.md"], 1, 1, 0, true, "move", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "RootFolder",
            reorder: false,
        }));
    });

    it("does not allow moving an item from a tag space into its existing folder", () => {
        const projection = getProjection(draggedFromTagNode, [rootFolderNode, childFolderNode, draggedFromTagNode], ["DraggedNote.md"], 0, 1, 13, true, "move", "spaces://#collection");

        expect(projection).toBeNull();
    });

    it("allows link drops into the item existing folder so the drop handler can notify", () => {
        const projection = getProjection(draggedFromTagNode, [rootFolderNode, childFolderNode, draggedFromTagNode], ["DraggedNote.md"], 0, 1, 13, true, "link", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "RootFolder",
            droppable: true,
        }));
    });

    it("allows link drops from a folder item into its own folder so the drop handler can notify", () => {
        const projection = getProjection(draggedFromFolderNode, [rootFolderNode, draggedFromFolderNode], ["RootFolder/DraggedNote.md"], 0, 1, 13, true, "link", "RootFolder");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "RootFolder",
            droppable: true,
        }));
    });

    it("does not allow moving an item from a tag space into its existing folder when parent metadata is missing", () => {
        const existingFolderNode: any = {
            ...rootFolderNode,
            id: "ExistingFolder",
            path: "ExistingFolder",
            item: { path: "ExistingFolder", type: "space", subtype: "folder", name: "ExistingFolder" },
        };
        const existingChildFromTagNode: any = {
            ...draggedFromTagNode,
            path: "ExistingFolder/ExistingNote.md",
            item: { path: "ExistingFolder/ExistingNote.md", type: "file", name: "Existing Note" },
        };
        const projection = getProjection(existingChildFromTagNode, [existingFolderNode, existingChildFromTagNode], ["ExistingFolder/ExistingNote.md"], 0, 0, 13, true, "move", "spaces://#collection");

        expect(projection).toBeNull();
    });

    it("does not allow bottom-zone movement from a tag space into the item existing folder", () => {
        const existingFolderNode: any = {
            ...rootFolderNode,
            id: "ExistingFolder",
            path: "ExistingFolder",
            item: { path: "ExistingFolder", type: "space", subtype: "folder", name: "ExistingFolder" },
            collapsed: false,
            childrenCount: 1,
        };
        const firstChildNode: any = {
            id: "ExistingFolder/FirstChild.md",
            parentId: "ExistingFolder",
            depth: 1,
            type: "file",
            path: "ExistingFolder/FirstChild.md",
            item: { path: "ExistingFolder/FirstChild.md", type: "file", name: "First Child" },
            collapsed: false,
            childrenCount: 0,
            sortable: true,
            rank: 0,
        };
        const existingChildFromTagNode: any = {
            ...draggedFromTagNode,
            path: "ExistingFolder/ExistingNote.md",
            item: { path: "ExistingFolder/ExistingNote.md", type: "file", name: "Existing Note" },
        };
        const projection = getProjection(existingChildFromTagNode, [existingFolderNode, firstChildNode, existingChildFromTagNode], ["ExistingFolder/ExistingNote.md"], 0, 0, 29, true, "move", "spaces://#collection");

        expect(projection).toBeNull();
    });

    it("treats hovering the middle of a root folder row as moving into that folder", () => {
        const draggedFromOtherFolder: any = {
            ...draggedFromTagNode,
            item: { ...draggedFromTagNode.item, parent: "OtherFolder" },
        };
        const projection = getProjection(draggedFromOtherFolder, [rootFolderNode, childFolderNode, draggedFromOtherFolder], ["DraggedNote.md"], 0, 0, 13, true, "move", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "RootFolder",
            sortable: false,
            reorder: false,
        }));
    });

    it("treats a depth-zero item from a tag space hovering a root folder row as moving into that folder", () => {
        const draggedFromOtherFolder: any = {
            ...draggedFromTagNode,
            depth: 0,
            item: { ...draggedFromTagNode.item, parent: "OtherFolder" },
        };
        const projection = getProjection(draggedFromOtherFolder, [rootFolderNode, childFolderNode, draggedFromOtherFolder], ["DraggedNote.md"], 0, 0, 13, true, "move", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "RootFolder",
            sortable: false,
            reorder: false,
        }));
    });

    it("does not allow moving an item from a tag space onto the middle of its existing root folder row", () => {
        const projection = getProjection(draggedFromTagNode, [rootFolderNode, childFolderNode, draggedFromTagNode], ["DraggedNote.md"], 0, 0, 13, true, "move", "spaces://#collection");

        expect(projection).toBeNull();
    });

    it("keeps focus-level insertion before a root folder from a tag space as a focus-level projection", () => {
        const projection = getProjection(draggedFromTagNode, [rootFolderNode, draggedFromTagNode], ["DraggedNote.md"], 0, 0, 0, true, "move", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: null,
            sortable: true,
            linePosition: "top",
        }));
    });

    it("keeps focus-level insertion after a root folder from a tag space as a focus-level projection", () => {
        const nextRootNode: any = {
            ...draggedFromTagNode,
            id: "NextRoot",
            parentId: null,
            depth: 0,
            path: "NextRoot",
            item: { path: "NextRoot", type: "space", subtype: "folder", name: "NextRoot" },
        };
        const projection = getProjection(draggedFromTagNode, [rootFolderNode, nextRootNode, draggedFromTagNode], ["DraggedNote.md"], 0, 0, 29, true, "move", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: null,
            sortable: true,
            linePosition: "top",
            overId: "NextRoot",
        }));
    });

    it("does not treat a focus-level file as a container when hovering its row", () => {
        const projection = getProjection(draggedFromTagNode, [rootFolderNode, focusFileNode, draggedFromTagNode], ["DraggedNote.md"], 1, 0, 13, true, "move", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: null,
            insert: false,
            linePosition: "top",
            overId: "null/Anchor.md",
        }));
    });

    it("keeps focus-level insertion before a focus-level file anchored to that file", () => {
        const projection = getProjection(draggedFromTagNode, [rootFolderNode, focusFileNode, draggedFromTagNode], ["DraggedNote.md"], 1, 0, 0, true, "move", "spaces://#collection");

        expect(projection).toEqual(expect.objectContaining({
            parentId: null,
            sortable: true,
            linePosition: "top",
            overId: "null/Anchor.md",
        }));
    });
});
