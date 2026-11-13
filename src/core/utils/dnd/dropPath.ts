
import { arrayMove } from "utils/array";
import { DropModifiers } from "core/react/components/Navigator/SpaceTree/SpaceTreeItem";
import { TreeNode, isPathPinnedInSpace, movePathToNewSpaceAtIndex, linkPathToSpaceAtIndex, pathIsAlreadyInFolderPath, removePathsFromSpace, updatePathRankInSpace, movePathsToRankInSpace } from "core/utils/superstate/spaces";
import { isNodeOrDescendant } from "core/utils/tree";
import { Superstate } from "makemd-core";
import { updateCurrentFocus } from "core/utils/superstate/focusMode";
import i18n from "shared/i18n";
import { PathState } from "shared/types/PathState";

import { DragProjection } from "./dragPath";

const rankAfterPinnedZone = (superstate: Superstate, path: string, newSpacePath: string, parentId: string, overIndex: number, rank: number, flattenedTree: TreeNode[]) => {
    const space = superstate.spacesIndex.get(newSpacePath);
    if (!space || isPathPinnedInSpace(space, path)) return rank;

    const firstNonPinnedSiblingIndex = flattenedTree.findIndex((node) => node.parentId == parentId && !node.pinned && node.type != "new");
    if (firstNonPinnedSiblingIndex == -1) return 0;
    if (overIndex >= firstNonPinnedSiblingIndex) return rank;

    return flattenedTree[firstNonPinnedSiblingIndex].rank ?? 0;
};

export const rankForDropLinePosition = (rank: number, projected: DragProjection, activeItem?: TreeNode | null, oldSpace?: string | null, newSpace?: string | null) => {
    const insertionRank = rank + (projected.linePosition == "bottom" ? 1 : 0);
    if (activeItem && newSpace != null && oldSpace == newSpace && typeof activeItem.rank == "number" && activeItem.rank < rank) return insertionRank - 1;
    return insertionRank;
};

const focusNodePath = (node?: TreeNode | null) => node?.item?.path ?? node?.path ?? node?.id?.toString();

export const rankForDropPositionInSpace = (superstate: Superstate, path: string, spacePath: string, target: TreeNode, position: "top" | "bottom" = "top") => {
    const space = superstate.spacesIndex.get(spacePath);
    if (!space || !target) return null;

    const storedOrder: string[] = space.metadata?.["rank-order"] ?? [];
    const displayedPaths = superstate.getSpaceItems?.(spacePath)?.map((item) => item.path) ?? [];
    const currentOrder = [
        ...storedOrder,
        ...displayedPaths.filter((itemPath) => !storedOrder.includes(itemPath)),
    ];
    const targetPath = focusNodePath(target);
    const storedSeparatorRank = target.type == "separator" && currentOrder[target.rank] == targetPath ? target.rank : -1;
    const targetRank = storedSeparatorRank >= 0 ? storedSeparatorRank : currentOrder.indexOf(targetPath);
    if (targetRank < 0) return null;

    let insertionRank = targetRank + (position == "bottom" ? 1 : 0);
    const activeRank = currentOrder.indexOf(path);
    if (activeRank >= 0 && activeRank < insertionRank) insertionRank--;
    return insertionRank;
};

// Gathers the dragged rows, in tree order, next to a row of the focus level:
// sections already in the focus are reordered, other rows are added to it.
// The Open row as `target` stands for the end of the focus.
const dropPathsAtFocusLevel = (superstate: Superstate, paths: string[], target: TreeNode, position: "top" | "bottom", flattenedTree: TreeNode[]) => {
    const treeIndex = (path: string) => flattenedTree.findIndex((node) => focusNodePath(node) == path);
    const ordered = [...paths].sort((a, b) => treeIndex(a) - treeIndex(b));
    return updateCurrentFocus(superstate, (focus) => {
        // Separators share one path and the focus can list paths the tree does
        // not show, so the target is located by walking both lists in order.
        let cursor = 0;
        let targetIndex = target.type == "new" ? focus.paths.length : -1;
        for (const node of flattenedTree) {
            if (target.type == "new") break;
            if (node.parentId != null || node.type == "new") continue;
            const index = focus.paths.indexOf(focusNodePath(node), cursor);
            if (index == -1) continue;
            cursor = index + 1;
            if (node.id == target.id) {
                targetIndex = index;
                break;
            }
        }
        if (targetIndex == -1) return focus;
        const rank = targetIndex + (position == "bottom" && target.type != "new" ? 1 : 0);
        const dragged = new Set(ordered);
        const insertAt = rank - focus.paths.slice(0, rank).filter((path) => dragged.has(path)).length;
        const nextPaths = focus.paths.filter((path) => !dragged.has(path));
        nextPaths.splice(insertAt, 0, ...ordered);
        return { ...focus, paths: nextPaths };
    });
};

export const dropPathsInTree = async (superstate: Superstate, paths: string[], active: string, over: string, projected: DragProjection, flattenedTree: TreeNode[], activeSpaces: PathState[], modifier?: DropModifiers) => {
    if (paths.length == 1) {
        await dropPathInTree(superstate, paths[0], active, over, projected, flattenedTree, activeSpaces, modifier);
        return;
    }
    if (projected) {
        const targetId = projected.overId ?? over;
        const overIndex = flattenedTree.findIndex(({ id }) => id === targetId);
        const overItem = flattenedTree[overIndex];
        if (projected.parentId == null && !projected.insert) {
            // A line that escaped a section hangs under one of its rows; the
            // position is counted from the section itself.
            let target = overItem;
            while (target && target.parentId != null) target = flattenedTree.find(({ id }) => id === target.parentId);
            if (target) await dropPathsAtFocusLevel(superstate, paths, target, projected.linePosition ?? "top", flattenedTree);
            return;
        }
        const dropTarget = overItem.type == "file" ? (overItem.depth == 0 ? null : flattenedTree.find((f) => f.id == overItem.parentId)?.item) : overItem.item;

        const droppable = paths.filter((f) => !isNodeOrDescendant(f, dropTarget?.path));

        const parentId = projected.insert ? targetId : projected.parentId;
        const newSpace = flattenedTree.find(({ id }) => id === parentId)?.item.path;
        let newRank = parentId == overItem.id ? -1 : (overItem.rank ?? -1);
        newRank = rankForDropLinePosition(newRank, projected);

        if (!newSpace) return;
        if (projected.sortable && parentId != overItem.id && droppable.length > 0) {
            const treeIndex = (path: string) => flattenedTree.findIndex((node) => node.item?.path == path);
            const ordered = [...droppable].sort((a, b) => treeIndex(a) - treeIndex(b));
            const space = superstate.spacesIndex.get(newSpace);
            // A non-pinned selection cannot land inside the pinned zone.
            const firstNonPinnedIndex = flattenedTree.findIndex((node) => node.parentId == parentId && !node.pinned && node.type != "new");
            const clampToFirstNonPinned = firstNonPinnedIndex >= 0 && overIndex < firstNonPinnedIndex && ordered.some((path) => !isPathPinnedInSpace(space, path));
            const rankTarget = clampToFirstNonPinned ? flattenedTree[firstNonPinnedIndex] : overItem;
            const rankPosition = clampToFirstNonPinned ? "top" : (projected.linePosition ?? "top");
            const storedRank = rankForDropPositionInSpace(superstate, null, newSpace, rankTarget, rankPosition);
            if (storedRank != null) {
                // Rows already shown in the target container are reordered in
                // one write; the rest is moved or linked in right after them.
                const inPlace = modifier == "link" || modifier == "copy" ? [] : ordered.filter((path) => flattenedTree.some((node) => node.parentId == parentId && node.item?.path == path));
                const incoming = ordered.filter((path) => !inPlace.includes(path));
                const landedAt = await movePathsToRankInSpace(superstate, newSpace, inPlace, storedRank);
                if (incoming.length > 0) await dropPathsInSpaceAtIndex(superstate, incoming, newSpace, landedAt + inPlace.length, modifier);
                return;
            }
        }
        await dropPathsInSpaceAtIndex(superstate, droppable, newSpace, false, modifier);
    }
};
export const dropPathInTree = async (superstate: Superstate, path: string, active: string, over: string, projected: DragProjection, flattenedTree: TreeNode[], activeSpaces: PathState[], modifier?: DropModifiers) => {
    if (projected) {
        const targetId = projected.overId ?? over;
        if (isNodeOrDescendant(active, targetId) || isNodeOrDescendant(active, projected.parentId)) {
            return;
        }
        const clonedItems: TreeNode[] = flattenedTree;
        const overIndex = clonedItems.findIndex(({ id }) => id === targetId);
        const overItem = clonedItems[overIndex];
        if (overItem?.type == "new") {
            if (projected.parentId == null && superstate.pathsIndex.has(path)) await dropPathsAtFocusLevel(superstate, [path], overItem, "top", flattenedTree);
            return;
        }

        const parentId = projected.insert ? targetId : projected.parentId;

        const rankItem = !projected.insert && overItem && overItem.parentId != parentId
            ? clonedItems.find((node) => node.depth == projected.depth && node.parentId == parentId && (overItem.id == node.id || String(overItem.id).startsWith(`${node.id}/`))) ?? overItem
            : overItem;

        const newSpace = projected.depth == 0 && !projected.insert ? null : clonedItems.find(({ id }) => id === parentId)?.item.path;
        const activeIndex = active ? clonedItems.findIndex(({ id }) => id === active) : -1;
        const activeItem = activeIndex == -1 ? null : clonedItems[activeIndex];
        const oldSpace = activeItem?.parentId == null ? null : clonedItems.find(({ id }) => id === activeItem.parentId)?.item.path;

        let newRank: number;
        const sameSpaceReorder = projected.sortable && !projected.insert && oldSpace != null && oldSpace == newSpace;
        if (sameSpaceReorder) {
            const space = superstate.spacesIndex.get(newSpace);
            const firstNonPinnedIndex = clonedItems.findIndex((node) => node.parentId == parentId && !node.pinned && node.type != "new");
            const activePinned = isPathPinnedInSpace(space, path);
            const clampToFirstNonPinned = !activePinned && firstNonPinnedIndex >= 0 && overIndex < firstNonPinnedIndex;
            const rankTarget = clampToFirstNonPinned ? clonedItems[firstNonPinnedIndex] : rankItem;
            const rankPosition = clampToFirstNonPinned ? "top" : (projected.linePosition ?? "top");
            const storedRank = rankForDropPositionInSpace(superstate, path, newSpace, rankTarget, rankPosition);
            newRank = storedRank ?? overItem.rank ?? -1;
        } else {
            newRank = parentId == null ? activeSpaces.findIndex((f) => f?.path == focusNodePath(rankItem)) : parentId == overItem.id ? -1 : (rankItem.rank ?? -1);
            newRank = rankForDropLinePosition(newRank, projected, activeItem, oldSpace, newSpace);
            if (projected.sortable && newSpace) {
                if (parentId != null && parentId != overItem.id) {
                    // The stored rank-order can hold entries hidden from the
                    // tree (folder notes, hidden separators), so the visible
                    // row rank does not index into it; translate the target
                    // through the stored order like same-space reorders do.
                    const storedRank = rankForDropPositionInSpace(superstate, path, newSpace, rankItem, projected.linePosition ?? "top");
                    if (storedRank != null) newRank = storedRank;
                }
                newRank = rankAfterPinnedZone(superstate, path, newSpace, parentId, overIndex, newRank, clonedItems);
            }
        }
        if (!active) {
            await dropPathInSpaceAtIndex(superstate, path, null, newSpace, projected.sortable && newRank, modifier);
            return;
        }
        await dropPathInSpaceAtIndex(superstate, activeItem.item.path, oldSpace, newSpace, projected.sortable && newRank, modifier);
    }
};

const reorderOpenSpace = (superstate: Superstate, path: string, index: number) => {
    updateCurrentFocus(superstate, (focus) => {
        const currentIndex = focus.paths.findIndex((f) => f == path);
        if (currentIndex == -1) {
            const nextPaths = [...focus.paths];
            nextPaths.splice(Math.max(0, index ?? nextPaths.length), 0, path);
            return { ...focus, paths: nextPaths };
        }
        const newIndex = currentIndex < index ? Math.max(0, index - 1) : index;
        return { ...focus, paths: arrayMove(focus.paths, currentIndex, newIndex) };
    });
};

export const dropPathInSpaceAtIndex = async (superstate: Superstate, path: string, oldSpacePath: string | null, newSpacePath: string, index: number | false, modifier?: DropModifiers) => {
    const cache: PathState = superstate.pathStateForPath?.(path) ?? superstate.pathsIndex.get(path);
    if (!cache) return false;
    if (!newSpacePath) {
        if (index === false) return false;
        reorderOpenSpace(superstate, path, index);
        return;
    }
    if (modifier == "link" && pathIsAlreadyInFolderPath(superstate, path, newSpacePath)) {
        superstate.ui.notify(i18n.notice.cannotLinkToOwnFolder);
        return false;
    }
    const newSpaceCache = superstate.spacesIndex.get(newSpacePath);
    if (!newSpaceCache) return;

    // Dropping an item onto the folder it already physically belongs to has no
    // positional intent (`false` comes from a non-sortable projection). Do not
    // turn that no-op into a rank write and a tree reload.
    if (modifier != "link" && index === false && cache.parent == newSpacePath) return false;
    if (modifier != "link" && index === false && oldSpacePath == newSpacePath) return false;
    const targetIndex = index === false ? undefined : index;

    if (oldSpacePath == newSpacePath && modifier != "link") {
        const currentRank = superstate.getSpaceItems?.(newSpacePath)?.find((item) => item.path == path)?.rank;
        if (currentRank == targetIndex) return false;
        await updatePathRankInSpace(superstate, path, targetIndex, newSpacePath);
        return;
    }

    if (newSpaceCache.type == "folder" || newSpaceCache.type == "vault") {
        if (modifier == "link" || isNodeOrDescendant(path, newSpaceCache.path)) {
            await linkPathToSpaceAtIndex(superstate, newSpaceCache, path, targetIndex);
        } else {
            if (cache.parent == newSpaceCache.path) return;
            await movePathToNewSpaceAtIndex(superstate, superstate.pathsIndex.get(path), newSpaceCache.path, targetIndex, modifier == "copy");
        }
    }
    if (modifier != "link" && oldSpacePath && oldSpacePath != newSpacePath) {
        await removePathsFromSpace(superstate, oldSpacePath, [path]);
    }
};
export const dropPathsInSpaceAtIndex = async (superstate: Superstate, paths: string[], newSpacePath: string, index: number | false, modifier?: DropModifiers) => {
    if (modifier == "link" && paths.some((path) => pathIsAlreadyInFolderPath(superstate, path, newSpacePath))) {
        superstate.ui.notify(i18n.notice.cannotLinkToOwnFolder);
        return false;
    }
    const newSpaceCache = superstate.spacesIndex.get(newSpacePath);
    if (!newSpaceCache) return;
    if (newSpaceCache.type == "folder" || newSpaceCache.type == "vault") {
        const dropOne = (path: string, targetIndex: number | false) => {
            if (modifier == "link" || isNodeOrDescendant(path, newSpaceCache.path)) {
                return linkPathToSpaceAtIndex(superstate, newSpaceCache, path, targetIndex as number);
            } else {
                return movePathToNewSpaceAtIndex(superstate, superstate.pathsIndex.get(path), newSpaceCache.path, targetIndex as number, modifier == "copy");
            }
        };
        if (typeof index == "number" && Number.isFinite(index)) {
            // Positional drops write the rank order one by one so the items keep their order.
            for (let offset = 0; offset < paths.length; offset++) await dropOne(paths[offset], index + offset);
        } else {
            await Promise.all(paths.map((path) => dropOne(path, index)));
        }
    }
};
