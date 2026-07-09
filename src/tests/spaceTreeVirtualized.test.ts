import { highlightContainerIdForDrag } from "core/react/components/Navigator/SpaceTree/SpaceTreeVirtualized";

describe("highlightContainerIdForDrag", () => {
    const tagNode: any = {
        id: "spaces://#fixture-tag",
        parentId: null,
        type: "group",
        item: { path: "spaces://#fixture-tag", type: "space", subtype: "tag" },
        collapsed: false,
    };
    const tagChildNode: any = {
        id: "spaces://#fixture-tag/DraggedNote.md",
        parentId: "spaces://#fixture-tag",
        type: "file",
        item: { path: "TargetFolder/DraggedNote.md", type: "file" },
    };
    const rootFolderNode: any = {
        id: "RootFolder",
        parentId: null,
        type: "group",
        item: { path: "RootFolder", type: "space", subtype: "folder" },
        collapsed: true,
    };
    const targetFolderNode: any = {
        id: "TargetFolder",
        parentId: null,
        type: "group",
        item: { path: "TargetFolder", type: "space", subtype: "folder" },
        collapsed: false,
    };
    const linkedTagInTargetFolderNode: any = {
        id: "TargetFolder/spaces://#linked-fixture",
        parentId: "TargetFolder",
        type: "space",
        item: { path: "spaces://#linked-fixture", type: "space", subtype: "tag" },
        collapsed: true,
    };

    it("does not keep the source tag space highlighted for a root box target", () => {
        const highlightedContainer = highlightContainerIdForDrag(
            [tagNode, tagChildNode, rootFolderNode],
            1,
            2,
            {
                action: {
                    type: "copy",
                    containerId: "RootFolder",
                    projection: {} as any,
                },
                visual: {
                    kind: "box",
                    containerId: "RootFolder",
                },
                label: "Copy to RootFolder",
            },
        );

        expect(highlightedContainer).toBe("RootFolder");
    });

    it("moves no-op hover context from the source tag space to the hovered folder", () => {
        const highlightedContainer = highlightContainerIdForDrag([tagNode, tagChildNode, targetFolderNode], 1, 2, null);

        expect(highlightedContainer).toBe("TargetFolder");
    });

    it("keeps the containing folder highlighted when hovering a closed linked tag space", () => {
        const highlightedContainer = highlightContainerIdForDrag([tagNode, tagChildNode, targetFolderNode, linkedTagInTargetFolderNode], 1, 3, null);

        expect(highlightedContainer).toBe("TargetFolder");
    });
});
