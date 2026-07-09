import { getMultiProjection, getProjection } from "core/utils/dnd/dragPath";

describe("tag space drag projections", () => {
    const tagNode: any = {
        id: "spaces://#project",
        parentId: null,
        depth: 0,
        type: "space",
        path: "spaces://#project",
        item: { path: "spaces://#project", type: "space", subtype: "tag" },
        collapsed: false,
        childrenCount: 2,
        sortable: true,
        rank: 0,
    };
    const alphaNode: any = {
        id: "spaces://#project/Alpha.md",
        parentId: "spaces://#project",
        depth: 1,
        type: "file",
        path: "Alpha.md",
        item: { path: "Alpha.md", type: "file" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };
    const betaNode: any = {
        id: "spaces://#project/Beta.md",
        parentId: "spaces://#project",
        depth: 1,
        type: "file",
        path: "Beta.md",
        item: { path: "Beta.md", type: "file" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 1,
    };
    const externalNode: any = {
        id: "Projects/External.md",
        parentId: "Projects",
        depth: 1,
        type: "file",
        path: "Projects/External.md",
        item: { path: "Projects/External.md", type: "file" },
        collapsed: false,
        childrenCount: 0,
        sortable: true,
        rank: 0,
    };

    it("does not allow dragging an external item into a tag space", () => {
        const projection = getProjection(externalNode, [tagNode, alphaNode, betaNode, externalNode], ["Projects/External.md"], 0, 1, 14, true, "move", "Projects");

        expect(projection).toBeNull();
    });

    it("allows reordering an item already inside the same tag space", () => {
        const projection = getProjection(betaNode, [tagNode, alphaNode, betaNode], ["Beta.md"], 1, 1, 0, false, "move", "spaces://#project");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "spaces://#project",
            sortable: true,
            reorder: true,
        }));
    });

    it("does not allow dragging external multiple items into a tag space", () => {
        const projection = getMultiProjection([tagNode, alphaNode, betaNode, externalNode], ["Projects/External.md"], 1, 0, "link");

        expect(projection).toBeNull();
    });

    it("allows reordering multiple items already inside the same tag space", () => {
        const projection = getMultiProjection([tagNode, alphaNode, betaNode], ["Alpha.md", "Beta.md"], 1, 0, "move");

        expect(projection).toEqual(expect.objectContaining({
            parentId: "spaces://#project",
            droppable: true,
        }));
    });
});
