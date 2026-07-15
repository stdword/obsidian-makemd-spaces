import { UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import { DropModifiers } from "core/react/components/Navigator/SpaceTree/SpaceTreeItem";
import { TreeNode, isPathPinnedInSpace, movePathToNewSpaceAtIndex, linkPathToSpaceAtIndex, pathIsAlreadyInFolderPath, removePathsFromSpace, updatePathRankInSpace } from "core/utils/superstate/spaces";
import { nodeIsAncestorOfTarget } from "core/utils/tree";
import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { PathState } from "shared/types/PathState";

import { DragProjection } from "./dragPath";

const rankAfterPinnedZone = (superstate: Superstate, path: string, newSpacePath: string, parentId: UniqueIdentifier, overIndex: number, rank: number, flattenedTree: TreeNode[]) => {
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

const nodeContainsTarget = (nodeId: UniqueIdentifier, targetId: UniqueIdentifier) => {
    if (!nodeId || !targetId) return false;
    const node = nodeId.toString();
    const target = targetId.toString();
    return target == node || target.startsWith(`${node}/`);
};

export const dropPathsInTree = async (superstate: Superstate, paths: string[], active: UniqueIdentifier, over: UniqueIdentifier, projected: DragProjection, flattenedTree: TreeNode[], activeSpaces: PathState[], modifier?: DropModifiers) => {
    if (paths.length == 1) {
        await dropPathInTree(superstate, paths[0], active, over, projected, flattenedTree, activeSpaces, modifier);
        return;
    }
    if (projected) {
        const targetId = projected.overId ?? over;
        const overIndex = flattenedTree.findIndex(({ id }) => id === targetId);
        const overItem = flattenedTree[overIndex];
        const dropTarget = overItem.type == "file" ? (overItem.depth == 0 ? null : flattenedTree.find((f) => f.id == overItem.parentId)?.item) : overItem.item;

        const droppable = paths.filter((f) => !nodeIsAncestorOfTarget(f, dropTarget?.path));

        const parentId = projected.insert ? targetId : projected.parentId;
        const newSpace = flattenedTree.find(({ id }) => id === parentId)?.item.path;
        let newRank = parentId == overItem.id ? -1 : (overItem.rank ?? -1);
        newRank = rankForDropLinePosition(newRank, projected);

        if (!newSpace) return;
        if (projected.sortable) {
            newRank = Math.min(...droppable.map((path) => rankAfterPinnedZone(superstate, path, newSpace, parentId, overIndex, newRank, flattenedTree)));
        }
        await dropPathsInSpaceAtIndex(superstate, droppable, newSpace, projected.sortable && newRank, modifier);
    }
};
export const dropPathInTree = async (superstate: Superstate, path: string, active: UniqueIdentifier, over: UniqueIdentifier, projected: DragProjection, flattenedTree: TreeNode[], activeSpaces: PathState[], modifier?: DropModifiers) => {
    if (projected) {
        const targetId = projected.overId ?? over;
        if (nodeContainsTarget(active, targetId) || nodeContainsTarget(active, projected.parentId)) {
            return;
        }
        const clonedItems: TreeNode[] = flattenedTree;
        const overIndex = clonedItems.findIndex(({ id }) => id === targetId);
        const overItem = clonedItems[overIndex];

        const parentId = projected.insert ? targetId : projected.parentId;

        const newSpace = projected.depth == 0 && !projected.insert ? null : clonedItems.find(({ id }) => id === parentId)?.item.path;
        const activeIndex = active ? clonedItems.findIndex(({ id }) => id === active) : -1;
        const activeItem = activeIndex == -1 ? null : clonedItems[activeIndex];
        const oldSpace = activeItem?.parentId == null ? null : clonedItems.find(({ id }) => id === activeItem.parentId)?.item.path;

        let newRank = parentId == null ? activeSpaces.findIndex((f) => f?.path == focusNodePath(overItem)) : parentId == overItem.id ? -1 : (overItem.rank ?? -1);
        newRank = rankForDropLinePosition(newRank, projected, activeItem, oldSpace, newSpace);
        if (projected.sortable && newSpace) {
            newRank = rankAfterPinnedZone(superstate, path, newSpace, parentId, overIndex, newRank, clonedItems);
        }
        if (!active) {
            await dropPathInSpaceAtIndex(superstate, path, null, newSpace, projected.sortable && newRank, modifier);
            return;
        }
        await dropPathInSpaceAtIndex(superstate, activeItem.item.path, oldSpace, newSpace, projected.sortable && newRank, modifier);
    }
};

const reorderOpenSpace = (superstate: Superstate, path: string, index: number) => {
    const newFocus = superstate.focuses[superstate.settings.currentFocus] ?? { sticker: "", name: i18n.labels.focus, paths: [] as string[] };
    const currentIndex = newFocus.paths.findIndex((f) => f == path);
    if (currentIndex == -1) {
        const nextPaths = [...newFocus.paths];
        nextPaths.splice(Math.max(0, index ?? nextPaths.length), 0, path);
        newFocus.paths = nextPaths;
    } else {
        const newIndex = currentIndex < index ? Math.max(0, index - 1) : index;
        newFocus.paths = arrayMove(
            newFocus.paths,
            newFocus.paths.findIndex((f) => f == path),
            newIndex,
        );
    }
    if (superstate.settings.currentFocus > superstate.focuses.length) {
        superstate.spaceManager.saveFocuses([...superstate.focuses, newFocus]);
    }
    const newFocuses = superstate.focuses.map((f, i) => (i == superstate.settings.currentFocus ? newFocus : f));
    superstate.spaceManager.saveFocuses(newFocuses);
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
        if (modifier == "link" || nodeIsAncestorOfTarget(path, newSpaceCache.path)) {
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
export const dropPathsInSpaceAtIndex = async (superstate: Superstate, paths: string[], newSpacePath: string, index: number, modifier?: DropModifiers) => {
    if (modifier == "link" && paths.some((path) => pathIsAlreadyInFolderPath(superstate, path, newSpacePath))) {
        superstate.ui.notify(i18n.notice.cannotLinkToOwnFolder);
        return false;
    }
    const newSpaceCache = superstate.spacesIndex.get(newSpacePath);
    if (!newSpaceCache) return;
    if (newSpaceCache.type == "folder" || newSpaceCache.type == "vault") {
        await Promise.all(paths.map((path) => {
            if (modifier == "link" || nodeIsAncestorOfTarget(path, newSpaceCache.path)) {
                return linkPathToSpaceAtIndex(superstate, newSpaceCache, path, index);
            } else {
                return movePathToNewSpaceAtIndex(superstate, superstate.pathsIndex.get(path), newSpaceCache.path, index, modifier == "copy");
            }
        }));
    }
};
