import { ensureArray, ensureBoolean, ensureString } from "core/utils/strings";
import { compareByField, compareByFieldCaseInsensitive, compareByFieldDeep } from "core/utils/tree";
import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { TargetLocation } from "shared/types/path";
import { CacheState, PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";
import { SpaceDefinition, SpaceSort } from "shared/types/spaceDef";
import { SpaceInfo } from "shared/types/spaceInfo";
import { PathStateWithRank } from "shared/types/superstate";
import { movePath } from "shared/utils/uri";
import { deletePath } from "./path";
import { addTagToPath, deleteTagFromPath } from "./tags";

const hasOwn = (value: Record<string, any>, key: string) => value != null && Object.prototype.hasOwnProperty.call(value, key);

export const defaultSortForSettings = (settings: MakeMDSettings): SpaceSort => ({
    field: settings?.defaultSpaceSort?.field ?? "name",
    asc: hasOwn(settings?.defaultSpaceSort as Record<string, any>, "asc") ? ensureBoolean(settings.defaultSpaceSort.asc) : true,
    group: settings?.defaultFoldersAtTop ?? true,
    recursive: false,
});

export const effectiveSpaceSort = (value: Partial<SpaceSort>, settings: MakeMDSettings): SpaceSort => {
    const fallback = defaultSortForSettings(settings);
    return {
        field: ensureString(value?.["field"] ?? fallback.field),
        asc: hasOwn(value as Record<string, any>, "asc") ? ensureBoolean(value.asc) : fallback.asc,
        group: hasOwn(value as Record<string, any>, "group") ? ensureBoolean(value.group) : fallback.group,
        recursive: hasOwn(value as Record<string, any>, "recursive") ? ensureBoolean(value.recursive) : fallback.recursive,
    };
};

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

type TreeNodeType = "space" | "file" | "group" | "new";
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
}
export const spaceToTreeNode = (path: PathStateWithRank, collapsed: boolean, sortable: boolean, depth: number, parentId: string, parentPath: string, childrenCount: number, sort?: SpaceSort): TreeNode => {
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
    };
};
export const pathStateToTreeNode = (_superstate: Superstate, item: PathStateWithRank, space: string, path: string, depth: number, i: number, collapsed: boolean, sortable: boolean, childrenCount: number, parentId: string): TreeNode => ({
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
});

export const spaceRowHeight = (_superstate: Superstate, preset: number, section: boolean) => {
    const spaceHeight = preset ?? 29;
    return spaceHeight + (section ? 10 : 0);
};

export const defaultSpaceSort = {
    field: "name",
    asc: true,
    group: true,
    recursive: false,
};

export const spaceSortLabel = (sort: SpaceSort, tagSpace: boolean) => {
    const fieldLabel = sort.field == "name" ? "AZ" : sort.field == "ctime" ? "+" : sort.field == "mtime" ? "~" : sort.field == "rank" ? "#" : sort.field;
    const directionLabel = sort.field == "name" ? (sort.asc ? "↓" : "↑") : sort.asc ? "↓" : "↑";
    return `${!tagSpace && sort.group ? ":" : ""}${fieldLabel}${directionLabel}${!tagSpace && sort.recursive ? "*" : ""}`;
};

export const spaceSortFn = (sortStrategy: SpaceSort) => (a: CacheState, b: CacheState) => {
    if (sortStrategy.field == "rank") {
        const aRanked = typeof a.rank == "number" && a.rank >= 0;
        const bRanked = typeof b.rank == "number" && b.rank >= 0;
        if (aRanked && bRanked && a.rank != b.rank) {
            return a.rank - b.rank;
        }
        const fallbackFns = [];
        if (sortStrategy.group) {
            fallbackFns.push(compareByField("type", false));
        }
        fallbackFns.push(compareByFieldCaseInsensitive("name", true));
        return fallbackFns.reduce((p, c) => {
            return p == 0 ? c(a, b) : p;
        }, 0);
    }
    const sortFns = [];
    if (sortStrategy.group) {
        sortFns.push(compareByField("type", false));
    }
    if (sortStrategy.field == "name") {
        sortFns.push(compareByFieldCaseInsensitive(sortStrategy.field, sortStrategy.asc));
    } else if (sortStrategy.field.startsWith("props")) {
        const propName = sortStrategy.field.split(".")[1];
        const fieldFunc = (obj: Record<string, any>) => obj?.metadata?.property?.[propName];
        sortFns.push(compareByFieldDeep(fieldFunc, sortStrategy.asc));
    } else if (["ctime", "mtime"].includes(sortStrategy.field)) {
        const fieldFunc = (obj: Record<string, any>) => obj?.[sortStrategy.field] ?? obj?.metadata?.file?.[sortStrategy.field] ?? obj?.metadata?.[sortStrategy.field] ?? "";
        sortFns.push((_a: Record<string, any>, _b: Record<string, any>) => {
            const a = sortStrategy.asc ? _a : _b;
            const b = sortStrategy.asc ? _b : _a;
            const aValue = Number(fieldFunc(a) || 0);
            const bValue = Number(fieldFunc(b) || 0);
            return aValue - bValue;
        });
    } else {
        const fieldFunc = (obj: Record<string, any>) => obj?.[sortStrategy.field] ?? obj?.metadata?.file?.[sortStrategy.field] ?? obj?.metadata?.[sortStrategy.field];
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
        const currentOrder = spaceState.metadata?.["rank-order"] ?? superstate.getSpaceItems(space).map((item) => item.path);
        const nextOrder = currentOrder.filter((itemPath) => itemPath != path);
        nextOrder.splice(Math.max(0, rank ?? nextOrder.length), 0, path);
        await saveSpaceMetadataValue(superstate, space, "rank-order", nextOrder);
        return;
    }
};

export const movePathToNewSpaceAtIndex = async (superstate: Superstate, item: PathState, newParent: string, index: number, copy?: boolean) => {
    if (!item) return;
    //pre-save before vault change happens so we can save the rank
    const currentPathState = superstate.pathsIndex.get(item.path);
    if (!currentPathState) return;
    const newPath = newParent == "/" ? currentPathState.name : newParent + "/" + currentPathState.name;

    if (await superstate.spaceManager.pathExists(newPath)) {
        superstate.ui.notify(i18n.notice.fileExists);
        return;
    }

    if (copy) {
        await superstate.spaceManager.copyPath(item.path, newParent);
    } else {
        await superstate.spaceManager.renamePath(item.path, movePath(item.path, newParent));
    }
    updatePathRankInSpace(superstate, newPath, index, newParent);
};

export const createSpace = async (superstate: Superstate, path: string, newSpace?: SpaceDefinition) => {
    const space = superstate.spacesIndex.get(path);

    let newSpaceCache;
    if (space) {
        if (!superstate.pathsIndex.has(path)) {
            return await superstate.reloadSpace(space.space);
            return;
        }
        if (newSpace) {
            newSpaceCache = await saveSpaceCache(superstate, space.space, newSpace);
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
        superstate.spaceManager.saveSpace(space, (metadata) => ({ ...metadata, [key]: value }));
    }
    await superstate.updateSpaceMetadata(space, { ...spaceCache.metadata, [key]: value });
};

export const saveSpaceProperties = async (superstate: Superstate, space: string, properties: Record<string, any>) => {
    superstate.spaceManager.saveSpace(space, (metadata) => metadata, properties);
};

export const saveSpaceCache = async (superstate: Superstate, spaceInfo: SpaceInfo, metadata: SpaceDefinition) => {
    const spaceCache = superstate.spacesIndex.get(spaceInfo.path);
    const nextMetadata = { ...(spaceCache?.metadata ?? {}), ...metadata };
    if (spaceCache?.type != "tag") {
        await superstate.spaceManager.saveSpace(spaceInfo.path, (oldMetadata) => ({ ...oldMetadata, ...metadata }));
    }

    return superstate.updateSpaceMetadata(spaceInfo.path, nextMetadata);
};

export const addPathToSpaceAtIndex = async (superstate: Superstate, space: SpaceState, path: string, rank?: number) => {
    if (space.type == "tag") {
        return addTagToPath(superstate, path, space.name);
    } else {
        return linkPathToSpaceAtIndex(superstate, space, path, rank);
    }
};

export const addPathsToSpaceAtIndex = async (superstate: Superstate, space: SpaceState, path: string, rank?: number) => {
    if (space.type == "tag") {
        return addTagToPath(superstate, path, space.name);
    } else {
        return linkPathToSpaceAtIndex(superstate, space, path, rank);
    }
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
    if (path == space.path) {
        // superstate.ui.notify('Pinning space to itself not currently allowed')
        return;
    }
    const spaceExists = ensureArray(space.metadata.links) ?? [];
    const pathExists = spaceExists.find((f) => f == path);
    if (!pathExists) {
        spaceExists.push(path);
    }

    await saveSpaceCache(superstate, space.space, { ...space.metadata, links: spaceExists });

    await superstate.reloadPath(path, true).then(() => superstate.dispatchEvent("pathStateUpdated", { path: path }));
    updatePathRankInSpace(superstate, path, rank, space.path);
};

export const removeSpace = async (superstate: Superstate, space: string) => {
    const spaceCache = superstate.spacesIndex.get(space);
    if (!spaceCache) return;
    if (spaceCache.type == "tag") {
        superstate.onTagDeleted(spaceCache.name);
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
        if (space.type != "tag") {
            const defPath = space.space?.defPath;
            const defExists = defPath ? await superstate.spaceManager.pathExists(defPath) : false;
            if (defExists) {
                superstate.spaceManager.saveSpace(path, (metadata) => ({
                    ...metadata,
                    sort: undefined,
                }));
            }
        }
        await superstate.updateSpaceMetadata(path, {
            ...space.metadata,
            sort: undefined,
        });
        return;
    }

    const currentStoredSort = storedSpaceSort(space.metadata?.sort);
    const nextStoredSort = mergedStoredSpaceSort(currentStoredSort, sort);
    if (JSON.stringify(currentStoredSort) == JSON.stringify(nextStoredSort))
        return;

    if (space.type == "tag") {
        await superstate.updateSpaceMetadata(path, {
            ...space.metadata,
            sort: nextStoredSort,
        });
        return;
    }

    await superstate.spaceManager.saveSpace(path, (metadata) => ({
        ...metadata,
        sort: nextStoredSort,
    }));
    await superstate.updateSpaceMetadata(path, {
        ...space.metadata,
        sort: nextStoredSort,
    });
};

export const metadataPathForSpace = (_superstate: Superstate, space: SpaceInfo) => {
    return space.defPath;
};

export const removePathsFromSpace = async (superstate: Superstate, spacePath: string, paths: string[]) => {
    const space = superstate.spacesIndex.get(spacePath);
    if (!space) return;

    if (space.type == "tag") {
        await Promise.all(paths.map((path) => deleteTagFromPath(superstate, path, space.name)));
    } else if (space.type == "folder" || space.type == "vault") {
        await saveSpaceMetadataValue(
            superstate,
            space.path,
            "links",
            space.metadata.links.filter((f) => !paths.some((g) => g == f)),
        );
    }
};

export const newPathInSpace = async (superstate: Superstate, space: SpaceState, type: string, name: string, dontOpen?: boolean, content?: string, location?: TargetLocation) => {
    let newPath;
    if (space.type == "tag") {
        newPath = await superstate.spaceManager.createItemAtPath("/", type, name, content);
        await addTagToPath(superstate, newPath, space.name);
    } else {
        newPath = await superstate.spaceManager.createItemAtPath(space.path, type, name, content);
    }
    if (!dontOpen) {
        superstate.ui.openPath(newPath, location);
    }
    return newPath;
};

export const saveLabel = (superstate: Superstate, path: string, label: string, value: string) => {
    superstate.spaceManager.saveLabel(path, label, value);
};

export const saveProperties = (superstate: Superstate, path: string, properties: Record<string, any>) => {
    if (superstate.spacesIndex.has(path)) {
        return saveSpaceProperties(superstate, path, properties);
    } else {
        return superstate.spaceManager.saveProperties(path, properties);
    }
};
