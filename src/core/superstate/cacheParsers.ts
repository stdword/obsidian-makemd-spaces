import _ from "lodash";
import { PathCache } from "shared/types/caches";
import { SpaceProperty, SpaceTable, SpaceTables } from "shared/types/mdb";
import { ContextState, PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";
import { SpaceInfo } from "shared/types/spaceInfo";
import { orderStringArrayByArray, uniq } from "shared/utils/array";

import { builtinSpaces } from "core/types/space";
import { linkContextRow, mergeContextRows, propertyDependencies, syncContextRow } from "core/utils/contexts/linkContextRow";
import { ensureArray, initiateString, tagSpacePathFromTag } from "core/utils/strings";
import { builtinSpacePathPrefix, tagsSpacePath } from "shared/schemas/builtin";
import { defaultContextDBSchema, defaultContextSchemaID } from "shared/schemas/context";
import { defaultContextFields } from "shared/schemas/fields";
import { PathPropertyName } from "shared/types/context";
import { IndexMap } from "shared/types/indexMap";
import { excludePathPredicate } from "utils/hide";
import { parseLinkString, parseMultiString } from "utils/parsers";
import { pathToString } from "utils/path";
import { tagPathToTag } from "utils/tags";
import { supportedFileTypes } from "adapters/image/imageAdapter";

export const parseContextTableToCache = (
    space: SpaceInfo,
    mdb: SpaceTables,
    paths: string[],
    dbExists: boolean,
    pathsIndex: Map<string, PathState>,
    spacesMap: IndexMap,
    runContext: math.MathJsInstance,
    settings: MakeMDSettings,
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
    let cols = mdb[defaultContextSchemaID]?.cols;
    if (!cols || cols.length == 0) {
        cols = defaultContextFields.rows as SpaceProperty[];
    }
    const schema = mdb[defaultContextSchemaID]?.schema ?? defaultContextDBSchema;
    const contextPaths = mdb[defaultContextSchemaID]?.rows?.map((f) => f[PathPropertyName]) ?? [];

    const missingPaths = paths.filter((f) => !contextPaths.includes(f));
    const newPaths = [...orderStringArrayByArray(paths ?? [], contextPaths), ...missingPaths];
    const dependencies = propertyDependencies(cols);
    const spacePath = pathsIndex.get(space.path);
    let rows = mergeContextRows(paths, mdb[defaultContextSchemaID]?.rows ?? [], pathsIndex, spacesMap, spacePath);

    rows = rows.map((f) => syncContextRow(pathsIndex, f, cols, spacePath));
    if (options?.calculate) {
        rows = rows.map((f) => linkContextRow(runContext, pathsIndex, contextsIndex, spacesMap, f, cols, spacePath, settings, dependencies));
    }

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
    let changed = false;
    if (!_.isEqual(contextTable, mdb[defaultContextSchemaID])) {
        changed = true;
    }
    return { changed, cache };
};

export const parseAllMetadata = (fileCache: Map<string, PathCache>, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>, oldCache: Map<string, PathState>): { [key: string]: { changed: boolean; cache: PathState } } => {
    const cache: { [key: string]: { changed: boolean; cache: PathState } } = {};
    for (const [path, _pathCache] of fileCache) {
        const pathCache = _pathCache;
        if (!pathCache) continue;

        const parent = _pathCache?.parent ?? "";
        const type = _pathCache?.type ?? "";
        const subtype = _pathCache?.subtype ?? "";
        const name = spacesCache.has(path) ? spacesCache.get(path).space.name : _pathCache?.label?.name;
        const oldMetadata = oldCache?.get(path);
        const { changed, cache: metadata } = parseMetadata(path, settings, spacesCache, pathCache, name, type, subtype, parent, oldMetadata);
        cache[path] = { changed, cache: metadata };
    }
    return cache;
};

export const parseMetadata = (path: string, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>, pathCache: PathCache, name: string, type: string, subtype: string, parent: string, oldMetadata: PathState): { changed: boolean; cache: PathState } => {
    if (!pathCache) return { changed: false, cache: null };
    const defaultSticker = (sticker: string, type: string, subtype: string, path: string, extension?: string, savedSticker?: string): string => {
        if (type == "space") {
            if (path == "/") return "ui//home";
            if (path.startsWith("spaces://")) return "ui//hash";
            if (savedSticker?.length > 0) return savedSticker;
            if (sticker?.length > 0) return sticker;
            return "ui//folder";
        }
        const fileExtension = extension?.toLowerCase() || subtype?.toLowerCase() || path.split(".").pop()?.toLowerCase();
        if (supportedFileTypes.includes(fileExtension)) return "ui//image";
        if (fileExtension == "canvas") return "ui//canvas";
        if (fileExtension == "base") return "ui//table";
        if (fileExtension == "md") return "ui//file-text";
        return "ui//file";
    };

    const cache: PathState = {
        label: pathCache?.label,
        path,
        name: pathCache?.label?.name ?? pathToString(path),
        readOnly: pathCache?.readOnly,
    };

    const tags: string[] = [];
    const fileTags: string[] = pathCache?.tags?.filter((f) => f).map((f) => f.toLowerCase()) ?? [];
    let hidden = excludePathPredicate(settings, path);
    if (path.startsWith(builtinSpacePathPrefix)) {
        const builtin = path.replace(builtinSpacePathPrefix, "");
        hidden = builtinSpaces[builtin]?.hidden;
        cache.readOnly = builtinSpaces[builtin]?.readOnly;
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

    const aliases = pathCache?.property ? ensureArray(pathCache.property[settings.fmKeyAlias]) : [];
    const parentDefaultSticker = spacesCache.get(parent)?.metadata?.defaultSticker;
    const sticker = defaultSticker(parentDefaultSticker, type, subtype, path, pathCache?.file?.extension, pathCache?.label?.sticker);
    const parentDefaultColor = spacesCache.get(parent)?.metadata?.defaultColor;
    const color = initiateString(pathCache?.label?.color, parentDefaultColor) ?? "";

    const outlinks = pathCache?.resolvedLinks ?? [];
    const spaceNames = [];
    const pathState: PathState = {
        ...cache,
        name,
        tags: uniq(tags),
        type,
        subtype,
        parent,
        label: {
            name,
            sticker,
            color,
            cover: pathCache?.label?.cover ?? "",
            preview: pathCache?.label?.preview ?? "",
            thumbnail: pathCache?.label?.thumbnail ?? "",
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
