import { DropModifiers } from "core/react/components/Navigator/SpaceTree/SpaceTreeItem";
import { TreeNode } from "core/utils/superstate/spaces";

export enum ProjectionType {
    PathRank,
    Space,
}

export type DragProjection = {
    depth: number;
    overId: string;
    parentId: string | null;
    sortable: boolean;
    insert: boolean;
    droppable: boolean;
    copy: boolean;
    reorder: boolean;
    linePosition?: "top" | "bottom";
};

export type DragInsertPosition =
    | { kind: "before"; itemId: string }
    | { kind: "after"; itemId: string };

export type DragAction =
    | { type: "reorder"; containerId: string | null; position: DragInsertPosition; projection: DragProjection }
    | { type: "move"; containerId: string | null; position?: DragInsertPosition; projection: DragProjection }
    | { type: "copy"; containerId: string | null; position?: DragInsertPosition; projection: DragProjection }
    | { type: "link"; containerId: string | null; position?: DragInsertPosition; projection: DragProjection };

export type DragActionVisual =
    | { kind: "line"; itemId: string; position: "before" | "after" }
    | { kind: "box"; containerId: string }
    | { kind: "folder"; containerId: string };

export type DragActionModel = {
    action: DragAction;
    visual: DragActionVisual;
    label: string | null;
};

function getMaxDepth(previousItem: TreeNode, dirDown: boolean) {
    if (previousItem) {
        if (previousItem.item?.type == "space" && !previousItem.collapsed && dirDown) return previousItem.depth + 1;
        return previousItem.depth;
    }

    return 0;
}
function getMinDepth(previousItem: TreeNode) {
    if (previousItem) {
        return Math.max(0, previousItem.depth - 1);
    }

    return 0;
}

const nodeContainsTarget = (nodeId: string, targetId: string | null) => {
    if (!nodeId || !targetId) return false;
    return targetId == nodeId || targetId.startsWith(`${nodeId}/`);
};

const isTagSpaceNode = (node?: TreeNode | null) => node?.item?.subtype == "tag";

const selectedNodesForPaths = (items: TreeNode[], paths: string[]) => items.filter((node) => node.item?.path && paths.includes(node.item.path));

const selectedNodesAreInsideTagSpace = (items: TreeNode[], paths: string[], tagSpaceId: string) => {
    const selectedNodes = selectedNodesForPaths(items, paths);
    return selectedNodes.length == paths.length && selectedNodes.every((node) => node.parentId == tagSpaceId);
};

export function getDragDepth(offset: number, indentationWidth: number) {
    return Math.round(offset / indentationWidth);
}

const DRAG_ROW_MIDDLE_ZONE = 13;

const findNextSibling = (items: TreeNode[], itemIndex: number, item: TreeNode, parentId: string | null) => {
    for (let index = itemIndex + 1; index < items.length; index++) {
        const candidate = items[index];
        if (candidate.depth < item.depth) return null;
        if (candidate.depth == item.depth) {
            if (candidate.type == "new") return null;
            return candidate.parentId == parentId ? candidate : null;
        }
    }
    return null;
};

const findPreviousSibling = (items: TreeNode[], itemIndex: number, item: TreeNode, parentId: string | null) => {
    for (let index = itemIndex - 1; index >= 0; index--) {
        const candidate = items[index];
        if (candidate.depth < item.depth) return null;
        if (candidate.depth == item.depth) {
            if (candidate.type == "new") continue;
            return candidate.parentId == parentId ? candidate : null;
        }
    }
    return null;
};

export const getMultiProjection = (flattenedTree: TreeNode[], _paths: string[], overIndex: number, yOffset: number, modifier: DropModifiers) => {
    const overItem = flattenedTree[overIndex];
    if (!overItem) return;
    if (overItem.type == "new") return null;
    if (overItem.parentId == null) {
        const isBottomZone = yOffset > DRAG_ROW_MIDDLE_ZONE;
        const nextSibling = isBottomZone ? findNextSibling(flattenedTree, overIndex, overItem, null) : null;
        const targetItem = nextSibling ?? overItem;
        return {
            depth: targetItem.depth,
            overId: targetItem.id,
            parentId: null,
            sortable: true,
            insert: false,
            droppable: true,
            copy: modifier == "link" || modifier == "copy",
            reorder: true,
            linePosition: nextSibling ? "top" as const : isBottomZone ? "bottom" as const : "top" as const,
        };
    }
    const dropTarget = overItem.type == "file" ? flattenedTree.find((f) => f.id == overItem.parentId) : overItem;

    if (dropTarget && dropTarget.type != "file") {
        if (isTagSpaceNode(dropTarget) && !selectedNodesAreInsideTagSpace(flattenedTree, _paths, dropTarget.id)) return null;
        const _projected: DragProjection = {
            depth: overItem.depth,
            overId: overItem.id,
            parentId: dropTarget.id,
            sortable: false,
            insert: dropTarget.collapsed || dropTarget.childrenCount == 0,
            droppable: true,
            copy: modifier == "link" || modifier == "copy",
            reorder: false,
        };
        return _projected;
    }
    return null;
};

export function getProjection(activeItem: TreeNode, items: TreeNode[], paths: string[], overItemIndex: number, dragDepth: number, yOffset: number, dirDown: boolean, modifier: DropModifiers, activeSpaceID: string): DragProjection {
    if (paths.length == 0) return null;
    if (paths.length > 1) return getMultiProjection(items, paths, overItemIndex, yOffset, modifier);
    const overItem = items[overItemIndex];
    const previousItem = items[overItemIndex];

    if (!previousItem) return;
    if (previousItem.type == "new") return null;
    if (nodeContainsTarget(activeItem?.id, previousItem.id)) return null;

    const previousItemDroppable = previousItem.type != "file";
    const isTopZone = yOffset < DRAG_ROW_MIDDLE_ZONE;
    const isMiddleZone = yOffset == DRAG_ROW_MIDDLE_ZONE;
    const isBottomZone = yOffset > DRAG_ROW_MIDDLE_ZONE;
    const canInsertIntoFolder = previousItemDroppable && (overItem.collapsed || overItem.childrenCount == 0);
    const folderBoundaryDrop = previousItemDroppable && overItem.collapsed && (isTopZone || isBottomZone);
    const insert = activeItem.depth > 0 && canInsertIntoFolder && isMiddleZone && dragDepth >= previousItem.depth;
    if (isMiddleZone && previousItemDroppable && activeItem.parentId == previousItem.id) return null;
    if (activeItem.depth > 0 && previousItemDroppable && !previousItem.collapsed && previousItem.childrenCount > 0 && isBottomZone) {
        const firstChild = items[overItemIndex + 1];
        if (firstChild?.parentId == previousItem.id) {
            if (modifier == "move" && activeItem.parentId == previousItem.id && activeItem.id == firstChild.id) return null;
            if (isTagSpaceNode(previousItem) && activeItem.parentId != previousItem.id) return null;
            return {
                depth: firstChild.depth,
                overId: firstChild.id,
                parentId: previousItem.id,
                sortable: Boolean(firstChild.sortable),
                insert: false,
                droppable: true,
                copy: modifier == "link" || modifier == "copy",
                reorder: activeItem.parentId == previousItem.id,
                linePosition: "top",
            };
        }
    }
    if (activeItem.depth > 0 && previousItemDroppable && !previousItem.collapsed && previousItem.childrenCount > 0 && isMiddleZone) {
        if (isTagSpaceNode(previousItem) && activeItem.parentId != previousItem.id) return null;
        return {
            depth: previousItem.depth + 1,
            overId: previousItem.id,
            parentId: previousItem.id,
            sortable: false,
            insert: false,
            droppable: true,
            copy: modifier == "link" || modifier == "copy",
            reorder: false,
        };
    }
    const projectedDepth = dragDepth;
    const maxDepth = activeItem.depth == 0 ? 0 : getMaxDepth(previousItem, dirDown);
    const minDepth = getMinDepth(previousItem);

    let depth = projectedDepth;
    if (folderBoundaryDrop) {
        depth = previousItem.depth;
    } else if (projectedDepth >= maxDepth) {
        depth = maxDepth;
    } else if (projectedDepth < minDepth) {
        depth = minDepth;
    }
    const parentId = getParentId();

    if (nodeContainsTarget(activeItem?.id, parentId)) return null;

    const parent = items.find((f) => f.id == parentId);
    if (isTagSpaceNode(parent) && activeItem.parentId != parent.id) return null;
    const nextSibling = !insert && isBottomZone ? findNextSibling(items, overItemIndex, previousItem, parentId) : null;
    const targetItem = insert ? previousItem : (nextSibling ?? previousItem);
    const linePosition = insert ? undefined : nextSibling ? "top" : isBottomZone ? "bottom" : "top";
    const sortable = insert ? false : parentId == null || Boolean(targetItem.sortable);

    if (!insert && activeItem?.parentId == parentId) {
        const targetIndex = items.findIndex((item) => item.id == targetItem.id);
        const previousSibling = findPreviousSibling(items, targetIndex, targetItem, parentId);
        if (linePosition == "top" && (targetItem.id == activeItem.id || previousSibling?.id == activeItem.id)) return null;
        if (linePosition == "bottom" && targetItem.id == activeItem.id) return null;
    }

    return {
        depth: nextSibling ? nextSibling.depth : depth,
        overId: targetItem.id,
        parentId: parentId,
        sortable: sortable,
        insert,
        droppable: parentId == null || parent?.type != "file",
        copy: modifier == "link" || modifier == "copy",
        reorder: insert ? activeItem?.parentId == overItem?.id : (parentId == null && activeItem?.parentId == null) || activeItem?.parentId == parent?.id || activeItem?.parentId == activeSpaceID,
        linePosition,
    };

    function getParentId() {
        if (depth === 0) {
            return null;
        }
        if (!previousItem) {
            return null;
        }

        if (depth === previousItem.depth || (depth > previousItem.depth && previousItem.item.type != "space")) {
            return previousItem.parentId;
        }

        if (depth > previousItem.depth) {
            return previousItem.id;
        }

        const newParent = items
            .slice(0, overItemIndex)
            .reverse()
            .find((item) => item.depth === depth)?.parentId;

        return newParent ?? null;
    }
}
