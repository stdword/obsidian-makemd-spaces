import _ from "lodash";
import { PathCache } from "shared/types/caches";
import { DBRow, SpaceProperty, SpaceTable, SpaceTables } from "shared/types/mdb";
import { ContextState, PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";
import { SpaceInfo } from "shared/types/spaceInfo";
import { orderStringArrayByArray, uniq } from "shared/utils/array";

import { builtinSpaces } from "core/types/space";
import { pathStateToContextRow } from "core/utils/contexts/contextDefaults";
import { linkContextRow, mergeContextRows, syncContextRow } from "core/utils/contexts/linkContextRow";
import { initiateString, tagSpacePathFromTag } from "core/utils/strings";
import { builtinSpacePathPrefix, tagsSpacePath } from "shared/schemas/builtin";
import { defaultContextDBSchema, defaultContextSchemaID } from "shared/schemas/fields";
import { defaultContextFields } from "shared/schemas/fields";
import { normalizeContextPath, PathPropertyName, PathPropertyPinned } from "shared/types/context";
import { IndexMap } from "shared/types/indexMap";
import { excludePathPredicate } from "utils/hide";
import { parseLinkString, parseMultiString } from "utils/parsers";
import { pathToString } from "utils/path";
import { tagPathToTag } from "utils/tags";

export const applyContextLabelsToPaths = (contextTable: SpaceTable, pathsIndex: Map<string, PathState>) => {
    contextTable?.rows?.forEach((row) => {
        const rowPath = row[PathPropertyName];
        const pathState = pathsIndex.get(normalizeContextPath(rowPath));
        if (!pathState) return;
        const isFolder = rowPath?.endsWith("/") || pathState.type == "space" || pathState.subtype == "folder" || pathState.metadata?.file?.isFolder;
        if (isFolder || !row.color || row.color == pathState.effectiveLabel?.color) return;
        pathsIndex.set(pathState.path, {
            ...pathState,
            effectiveLabel: {
                ...pathState.label,
                ...pathState.effectiveLabel,
                color: row.color,
            },
        });
    });
};

export const parseContextTableToCache = (
    space: SpaceInfo,
    mdb: SpaceTables,
    paths: string[],
    dbExists: boolean,
    pathsIndex: Map<string, PathState>,
    spacesMap: IndexMap,
    _settings: MakeMDSettings,
    contextsIndex: Map<string, ContextState>,
    options: { force?: boolean; calculate?: boolean },
): { changed: boolean; cache: ContextState } => {
    const spaceMap: { [key: string]: { [key: string]: string[] } } = {};

    if (!space) return { changed: false, cache: null };
    if (!mdb) {
        return {
            changed: false,
            cache: {
                path: space.path,
                schemas: [],
                outlinks: [],
                contexts: [],
                paths: [],
                contextTable: null,
                spaceMap,
                dbExists: false,
                mdb: {},
            },
        };
    }
    const schemas = Object.values(mdb).map((f) => f.schema);
    const cols = defaultContextFields.rows as SpaceProperty[];
    const schema = mdb[defaultContextSchemaID]?.schema ?? defaultContextDBSchema;
    const contextPaths = mdb[defaultContextSchemaID]?.rows?.map((f) => normalizeContextPath(f[PathPropertyName])) ?? [];

    const missingPaths = paths.filter((f) => !contextPaths.includes(f));
    const newPaths = [...orderStringArrayByArray(paths ?? [], contextPaths), ...missingPaths];
    const spacePath = pathsIndex.get(space.path);
    let rows = mergeContextRows(paths, mdb[defaultContextSchemaID]?.rows ?? [], pathsIndex, spacesMap, spacePath);

    rows = rows.map((_row) => {
        const row = _row as DBRow;
        const normalizedPath = normalizeContextPath(row[PathPropertyName]);
        const pathState = pathsIndex.get(normalizedPath);
        const fileRow = pathState ? pathStateToContextRow(pathState) : {};
        const normalizedRow = {
            ...fileRow,
            [PathPropertyName]: fileRow[PathPropertyName] ?? row[PathPropertyName],
            color: fileRow[PathPropertyName]?.endsWith("/") ? "" : row.color ?? fileRow.color ?? "",
            [PathPropertyPinned]: row[PathPropertyPinned] ?? fileRow[PathPropertyPinned] ?? "false",
        };
        return syncContextRow(pathsIndex, normalizedRow, cols, spacePath);
    });
    if (options?.calculate)
        rows = rows.map((f) => linkContextRow(pathsIndex, contextsIndex, f, cols, spacePath));

    const contextTable: SpaceTable = {
        schema,
        cols,
        rows: rows,
    } as SpaceTable;

    const contextCols = contextTable.cols?.filter((f) => f.type.startsWith("context")) ?? [];
    const linkCols = contextTable.cols?.filter((f) => f.type.startsWith("link")) ?? [];
    const contexts = uniq(contextCols.map((f) => f.value));
    contextCols.forEach((f) => {
        spaceMap[f.name] = {};
        contextTable.rows.forEach((g) => {
            parseMultiString(g[f.name]).forEach((h) => (spaceMap[f.name][h] = [...(spaceMap[f.name][h] ?? []), g[PathPropertyName]]));
        });
    });

    const outlinks = uniq(contextTable.rows.reduce((p, c) => uniq([...p, ...[...contextCols, ...linkCols].flatMap((f) => parseMultiString(c[f.name]).map((f) => parseLinkString(f)))]), []));
    const changed = !_.isEqual(contextTable, mdb[defaultContextSchemaID]);
    mdb[defaultContextSchemaID] = contextTable;
    const cache: ContextState = {
        contextTable,
        path: space.path,
        contexts: contexts,
        outlinks: outlinks,
        paths: newPaths,
        schemas,
        spaceMap,
        dbExists,
        mdb,
    };
    return { changed, cache };
};

const stripExtension = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0) return fileName;
    return fileName.slice(0, dotIndex);
};

const displayNameForPath = (path: string, pathCache: PathCache, fallbackName?: string) => {
    const file = pathCache?.file;
    if (file?.name) return file.name;

    const filePath = file?.path ?? path;
    const fileName = file?.filename ?? filePath.split("/").pop() ?? fallbackName ?? pathToString(path);
    if (pathCache?.type == "space" || pathCache?.type == "folder" || file?.isFolder) {
        return fileName;
    }
    return stripExtension(fileName);
};

export const parseAllMetadata = (fileCache: Map<string, PathCache>, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>, oldCache: Map<string, PathState>): { [key: string]: { changed: boolean; cache: PathState } } => {
    const cache: { [key: string]: { changed: boolean; cache: PathState } } = {};
    for (const [path, _pathCache] of fileCache) {
        const pathCache = _pathCache;
        if (!pathCache) continue;

        const parent = _pathCache?.parent ?? "";
        const type = _pathCache?.type ?? "";
        const subtype = _pathCache?.subtype ?? "";
        const name = spacesCache.has(path) ? spacesCache.get(path).space.name : displayNameForPath(path, pathCache);
        const oldMetadata = oldCache?.get(path);
        const { changed, cache: metadata } = parseMetadata(path, settings, spacesCache, pathCache, name, type, subtype, parent, oldMetadata);
        cache[path] = { changed, cache: metadata };
    }
    return cache;
};

export const parseMetadata = (path: string, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>, pathCache: PathCache, name: string, type: string, subtype: string, parent: string, oldMetadata: PathState): { changed: boolean; cache: PathState } => {
    if (!pathCache) return { changed: false, cache: null };
    const displayName = displayNameForPath(path, pathCache, name);
    const defaultSticker = (sticker: string, type: string, subtype: string, path: string, extension?: string, savedSticker?: string): string => {
        if (type == "space") {
            if (path == "/") return "ui//home";
            if (path.startsWith("spaces://")) return "ui//hash";
            if (savedSticker?.length > 0) return savedSticker;
            if (sticker?.length > 0) return sticker;
            return "ui//folder";
        }
        const fileExtension = extension?.toLowerCase() || subtype?.toLowerCase() || path.split(".").pop()?.toLowerCase();
        if (["png", "jpg", "jpeg", "avif", "webp", "gif"].includes(fileExtension)) return "ui//image";
        if (fileExtension == "canvas") return "ui//layout-dashboard";
        if (fileExtension == "base") return "ui//table";
        if (fileExtension == "excalidraw" || fileExtension == "excalidraw.md" || path.toLowerCase().endsWith(".excalidraw.md")) return "ui//excalidraw";
        if (fileExtension == "md") return "ui//file-text";
        return "ui//file";
    };

    const sourceLabel = pathCache?.label ?? { sticker: "", color: "" };
    const cache: PathState = {
        label: sourceLabel,
        path,
        name: displayName,
    };

    const tags: string[] = [];
    const fileTags: string[] = pathCache?.tags?.filter((f) => f).map((f) => f.toLowerCase()) ?? [];
    let hidden = excludePathPredicate(settings, path);
    if (path.startsWith(builtinSpacePathPrefix)) {
        const builtin = path.replace(builtinSpacePathPrefix, "");
        hidden = builtinSpaces[builtin]?.hidden;
    }
    const getTagsFromCache = (map: Map<string, SpaceState>, spaces: string[], seen = new Set()) => {
        const keys: string[] = [];

        for (const space of spaces) {
            const valList = ((map.get(space)?.contexts as string[]) ?? []).filter((f) => f).map((f) => f.toLowerCase());

            for (const key of valList) {
                // If the current key is already seen, skip it to prevent infinite loops
                if (seen.has(key)) continue;

                // Check if any value from valuesList exists in the current key's value list

                keys.push(key);
                seen.add(key); // Mark the key as seen

                // Recursively search for this key in the map
                keys.push(...getTagsFromCache(map, [tagSpacePathFromTag(key)], seen));
            }
        }
        return keys;
    };

    if (spacesCache.has(parent)) {
        for (const def of spacesCache.get(parent).contexts ?? []) {
            tags.filter((f) => f).push(def.toLowerCase());
        }
    }

    tags.push(...fileTags);

    const parentDefaultSticker = spacesCache.get(parent)?.metadata?.defaultSticker;
    const ownSpaceMetadata = spacesCache.get(path)?.metadata;
    const ownSticker = ownSpaceMetadata?.sticker ?? "";
    const sticker = type == "space" ? defaultSticker(parentDefaultSticker, type, subtype, path, pathCache?.file?.extension, ownSticker) : defaultSticker("", type, subtype, path, pathCache?.file?.extension, "");
    const parentDefaultColor = spacesCache.get(parent)?.metadata?.defaultColor;
    const ownColor = ownSpaceMetadata?.color ?? "";
    const fileColors = spacesCache.get(parent)?.metadata?.["file-colors"] ?? {};
    const color = type == "space" ? (initiateString(ownColor, parentDefaultColor) ?? "") : (fileColors[path] ?? parentDefaultColor ?? "");

    const outlinks = pathCache?.resolvedLinks ?? [];
    const spaceNames = [];
    const pathState: PathState = {
        ...cache,
        name: displayName,
        tags: uniq(tags),
        type,
        subtype,
        parent,
        label: {
            ...sourceLabel,
        },
        effectiveLabel: {
            sticker,
            color,
        },

        metadata: {
            ...pathCache,
        },
        outlinks,
    };

    const spaces: string[] = [];
    const linkedSpaces: string[] = [];
    const liveSpaces: string[] = [];
    if (subtype == "tag") {
        spaces.push(tagsSpacePath);
    }
    for (const s of tags) {
        spaces.push(tagSpacePathFromTag(s));
        spaceNames.push(s);
    }
    const evaledSpaces = new Set<string>();
    const evalSpace = (s: string, space: SpaceState) => {
        if (evaledSpaces.has(s)) return;
        evaledSpaces.add(s);
        if (space.dependencies?.length > 0) {
            for (const dep of space.dependencies) {
                if (spacesCache.has(dep)) {
                    evalSpace(dep, spacesCache.get(dep));
                }
            }
        }

        if (subtype != "tag" && subtype != "default") {
            if (space.space && space.space.path == parent) {
                spaces.push(s);
                spaceNames.push(space.name);
                return;
            }
        }
        if (space.metadata?.links?.length > 0) {
            const spaceItem = (space.metadata?.links ?? []).find((f) => f == pathState.path);
            if (spaceItem) {
                if (subtype != "md" && subtype != "folder" && space.type == "tag") {
                    tags.push(tagPathToTag(space.path));
                }
                spaces.push(s);
                spaceNames.push(space.name);
                linkedSpaces.push(s);
            }
        }
    };
    for (const [s, space] of spacesCache) {
        evalSpace(s, space);
    }

    const newTags = getTagsFromCache(spacesCache, spaces);
    spaces.push(...newTags.map((f) => tagSpacePathFromTag(f)));
    spaceNames.push(...newTags);

    pathState.tags.push(...newTags);
    const metadata: PathState = hidden
        ? { ...pathState, spaces: [], hidden }
        : {
              ...pathState,
              tags: uniq(tags),
              spaces: uniq(spaces).filter((f) => f != path),
              linkedSpaces,
              liveSpaces,
              spaceNames,
              hidden,
          };
    let changed = true;

    if (oldMetadata && _.isEqual(metadata, oldMetadata)) {
        changed = false;
    }
    return { changed, cache: metadata };
};
