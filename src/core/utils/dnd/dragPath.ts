import { DropModifiers } from "core/react/components/Navigator/SpaceTree/SpaceTreeItem";
import { isNodeOrDescendant } from "core/utils/tree";
import { parentPathOf } from "utils/path";
import { movePath } from "utils/uri";
import { TreeNode } from "core/utils/superstate/spaces";
import { isTagSpacePath } from "schemas/builtin";

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

/** The container a projection drops into: the hovered row when inserting into it, else its parent. */
export const projectionContainerId = (projection: Pick<DragProjection, "insert" | "overId" | "parentId">): string | null => (projection.insert ? projection.overId : projection.parentId);

export type DragInsertPosition =
    | { kind: "before"; itemId: string }
    | { kind: "after"; itemId: string };

export type DragAction =
    | { type: "reorder"; containerId: string | null; position: DragInsertPosition; projection: DragProjection }
    | { type: "move"; containerId: string | null; position?: DragInsertPosition; projection: DragProjection }
    | { type: "copy"; containerId: string | null; position?: DragInsertPosition; projection: DragProjection }
    | { type: "link"; containerId: string | null; position?: DragInsertPosition; projection: DragProjection };

export type DragActionVisual =
    | { kind: "line"; itemId: string; position: "before" | "after"; depth?: number }
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

const isTagSpaceNode = (node?: TreeNode | null) => node?.item?.subtype == "tag" || isTagSpacePath(node?.item?.path);

const selectedNodesForPaths = (items: TreeNode[], paths: string[]) => items.filter((node) => node.item?.path && paths.includes(node.item.path));

const selectedNodesAreInsideTagSpace = (items: TreeNode[], paths: string[], tagSpaceId: string) => {
    const selectedNodes = selectedNodesForPaths(items, paths);
    return selectedNodes.length == paths.length && selectedNodes.every((node) => node.parentId == tagSpaceId);
};

const isSpaceContainerNode = (node?: TreeNode | null) => node?.item?.type == "space";
const isFolderContainerNode = (node?: TreeNode | null) => node?.item?.type == "space" && node.item?.subtype != "tag";

const isAlreadyInFolderContainer = (activeItem: TreeNode, folderNode?: TreeNode | null) => {
    if (!isFolderContainerNode(folderNode) || activeItem.parentId == folderNode.id) return false;
    const physicalParent = activeItem.item?.parent ?? parentPathOf(activeItem.item?.path);
    return physicalParent == folderNode.item?.path;
};

export function getDragDepth(offset: number, indentationWidth: number) {
    return Math.round(offset / indentationWidth);
}

/**
 * Insertion depth chosen purely by the pointer's Y inside a row. On the last
 * row of a subtree the bottom zone is split into stacked sub-zones, one per
 * level that ends at this row (rowDepth down to nextRowDepth + 1): the lower
 * the pointer, the further the insertion "escapes" the nesting — the way to
 * drop AFTER a trailing expanded folder at the folder's own level without any
 * horizontal movement. Rows that close no levels keep a single bottom zone.
 */
export function verticalInsertionDepth(pointerY: number, rowHeight: number, rowDepth: number, nextRowDepth: number) {
    const bottomZoneStart = (rowHeight * 2) / 3;
    if (pointerY < bottomZoneStart) return rowDepth;
    const closingLevels = Math.max(1, rowDepth - Math.max(0, nextRowDepth));
    if (closingLevels == 1) return rowDepth;
    const subZoneHeight = (rowHeight - bottomZoneStart) / closingLevels;
    const subZone = Math.min(closingLevels - 1, Math.floor((pointerY - bottomZoneStart) / subZoneHeight));
    return rowDepth - subZone;
}

const DRAG_ROW_MIDDLE_ZONE = 13;

// Separator rows are shorter than the middle-zone marker, so their bottom edge
// (the row height) is any non-zero offset that is not the marker itself.
const isRowBottomZone = (node: TreeNode, yOffset: number) => (node.type == "separator" ? yOffset > 0 && yOffset != DRAG_ROW_MIDDLE_ZONE : yOffset > DRAG_ROW_MIDDLE_ZONE);

const rowReorderable = (node: TreeNode | null | undefined) => Boolean(node) && (node.type == "separator" || node.parentId == null || Boolean(node.sortable));

export function verticalInsertionZone(pointerY: number, rowHeight: number, overItem: TreeNode | null | undefined, previousRow: TreeNode | null | undefined, followingRow: TreeNode | null | undefined) {
    const overReorderable = rowReorderable(overItem);
    const keepTopEdge = overReorderable || rowReorderable(previousRow);
    const keepBottomEdge = overReorderable || rowReorderable(followingRow);
    if (keepTopEdge && pointerY <= rowHeight / 3) return 0;
    if (keepBottomEdge && pointerY >= (rowHeight * 2) / 3) return rowHeight;
    return DRAG_ROW_MIDDLE_ZONE;
}

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

/**
 * Positional (line) projection for a multi-selection hovering a row of a
 * custom-sorted container or of the focus level. `undefined` means the row
 * offers no position and the caller falls back to the whole-container drop.
 */
const lastFocusRow = (items: TreeNode[]) => [...items].reverse().find((node) => node.parentId == null && node.type != "new");

// The end of the focus is the line under its last section. When that section is
// expanded its row is not the last one on screen, so the line is drawn on the
// Open row instead (never on a nested row: it does not belong to the focus level).
const endOfFocusLineOnOpenRow = (items: TreeNode[], overIndex: number) => items[overIndex]?.type == "new" && items[overIndex - 1]?.parentId != null;

const multiLineProjection = (flattenedTree: TreeNode[], paths: string[], overIndex: number, yOffset: number, modifier: DropModifiers): DragProjection | null | undefined => {
    const overItem = flattenedTree[overIndex];
    const selectedNodes = selectedNodesForPaths(flattenedTree, paths);
    const isBottomZone = isRowBottomZone(overItem, yOffset);
    const isTopZone = yOffset < DRAG_ROW_MIDDLE_ZONE && !isBottomZone;

    let target = overItem;
    let linePosition: "top" | "bottom" = isBottomZone ? "bottom" : "top";
    if (overItem.type == "new") {
        // The Open row closes the focus: dropping on it means "after the last section".
        target = lastFocusRow(flattenedTree);
        if (!target) return null;
        linePosition = "bottom";
    } else if (selectedNodes.some((node) => node.parentId == null)) {
        // Focus sections only reorder among themselves; they never go into a folder.
        if (overItem.parentId != null) return null;
    } else {
        const overIsContainer = isSpaceContainerNode(overItem);
        const overIsOpenContainer = overIsContainer && !overItem.collapsed && overItem.childrenCount > 0;
        if (overIsOpenContainer) {
            // Below an expanded folder row the line means "before its first child".
            if (isBottomZone) {
                target = flattenedTree[overIndex + 1];
                linePosition = "top";
                if (target?.parentId != overItem.id) return undefined;
            } else if (!isTopZone) return undefined;
        } else if (overIsContainer && !isTopZone && !isBottomZone) return undefined;
    }

    if (!rowReorderable(target)) return undefined;
    const parent = target.parentId == null ? null : flattenedTree.find((node) => node.id == target.parentId);
    if (target.parentId != null) {
        if (!isSpaceContainerNode(parent)) return undefined;
        if (isTagSpaceNode(parent) && !selectedNodesAreInsideTagSpace(flattenedTree, paths, parent.id)) return null;
        if (selectedNodes.some((node) => isNodeOrDescendant(node.id, parent.id))) return null;
    }
    const parentId = parent?.id ?? null;

    const siblings = flattenedTree.filter((node) => node.parentId == parentId && node.type != "new");
    const gap = siblings.indexOf(target) + (linePosition == "bottom" ? 1 : 0);
    const reorder = selectedNodes.length > 0 && selectedNodes.every((node) => node.parentId == parentId);
    if (reorder && modifier == "move") {
        // Rows that already sit next to each other stay put when dropped
        // around or between themselves. A scattered selection never is a
        // no-op: any gap lines it up there.
        const indexes = selectedNodes.map((node) => siblings.indexOf(node));
        const first = Math.min(...indexes);
        const last = Math.max(...indexes);
        if (last - first + 1 == indexes.length && gap >= first && gap <= last + 1) return null;
    }
    // One gap, one line: the top of the row below it, like single-item drags.
    // Only the end of the list and the row above a separator use the bottom edge.
    const lineOnOpenRow = endOfFocusLineOnOpenRow(flattenedTree, overIndex);
    const rowBelow = siblings[gap];
    if (rowBelow && rowBelow.type != "separator") {
        target = rowBelow;
        linePosition = "top";
    } else if (gap > 0) {
        target = siblings[gap - 1];
        linePosition = "bottom";
    }
    return {
        depth: target.depth,
        overId: lineOnOpenRow ? overItem.id : target.id,
        parentId,
        sortable: true,
        insert: false,
        droppable: true,
        copy: modifier == "link" || modifier == "copy",
        reorder,
        linePosition: lineOnOpenRow ? "top" : linePosition,
    };
};

/**
 * What a drag started on `activeItem` carries: the whole selection when the
 * row is part of it, otherwise only the row, which then becomes the selection
 * (separators cannot be selected, so dragging one clears it).
 */
export const dragSelectionForStart = (activeItem: TreeNode, selection: TreeNode[]): { paths: string[]; selection: TreeNode[] } => {
    if (selection.length > 1 && selection.some((node) => node.id == activeItem.id)) return { paths: selection.map((node) => node.path), selection };
    return { paths: [activeItem.path], selection: activeItem.type == "separator" || !activeItem.item ? [] : [activeItem] };
};

/** Tree ids the given rows get once they are moved into `container`, to carry the selection over. */
export const selectionIdsAfterMove = (paths: string[], container: Pick<TreeNode, "id" | "item">): string[] =>
    paths.map((path) => `${container.id}/${movePath(path, container.item.path)}`);

export const getMultiProjection = (flattenedTree: TreeNode[], _paths: string[], overIndex: number, yOffset: number, modifier: DropModifiers) => {
    const overItem = flattenedTree[overIndex];
    if (!overItem) return;
    const dropTarget = overItem.type == "file" || overItem.type == "separator" ? flattenedTree.find((f) => f.id == overItem.parentId) : overItem;
    const droppableTarget = isSpaceContainerNode(dropTarget);
    if (droppableTarget && isTagSpaceNode(dropTarget) && !selectedNodesAreInsideTagSpace(flattenedTree, _paths, dropTarget.id)) return null;

    const line = multiLineProjection(flattenedTree, _paths, overIndex, yOffset, modifier);
    if (line !== undefined) return line;
    if (!droppableTarget) return null;
    // A folder that is part of the drag takes nothing in during it.
    if (selectedNodesForPaths(flattenedTree, _paths).some((node) => isNodeOrDescendant(node.id, dropTarget.id))) return null;
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
};

export function getProjection(activeItem: TreeNode, items: TreeNode[], paths: string[], overItemIndex: number, dragDepth: number, yOffset: number, dirDown: boolean, modifier: DropModifiers, _activeSpaceID: string): DragProjection {
    if (paths.length == 0) return null;
    if (paths.length > 1) return getMultiProjection(items, paths, overItemIndex, yOffset, modifier);
    const overItem = items[overItemIndex];
    const previousItem = items[overItemIndex];

    if (!previousItem) return;
    if (previousItem.type == "new") {
        // The Open row closes the focus: dropping on it means "after the last section".
        const lastRow = lastFocusRow(items);
        if (!lastRow || lastRow.id == activeItem.id || activeItem.type == "separator") return null;
        const lineOnOpenRow = endOfFocusLineOnOpenRow(items, overItemIndex);
        return {
            depth: 0,
            overId: lineOnOpenRow ? previousItem.id : lastRow.id,
            parentId: null,
            sortable: true,
            insert: false,
            droppable: true,
            copy: modifier == "link" || modifier == "copy",
            reorder: activeItem.parentId == null,
            linePosition: lineOnOpenRow ? "top" : "bottom",
        };
    }
    if (isNodeOrDescendant(activeItem?.id, previousItem.id)) return null;

    const previousItemDroppable = isSpaceContainerNode(previousItem);
    const isBottomZone = isRowBottomZone(previousItem, yOffset);
    const isTopZone = yOffset < DRAG_ROW_MIDDLE_ZONE && !isBottomZone;
    const isMiddleZone = yOffset == DRAG_ROW_MIDDLE_ZONE;
    if (activeItem.type != "separator" && isMiddleZone && isTagSpaceNode(previousItem) && activeItem.parentId != previousItem.id) return null;
    const canInsertIntoFolder = previousItemDroppable && (overItem.collapsed || overItem.childrenCount == 0);
    const folderBoundaryDrop = previousItemDroppable && overItem.collapsed && (isTopZone || isBottomZone);
    const insert = activeItem.depth > 0 && canInsertIntoFolder && isMiddleZone && dragDepth >= previousItem.depth;
    if (isMiddleZone && previousItemDroppable && activeItem.parentId == previousItem.id && modifier != "link") return null;
    if (isMiddleZone && activeItem.parentId != null && previousItemDroppable && previousItem.parentId == null && isFolderContainerNode(previousItem)) {
        if (modifier != "link" && (activeItem.parentId == previousItem.id || isAlreadyInFolderContainer(activeItem, previousItem))) return null;
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
    if (activeItem.depth > 0 && previousItemDroppable && !previousItem.collapsed && previousItem.childrenCount > 0 && isBottomZone) {
        const firstChild = items[overItemIndex + 1];
        if (firstChild?.parentId == previousItem.id) {
            // The line at the bottom of an expanded parent means "before its
            // first child". If that child is already active, this is a no-op
            // regardless of the preliminary modifier (linked items start as link).
            if (activeItem.parentId == previousItem.id && activeItem.id == firstChild.id) return null;
            if (activeItem.type != "separator" && isTagSpaceNode(previousItem) && activeItem.parentId != previousItem.id) return null;
            if (modifier != "link" && isAlreadyInFolderContainer(activeItem, previousItem)) return null;
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
        if (activeItem.type != "separator" && isTagSpaceNode(previousItem) && activeItem.parentId != previousItem.id) return null;
        if (modifier != "link" && isAlreadyInFolderContainer(activeItem, previousItem)) return null;
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

    if (isNodeOrDescendant(activeItem?.id, parentId)) return null;

    const parent = items.find((f) => f.id == parentId);
    if (activeItem.type != "separator" && isTagSpaceNode(parent) && activeItem.parentId != parent.id) return null;
    if (modifier != "link" && isAlreadyInFolderContainer(activeItem, parent)) return null;
    const nextSibling = !insert && isBottomZone ? findNextSibling(items, overItemIndex, previousItem, parentId) : null;
    let targetItem = insert ? previousItem : (nextSibling ?? previousItem);
    let linePosition: "top" | "bottom" | undefined = insert ? undefined : nextSibling ? "top" : isBottomZone ? "bottom" : "top";
    if (!insert && targetItem.type == "separator" && linePosition == "top") {
        const separatorIndex = items.findIndex((item) => item.id == targetItem.id);
        const siblingBeforeSeparator = findPreviousSibling(items, separatorIndex, targetItem, parentId);
        if (siblingBeforeSeparator) {
            targetItem = siblingBeforeSeparator;
            linePosition = "bottom";
        }
    }

    // Separators never carry the flag themselves; ask a real sibling.
    const sortableReference = targetItem.parentId == parentId && targetItem.type != "separator" ? targetItem : items.find((item) => item.parentId == parentId && item.type != "new" && item.type != "separator");
    const sortable = insert ? false : parentId == null || Boolean(sortableReference?.sortable);

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
        droppable: parentId == null || isSpaceContainerNode(parent),
        copy: modifier == "link" || modifier == "copy",
        reorder: insert ? activeItem?.parentId == overItem?.id : (parentId == null && activeItem?.parentId == null) || activeItem?.parentId == parent?.id,
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
