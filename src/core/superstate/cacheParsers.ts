import _ from "lodash";
import { PathCache } from "shared/types/caches";
import { PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";
import { uniq } from "shared/utils/array";

import { builtinSpaces } from "core/types/space";
import { initiateString, tagSpacePathFromTag } from "core/utils/strings";
import { builtinSpacePathPrefix, isTagSpacePath, tagsSpacePath } from "shared/schemas/builtin";
import { excludePathPredicate } from "utils/hide";
import { pathToString } from "utils/path";
import { tagPathToTag } from "utils/tags";

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
            if (isTagSpacePath(path)) return "ui//hash";
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
    const isFolderPath = type == "space" || subtype == "folder" || pathCache?.file?.isFolder;
    const pathMetadata = isFolderPath ? _.omit(pathCache, ["definition"]) : pathCache;
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
            ...pathMetadata,
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
