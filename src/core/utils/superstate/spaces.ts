import { Superstate } from "makemd-core";
import i18n from "shared/i18n";

import { ensureArray, ensureBoolean, ensureString } from "core/utils/schema";
import { compareByField, compareByFieldCaseInsensitive, compareByFieldDeep } from "core/utils/tree";

import { TargetLocation } from "shared/types/path";
import { PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";
import { SpaceDefinition, SpaceSort } from "shared/types/spaceDef";
import { PathStateWithRank } from "shared/types/superstate";
import { canonicalTagSpacePath, isSpaceSeparatorPath, sameTagSpaceLink, setTagSpaceLinkFiltered, SPACE_HIDDEN_SEPARATOR_PATH, SPACE_SEPARATOR_PATH } from "schemas/builtin";

import { movePath } from "utils/uri";
import { deletePath } from "./path";


const hasOwn = (value: Record<string, any>, key: string) => value != null && Object.prototype.hasOwnProperty.call(value, key);

type RankedItem = {
    path: string;
    rank?: number;
    [key: string]: any;
};

export const uniqueRankOrder = (order: string[]) => {
    const seen = new Set<string>();
    return order.filter((itemPath) => {
        if (isSpaceSeparatorPath(itemPath)) return true;
        if (seen.has(itemPath)) return false;
        seen.add(itemPath);
        return true;
    });
};

export const defaultSortForSettings = (settings: MakeMDSettings): SpaceSort => ({
    field: settings?.defaultSpaceSort?.field ?? "name",
    asc: hasOwn(settings?.defaultSpaceSort as Record<string, any>, "asc") ? ensureBoolean(settings.defaultSpaceSort.asc) : true,
    group: settings?.defaultFoldersAtTop ?? true,
    subtags: settings?.defaultGroupBySubtags ?? true,
    recursive: false,
});

export const effectiveSpaceSort = (value: Partial<SpaceSort>, settings: MakeMDSettings): SpaceSort => {
    const fallback = defaultSortForSettings(settings);
    return {
        field: ensureString(value?.["field"] ?? fallback.field),
        asc: hasOwn(value as Record<string, any>, "asc") ? ensureBoolean(value.asc) : fallback.asc,
        group: hasOwn(value as Record<string, any>, "group") ? ensureBoolean(value.group) : fallback.group,
        ...(hasOwn(value as Record<string, any>, "subtags") ? { subtags: ensureBoolean(value.subtags) } : fallback.subtags ? { subtags: true } : {}),
        recursive: hasOwn(value as Record<string, any>, "recursive") ? ensureBoolean(value.recursive) : fallback.recursive,
    };
};

export const isSpaceSortable = (space: SpaceState, settings: MakeMDSettings): boolean =>
    effectiveSpaceSort(space?.metadata?.sort, settings).field == "rank";

export const childSpaceSort = (value: Partial<SpaceSort>, parentSort: Partial<SpaceSort>, settings: MakeMDSettings): SpaceSort => {
    const effectiveParentSort = effectiveSpaceSort(parentSort, settings);
    return effectiveParentSort.recursive ? effectiveParentSort : effectiveSpaceSort(value, settings);
};

export const storedSpaceSort = (value: any): Partial<SpaceSort> | undefined => {
    if (!value || typeof value != "object") return undefined;
    const sort: Partial<SpaceSort> = {};
    if (hasOwn(value, "field")) sort.field = ensureString(value.field);
    if (hasOwn(value, "asc")) sort.asc = ensureBoolean(value.asc);
    if (hasOwn(value, "group")) sort.group = ensureBoolean(value.group);
    if (hasOwn(value, "subtags")) sort.subtags = ensureBoolean(value.subtags);
    if (hasOwn(value, "recursive")) sort.recursive = ensureBoolean(value.recursive);
    return Object.keys(sort).length > 0 ? sort : undefined;
};

const mergedStoredSpaceSort = (current: Partial<SpaceSort>, update: Partial<SpaceSort>): Partial<SpaceSort> | undefined => {
    const next = {
        ...(current ?? {}),
        ...(update ?? {}),
    };
    return storedSpaceSort(next);
};

const rankOrderForSort = (superstate: Superstate, path: string, sort: SpaceSort): string[] | undefined => {
    if (typeof superstate.getSpaceItems != "function") return undefined;
    return [...(superstate.getSpaceItems(path) ?? [])].sort(spaceSortFn(sort)).map((item) => item.path);
};

const rankOrderWithGroupedItemsFirst = (superstate: Superstate, space: SpaceState, sort: SpaceSort): string[] => {
    const items = superstate.getSpaceItems(space.path) ?? [];
    const itemsByPath = new Map(items.map((item) => [item.path, item]));
    const currentOrder = [
        ...ensureArray(space.metadata?.["rank-order"]).filter((itemPath) => itemsByPath.has(itemPath)),
        ...items.map((item) => item.path).filter((itemPath) => !ensureArray(space.metadata?.["rank-order"]).includes(itemPath)),
    ];

    const priority = (itemPath: string) => {
        const item = itemsByPath.get(itemPath);
        if (!sort.group) return 0;
        if (item?.subtype == "tag") return 0;
        if (item?.type == "space") return 1;
        return 2;
    };
    return currentOrder.map((itemPath, index) => ({ itemPath, index }))
        .sort((a, b) => priority(a.itemPath) - priority(b.itemPath) || a.index - b.index)
        .map(({ itemPath }) => itemPath);
};

export const parseSpaceMetadata = (metadata: Record<string, any>, _settings: MakeMDSettings): SpaceDefinition => {
    return {
        color: ensureString(metadata.color),
        sticker: ensureString(metadata.sticker),
        defaultColor: ensureString(metadata.defaultColor),
        defaultSticker: ensureString(metadata.defaultSticker),
        sort: storedSpaceSort(metadata.sort),
        "rank-order": ensureArray(metadata["rank-order"]),
        links: ensureArray(metadata.links),
        pinned: ensureArray(metadata.pinned),
        "file-colors": metadata["file-colors"] ?? {},
    };
};

type TreeNodeType = "space" | "file" | "group" | "separator" | "new";
export interface TreeNode {
    id: string;
    parentId: string;
    depth: number;
    index: number;
    space: string;
    sortable?: boolean;
    type: TreeNodeType;
    path: string;
    item?: PathStateWithRank;
    childrenCount: number;
    collapsed: boolean;
    rank: number;
    sort?: SpaceSort;
    pinned?: boolean;
    filtered?: boolean;
    folderNotePath?: string | null;
}
export const spaceToTreeNode = (path: PathStateWithRank, collapsed: boolean, sortable: boolean, depth: number, parentId: string, parentPath: string, childrenCount: number, sort?: SpaceSort, pinned?: boolean): TreeNode => {
    return {
        id: parentId ? parentId + "/" + path.path : path.path,
        parentId,
        depth,
        index: 0,
        space: parentPath,
        path: path.path,
        item: path,
        rank: path?.rank,
        collapsed: collapsed,
        sortable: sortable,
        childrenCount: childrenCount,
        type: "space",
        sort,
        pinned,
    };
};
export const pathStateToTreeNode = (_superstate: Superstate, item: PathStateWithRank, space: string, path: string, depth: number, i: number, collapsed: boolean, sortable: boolean, childrenCount: number, parentId: string, pinned?: boolean): TreeNode => ({
    item: item,
    space,
    id: parentId + "/" + item.path,
    parentId: parentId,
    depth: depth,
    path,
    index: i,
    collapsed,
    sortable,
    childrenCount,
    rank: item.rank,
    type: "file",
    pinned,
});

export const isPathPinnedInSpace = (space: SpaceState, path: string) => ensureArray(space?.metadata?.pinned).some((pinnedPath) => sameTagSpaceLink(pinnedPath, path));

export const setPathPinnedInSpace = async (superstate: Superstate, spacePath: string, path: string, pinned: boolean) => {
    const space = superstate.spacesIndex.get(spacePath);
    if (!space || !path) return;

    const currentPinned = ensureArray(space.metadata?.pinned);
    const nextPinned = pinned
        ? [...currentPinned.filter((itemPath) => !sameTagSpaceLink(itemPath, path)), canonicalTagSpacePath(path)]
        : currentPinned.filter((itemPath) => !sameTagSpaceLink(itemPath, path));

    if (JSON.stringify(currentPinned) == JSON.stringify(nextPinned)) return;
    await saveSpaceMetadataValue(superstate, space.path, "pinned", nextPinned);
};

export const pinnedItemsFirst = <T extends RankedItem>(items: T[], space: SpaceState, sort: SpaceSort): T[] => {
    const pinned = ensureArray(space?.metadata?.pinned);
    if (pinned.length == 0) return [...items].sort(spaceSortFn(sort));

    const pinnedIndex = new Map(pinned.map((path, index) => [path, index]));
    const rankIndex = new Map(ensureArray(space?.metadata?.["rank-order"]).map((path, index) => [path, index]));
    const pinnedItems = items
        .filter((item) => pinnedIndex.has(item.path))
        .sort((a, b) => {
            const aRank = rankIndex.has(a.path) ? rankIndex.get(a.path) : Number.MAX_SAFE_INTEGER;
            const bRank = rankIndex.has(b.path) ? rankIndex.get(b.path) : Number.MAX_SAFE_INTEGER;
            if (aRank != bRank) return aRank - bRank;
            return pinnedIndex.get(a.path) - pinnedIndex.get(b.path);
        });
    const otherItems = items.filter((item) => !pinnedIndex.has(item.path)).sort(spaceSortFn(sort));

    return [...pinnedItems, ...otherItems];
};

export const spaceRowHeight = (_superstate: Superstate, preset: number, section: boolean) => {
    const spaceHeight = preset ?? 29;
    return spaceHeight;
};

export const spaceSortLabel = (sort: SpaceSort, tagSpace: boolean) => {
    const fieldLabel = sort.field == "name" ? "AZ" : sort.field == "ctime" ? "+" : sort.field == "mtime" ? "~" : sort.field == "rank" ? "#" : sort.field;
    const directionLabel = fieldLabel == "#" ? "" : (sort.asc ? "↓" : "↑");
    const groupLabel = sort.group ? ":" : "";
    const subtagLabel = tagSpace && sort.subtags ? "/" : "";
    const recursiveLabel = (!tagSpace && sort.recursive) ? "*" : "";
    return `${subtagLabel}${groupLabel}${fieldLabel}${directionLabel}${recursiveLabel}`;
};

export const spaceSortFn = (sortStrategy: SpaceSort) => (a: RankedItem, b: RankedItem) => {
    if (sortStrategy.field == "rank") {
        if (sortStrategy.group) {
            const subtagOrder = Number(b?.subtype == "tag") - Number(a?.subtype == "tag");
            if (subtagOrder != 0) return subtagOrder;
            const folderOrder = compareByField("type", false)(a, b);
            if (folderOrder != 0) return folderOrder;
        }
        const aRanked = typeof a.rank == "number" && a.rank >= 0;
        const bRanked = typeof b.rank == "number" && b.rank >= 0;
        if (aRanked && bRanked && a.rank != b.rank) {
            return a.rank - b.rank;
        }
        if (aRanked != bRanked) return aRanked ? -1 : 1;
        const fallbackFns = [];
        fallbackFns.push(compareByFieldCaseInsensitive("name", true));
        return fallbackFns.reduce((p, c) => {
            return p == 0 ? c(a, b) : p;
        }, 0);
    }
    const sortFns = [];
    if (sortStrategy.group) {
        sortFns.push((a: RankedItem, b: RankedItem) => Number(b?.subtype == "tag") - Number(a?.subtype == "tag"));
        sortFns.push(compareByField("type", false));
    }
    if (sortStrategy.field == "name") {
        sortFns.push(compareByFieldCaseInsensitive(sortStrategy.field, sortStrategy.asc));
    } else if (sortStrategy.field.startsWith("props")) {
        const propName = sortStrategy.field.split(".")[1];
        const fieldFunc = (obj: Record<string, any>) => obj?.metadata?.property?.[propName];
        sortFns.push(compareByFieldDeep(fieldFunc, sortStrategy.asc));
    } else if (["ctime", "mtime"].includes(sortStrategy.field)) {
        const fieldFunc = (obj: Record<string, any>) => obj?.[sortStrategy.field] ?? obj?.metadata?.[sortStrategy.field] ?? "";
        sortFns.push((_a: Record<string, any>, _b: Record<string, any>) => {
            const a = sortStrategy.asc ? _a : _b;
            const b = sortStrategy.asc ? _b : _a;
            const aValue = Number(fieldFunc(a) || 0);
            const bValue = Number(fieldFunc(b) || 0);
            return aValue - bValue;
        });
    } else {
        const fieldFunc = (obj: Record<string, any>) => obj?.[sortStrategy.field] ?? obj?.metadata?.[sortStrategy.field];
        sortFns.push(compareByFieldDeep(fieldFunc, sortStrategy.asc));
    }
    return sortFns.reduce((p, c) => {
        return p == 0 ? c(a, b) : p;
    }, 0);
};

export const updatePathRankInSpace = async (superstate: Superstate, path: string, rank: number, space: string) => {
    if (typeof rank != "number" || !Number.isFinite(rank)) return;

    const spaceState = superstate.spacesIndex.get(space);
    if (!spaceState) return;

    if (spaceState.type == "tag" || spaceState.type == "folder" || spaceState.type == "vault") {
        if (effectiveSpaceSort(spaceState.metadata?.sort, superstate.settings).field != "rank") return;
        const currentOrder = ensureArray(spaceState.metadata?.["rank-order"] ?? superstate.getSpaceItems(space).map((item) => item.path));
        const nextOrder = currentOrder.filter((itemPath) => itemPath != path);
        nextOrder.splice(Math.max(0, rank ?? nextOrder.length), 0, path);
        await saveSpaceMetadataValue(superstate, space, "rank-order", uniqueRankOrder(nextOrder));
        return;
    }
};

export const duplicatePathNextToOriginal = async (superstate: Superstate, path: string, destinationParent: string, newName?: string, rankSpace = destinationParent) => {
    const newPath = await superstate.spaceManager.copyPath(path, destinationParent, newName);
    if (!newPath) return newPath;

    const spaceState = superstate.spacesIndex.get(rankSpace);
    if (!spaceState || effectiveSpaceSort(spaceState.metadata?.sort, superstate.settings).field != "rank") return newPath;

    const currentOrder = ensureArray(spaceState.metadata?.["rank-order"]);
    const displayedOrder = currentOrder.length > 0
        ? currentOrder
        : pinnedItemsFirst(superstate.getSpaceItems(rankSpace), spaceState, effectiveSpaceSort(spaceState.metadata?.sort, superstate.settings)).map((item) => item.path);
    const nextOrder = displayedOrder.filter((itemPath) => itemPath != newPath);
    const originalIndex = nextOrder.indexOf(path);
    nextOrder.splice(originalIndex >= 0 ? originalIndex + 1 : nextOrder.length, 0, newPath);
    await saveSpaceMetadataValue(superstate, rankSpace, "rank-order", uniqueRankOrder(nextOrder));
    return newPath;
};

const rankOrderWithPathAtIndex = (superstate: Superstate, spaceState: SpaceState, path: string, previousPath: string, rank: number) => {
    const currentOrder = ensureArray(spaceState.metadata?.["rank-order"] ?? superstate.getSpaceItems(spaceState.path).map((item) => item.path));
    const nextOrder = currentOrder.filter((itemPath) => itemPath != previousPath && itemPath != path);
    nextOrder.splice(Math.max(0, rank ?? nextOrder.length), 0, path);
    return uniqueRankOrder(nextOrder);
};

const isFiniteRank = (rank: unknown): rank is number => typeof rank == "number" && Number.isFinite(rank);

const parentPathForPath = (path: string): string => {
    const index = path.lastIndexOf("/");
    return index == -1 ? "" : path.slice(0, index);
};

const physicalParentForPath = (superstate: Superstate, path: string): string => {
    return (superstate.pathStateForPath?.(path) ?? superstate.pathsIndex?.get(path))?.parent ?? parentPathForPath(path);
};

export const pathIsAlreadyInFolderPath = (superstate: Superstate, path: string, folderPath: string): boolean => {
    return physicalParentForPath(superstate, path) == folderPath;
};

const pathIsAlreadyInFolderSpace = (superstate: Superstate, path: string, space: SpaceState): boolean => {
    if (!space || !["folder", "vault"].includes(space.type)) return false;
    return pathIsAlreadyInFolderPath(superstate, path, space.path);
};

const stagePathRankInSpace = (superstate: Superstate, path: string, previousPath: string, rank: number, space: string) => {
    if (typeof rank != "number" || !Number.isFinite(rank)) return;

    const spaceState = superstate.spacesIndex.get(space);
    if (!spaceState) return;
    if (!["tag", "folder", "vault"].includes(spaceState.type)) return;
    if (effectiveSpaceSort(spaceState.metadata?.sort, superstate.settings).field != "rank") return;

    const nextMetadata = {
        ...spaceState.metadata,
        "rank-order": rankOrderWithPathAtIndex(superstate, spaceState, path, previousPath, rank),
    };

    superstate.spacesIndex.set(space, {
        ...spaceState,
        metadata: nextMetadata,
    });
};

const persistStagedPathRankInSpace = async (superstate: Superstate, path: string, previousPath: string, rank: number, space: string) => {
    if (typeof rank != "number" || !Number.isFinite(rank)) return;

    const spaceState = superstate.spacesIndex.get(space);
    if (!spaceState) return;
    if (!["tag", "folder", "vault"].includes(spaceState.type)) return;
    if (effectiveSpaceSort(spaceState.metadata?.sort, superstate.settings).field != "rank") return;

    const nextOrder = rankOrderWithPathAtIndex(superstate, spaceState, path, previousPath, rank);
    await saveSpaceMetadataValue(superstate, space, "rank-order", nextOrder);
};

export const movePathToNewSpaceAtIndex = async (superstate: Superstate, item: PathState, newParent: string, index?: number, copy?: boolean) => {
    if (!item) return;
    //pre-save before vault change happens so we can save the rank
    const currentPathState = superstate.pathsIndex.get(item.path);
    if (!currentPathState) return;
    const newPath = movePath(item.path, newParent);
    const newSpaceState = superstate.spacesIndex.get(newParent);
    const newSpaceLinks = ensureArray(newSpaceState?.metadata?.links);
    const replacingLinkInDestination = !copy && newSpaceState && newSpaceLinks.includes(item.path);
    const linkedRank = replacingLinkInDestination ? ensureArray(newSpaceState.metadata?.["rank-order"]).indexOf(item.path) : -1;
    const explicitIndex = isFiniteRank(index);
    const adjustedIndex = explicitIndex && linkedRank >= 0 && linkedRank < index ? index - 1 : index;
    const effectiveIndex = explicitIndex ? adjustedIndex : linkedRank >= 0 ? linkedRank : index;

    if (await superstate.spaceManager.pathExists(newPath)) {
        superstate.ui.notify(i18n.notice.fileExists);
        return;
    }

    if (replacingLinkInDestination) {
        const nextMetadata: SpaceDefinition = {
            ...newSpaceState.metadata,
            links: newSpaceLinks.filter((linkPath) => linkPath != item.path),
            ...(isFiniteRank(effectiveIndex) ? { "rank-order": rankOrderWithPathAtIndex(superstate, newSpaceState, newPath, item.path, effectiveIndex) } : {}),
        };
        await saveSpaceCache(superstate, newSpaceState, nextMetadata);
        superstate.spacesMap.set(item.path, new Set([...superstate.spacesMap.get(item.path)].filter((spacePath) => spacePath != newSpaceState.path)));
    } else {
        stagePathRankInSpace(superstate, newPath, item.path, effectiveIndex, newParent);
    }

    if (copy) {
        await superstate.spaceManager.copyPath(item.path, newParent);
    } else {
        await superstate.spaceManager.renamePath(item.path, newPath);
    }
    if (!replacingLinkInDestination) {
        await persistStagedPathRankInSpace(superstate, newPath, item.path, effectiveIndex, newParent);
    }
};

export const createSpace = async (superstate: Superstate, path: string, newSpace?: SpaceDefinition) => {
    const space = superstate.spacesIndex.get(path);

    let newSpaceCache;
    if (space) {
        if (!superstate.pathsIndex.has(path)) {
            return await superstate.reloadSpace(space);
            return;
        }
        if (newSpace) {
            newSpaceCache = await saveSpaceCache(superstate, space, newSpace);
        } else {
            return;
        }
    } else {
        const spaceInfo = superstate.spaceManager.spaceInfoForPath(path);

        await superstate.spaceManager.createSpace(spaceInfo.name, superstate.spaceManager.parentPathForPath(spaceInfo.path), newSpace);

        if (newSpace) {
            await saveSpaceCache(superstate, spaceInfo, newSpace);
            newSpaceCache = await superstate.reloadSpace(spaceInfo, newSpace);
        } else {
            newSpaceCache = await superstate.reloadSpace(spaceInfo);
        }
    }
    superstate.onSpaceDefinitionChanged(newSpaceCache, null);
    return newSpaceCache;
};

export const saveSpaceMetadataValue = async (superstate: Superstate, space: string, key: keyof SpaceDefinition, value: any) => {
    const spaceCache = superstate.spacesIndex.get(space);
    if (spaceCache?.type != "tag") {
        await superstate.spaceManager.saveSpace(space, (metadata) => ({ ...metadata, [key]: value }));
    }
    await superstate.updateSpaceMetadata(space, { ...spaceCache.metadata, [key]: value });
};

export const saveSpaceCache = async (superstate: Superstate, spaceInfo: SpaceState, metadata: SpaceDefinition) => {
    const spaceCache = superstate.spacesIndex.get(spaceInfo.path);
    const nextMetadata = { ...(spaceCache?.metadata ?? {}), ...metadata };
    if (spaceCache?.type != "tag") {
        await superstate.spaceManager.saveSpace(spaceInfo.path, (oldMetadata) => ({ ...oldMetadata, ...metadata }));
    }

    return superstate.updateSpaceMetadata(spaceInfo.path, nextMetadata);
};

export const addSpaceSeparator = async (superstate: Superstate, spacePath: string, rank?: number) => {
    const space = superstate.spacesIndex.get(spacePath);
    if (!space || !["folder", "tag", "vault"].includes(space.type)) return;

    const currentSort = effectiveSpaceSort(space.metadata?.sort, superstate.settings);
    const currentOrder = currentSort.field == "rank" && ensureArray(space.metadata?.["rank-order"]).length > 0
        ? ensureArray(space.metadata["rank-order"])
        : pinnedItemsFirst(superstate.getSpaceItems(spacePath) ?? [], space, currentSort).map((item) => item.path);
    const nextOrder = [...currentOrder];
    nextOrder.splice(Math.max(0, Math.min(rank ?? nextOrder.length, nextOrder.length)), 0, SPACE_SEPARATOR_PATH);

    await saveSpaceCache(superstate, space, {
        sort: {
            ...(storedSpaceSort(space.metadata?.sort) ?? {}),
            field: "rank",
            asc: true,
        },
        "rank-order": nextOrder,
    });
};

export const removeSpaceSeparator = async (superstate: Superstate, spacePath: string, rank: number) => {
    const space = superstate.spacesIndex.get(spacePath);
    const currentOrder = ensureArray(space?.metadata?.["rank-order"]);
    if (!space || !isSpaceSeparatorPath(currentOrder[rank])) return;
    await saveSpaceMetadataValue(superstate, spacePath, "rank-order", currentOrder.filter((_item, index) => index != rank));
};

export const setSpaceSeparatorVisible = async (superstate: Superstate, spacePath: string, rank: number, visible: boolean) => {
    const space = superstate.spacesIndex.get(spacePath);
    const currentOrder = [...ensureArray(space?.metadata?.["rank-order"])];
    if (!space || !isSpaceSeparatorPath(currentOrder[rank])) return;
    currentOrder[rank] = visible ? SPACE_SEPARATOR_PATH : SPACE_HIDDEN_SEPARATOR_PATH;
    await saveSpaceMetadataValue(superstate, spacePath, "rank-order", currentOrder);
};

export const moveSpaceSeparator = async (superstate: Superstate, oldSpacePath: string, oldRank: number, newSpacePath: string, newRank: number, copy = false) => {
    const oldSpace = superstate.spacesIndex.get(oldSpacePath);
    const newSpace = superstate.spacesIndex.get(newSpacePath);
    const separatorPath = ensureArray(oldSpace?.metadata?.["rank-order"])[oldRank];
    if (!oldSpace || !newSpace || !isSpaceSeparatorPath(separatorPath)) return;
    if (effectiveSpaceSort(newSpace.metadata?.sort, superstate.settings).field != "rank") return;

    if (oldSpacePath == newSpacePath) {
        const nextOrder = [...ensureArray(oldSpace.metadata?.["rank-order"])];
        if (!copy) nextOrder.splice(oldRank, 1);
        const adjustedRank = !copy && oldRank < newRank ? newRank - 1 : newRank;
        nextOrder.splice(Math.max(0, Math.min(adjustedRank, nextOrder.length)), 0, separatorPath);
        await saveSpaceMetadataValue(superstate, oldSpacePath, "rank-order", nextOrder);
        return;
    }

    const destinationOrder = [...ensureArray(newSpace.metadata?.["rank-order"])];
    destinationOrder.splice(Math.max(0, Math.min(newRank, destinationOrder.length)), 0, separatorPath);
    await saveSpaceMetadataValue(superstate, newSpacePath, "rank-order", destinationOrder);
    if (!copy) await removeSpaceSeparator(superstate, oldSpacePath, oldRank);
};

export const defaultSpace = async (superstate: Superstate, activeFile: PathState): Promise<SpaceState> => {
    let spaceState = null;
    if (superstate.settings.newFileLocation == "folder") {
        spaceState = superstate.spacesIndex.get(superstate.settings.newFileFolderPath);
    } else if (superstate.settings.newFileLocation == "current" && activeFile && activeFile.type == "space") {
        spaceState = superstate.spacesIndex.get(activeFile.path);
    } else if (activeFile) {
        spaceState = superstate.spacesIndex.get(activeFile.parent);
    }
    if (!spaceState) {
        spaceState = superstate.spacesIndex.get("/");
    }
    return spaceState;
};

export const linkPathToSpaceAtIndex = async (superstate: Superstate, space: SpaceState, path: string, rank?: number) => {
    path = canonicalTagSpacePath(path);
    if (path == space.path) {
        superstate.ui.notify('Linking space to itself not allowed')
        return;
    }
    if (pathIsAlreadyInFolderSpace(superstate, path, space)) {
        superstate.ui.notify(i18n.notice.cannotLinkToOwnFolder);
        return false;
    }
    const spaceExists = ensureArray(space.metadata.links) ?? [];
    const pathExists = spaceExists.find((f) => sameTagSpaceLink(f, path));
    if (pathExists) {
        superstate.ui.notify(i18n.notice.cannotLinkToOwnFolder);
        return false;
    }
    spaceExists.push(path);

    await saveSpaceCache(superstate, space, { ...space.metadata, links: spaceExists });

    const currentSpaces = superstate.spacesMap.get(path);
    superstate.spacesMap.set(path, new Set([...currentSpaces, space.path]));

    if (superstate.pathsIndex.has(path)) {
        await superstate.reloadPath(path, true).then(() => superstate.dispatchEvent("pathStateUpdated", { path: path }));
    } else {
        superstate.dispatchEvent("pathStateUpdated", { path: path });
        superstate.dispatchEvent("spaceStateUpdated", { path: space.path });
    }
    await updatePathRankInSpace(superstate, path, rank, space.path);
};

export const linkedTagSpaceUri = (space: SpaceState, tagSpacePath: string) =>
    ensureArray(space?.metadata?.links).find((link) => sameTagSpaceLink(link, tagSpacePath));

export const setLinkedTagSpaceFiltered = async (superstate: Superstate, parentSpacePath: string, tagSpacePath: string, filtered: boolean) => {
    const parentSpace = superstate.spacesIndex.get(parentSpacePath);
    if (!parentSpace) return;
    const links = ensureArray(parentSpace.metadata?.links);
    const currentLink = links.find((link) => sameTagSpaceLink(link, tagSpacePath));
    if (!currentLink) return;
    const nextLink = setTagSpaceLinkFiltered(currentLink, filtered);
    if (nextLink == currentLink) return;
    await saveSpaceMetadataValue(superstate, parentSpace.path, "links", links.map((link) => link == currentLink ? nextLink : link));
    superstate.dispatchEvent("spaceStateUpdated", { path: parentSpace.path });
};

export const removeSpace = async (superstate: Superstate, space: string) => {
    const spaceCache = superstate.spacesIndex.get(space);
    if (!spaceCache) return;
    if (spaceCache.type == "tag") {
        await superstate.onTagDeleted(spaceCache.name);
    } else if (spaceCache.type == "folder") {
        await deletePath(superstate, spaceCache.path);
    }
};

export const updateSpaceSort = async (superstate: Superstate, path: string, sort: Partial<SpaceSort> | null) => {
    const space = superstate.spacesIndex.get(path);
    if (!space)
        return;

    if (sort == null) {
        if (!space.metadata?.sort)
            return;
        const nextRankOrder = rankOrderForSort(superstate, path, defaultSortForSettings(superstate.settings));
        if (space.type != "tag") {
            const defPath = space.space?.defPath;
            const defExists = defPath ? await superstate.spaceManager.pathExists(defPath) : false;
            if (defExists) {
                superstate.spaceManager.saveSpace(path, (metadata) => ({
                    ...metadata,
                    sort: undefined,
                    ...(nextRankOrder != undefined ? { "rank-order": nextRankOrder } : {}),
                }));
            }
        }
        await superstate.updateSpaceMetadata(path, {
            ...space.metadata,
            sort: undefined,
            ...(nextRankOrder != undefined ? { "rank-order": nextRankOrder } : {}),
        });
        return;
    }

    const currentStoredSort = storedSpaceSort(space.metadata?.sort);
    const nextStoredSort = mergedStoredSpaceSort(currentStoredSort, sort);
    const currentSort = effectiveSpaceSort(currentStoredSort, superstate.settings);
    const nextSort = effectiveSpaceSort(nextStoredSort, superstate.settings);
    const shouldGroupCurrentRankOrder = currentSort.field == "rank" && nextSort.field == "rank" && currentSort.group != true && nextSort.group == true;
    const nextRankOrder = shouldGroupCurrentRankOrder ? rankOrderWithGroupedItemsFirst(superstate, space, nextSort) : undefined;
    if (JSON.stringify(currentStoredSort) == JSON.stringify(nextStoredSort) && nextRankOrder == undefined)
        return;

    if (space.type == "tag") {
        await superstate.updateSpaceMetadata(path, {
            ...space.metadata,
            sort: nextStoredSort,
            ...(nextRankOrder != undefined ? { "rank-order": nextRankOrder } : {}),
        });
        return;
    }

    await superstate.spaceManager.saveSpace(path, (metadata) => ({
        ...metadata,
        sort: nextStoredSort,
        ...(nextRankOrder != undefined ? { "rank-order": nextRankOrder } : {}),
    }));
    await superstate.updateSpaceMetadata(path, {
        ...space.metadata,
        sort: nextStoredSort,
        ...(nextRankOrder != undefined ? { "rank-order": nextRankOrder } : {}),
    });
};

export const removePathsFromSpace = async (superstate: Superstate, spacePath: string, paths: string[]) => {
    const space = superstate.spacesIndex.get(spacePath);
    if (!space) return;

    if (space.type == "tag") {
        return;
    } else if (space.type == "folder" || space.type == "vault") {
        paths.forEach((path) => {
            const nextSpaces = new Set([...superstate.spacesMap.get(path)].filter((itemSpace) => itemSpace != space.path));
            superstate.spacesMap.set(path, nextSpaces);
        });
        await saveSpaceMetadataValue(
            superstate,
            space.path,
            "links",
            ensureArray(space.metadata?.links).filter((f) => !paths.some((g) => sameTagSpaceLink(g, f))),
        );
        paths.forEach((path) => superstate.dispatchEvent("pathStateUpdated", { path }));
        superstate.dispatchEvent("spaceStateUpdated", { path: space.path });
    }
};

export const newPathInSpace = async (superstate: Superstate, space: SpaceState, type: string, name: string, dontOpen?: boolean, content?: string, location?: TargetLocation) => {
    let newPath;
    if (space.type == "tag") {
        // not supported
    } else
        newPath = await superstate.spaceManager.createItemAtPath(space.path, type, name, content);

    if (!dontOpen)
        superstate.ui.openPath(newPath, location);

    return newPath;
};
