import { TreeNode } from "core/utils/superstate/spaces";

export const calculateFolderLineHeight = (flattenedTree: TreeNode[], rowHeights: number[], index: number, collapsed: boolean) => {
    const node = flattenedTree[index];
    if (!node || node.type != "space" || collapsed) return 0;

    let visibleChildrenHeight = 0;
    for (let i = index + 1; i < flattenedTree.length; i++) {
        if (flattenedTree[i].depth <= node.depth) break;
        visibleChildrenHeight += rowHeights[i] ?? 0;
    }

    return Math.max(0, visibleChildrenHeight - 13);
};
