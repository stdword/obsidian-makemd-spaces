import _ from "lodash";
import { PathCache, PathState, PathType, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";
import { uniq } from "utils/array";

import { builtinSpaces } from "schemas/space";
import { builtinSpacePathPrefix, isTagSpacePath, tagsSpacePath, tagSpacePathFromTag } from "schemas/builtin";
import { excludePathPredicate } from "utils/hide";
import { pathToString } from "utils/path";
import { tagPathToTag } from "utils/tags";

const stripExtension = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0) return fileName;
    return fileName.slice(0, dotIndex);
};

const displayNameForPath = (path: string, pathCache: PathCache, fallbackName?: string, type?: string) => {
    if ((type == "space" || pathCache?.type == "space") && fallbackName) return fallbackName;
    if (pathCache?.name) return pathCache.name;
    const fileName = path.split("/").pop() ?? fallbackName ?? pathToString(path);
    return pathCache?.type == "space" ? fileName : stripExtension(fileName);
};

export const parseAllMetadata = (fileCache: Map<string, PathCache>, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>, oldCache: Map<string, PathState>): { [key: string]: { changed: boolean; cache: PathState } } => {
    const cache: { [key: string]: { changed: boolean; cache: PathState } } = {};
    for (const [path, _pathCache] of fileCache) {
        const pathCache = _pathCache;
        if (!pathCache) continue;

        const parent = _pathCache?.parent ?? "";
        const type = _pathCache?.type ?? "";
        const subtype = _pathCache?.subtype ?? "";
        const name = spacesCache.has(path) ? spacesCache.get(path).name : displayNameForPath(path, pathCache, undefined, type);
        const oldMetadata = oldCache?.get(path);
        const { changed, cache: metadata } = parseMetadata(path, settings, spacesCache, pathCache, name, type, subtype, parent, oldMetadata);
        cache[path] = { changed, cache: metadata };
    }
    return cache;
};

export const parseMetadata = (path: string, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>, pathCache: PathCache, name: string, type: string, subtype: string, parent: string, oldMetadata: PathState): { changed: boolean; cache: PathState } => {
    if (!pathCache) return { changed: false, cache: null };
    const displayName = displayNameForPath(path, pathCache, name, type);
    const defaultSticker = (sticker: string, type: string, subtype: string, path: string, savedSticker?: string): string => {
        if (type == "space") {
            if (path == "/") return "ui//home";
            if (isTagSpacePath(path)) return "ui//hash";
            if (savedSticker?.length > 0) return savedSticker;
            if (sticker?.length > 0) return sticker;
            return "ui//folder";
        }
        const fileExtension = subtype?.toLowerCase() || path.split(".").pop()?.toLowerCase();
        if (["png", "jpg", "jpeg", "avif", "webp", "gif"].includes(fileExtension)) return "ui//image";
        if (fileExtension == "canvas") return "ui//layout-dashboard";
        if (fileExtension == "base") return "ui//table";
        if (fileExtension == "excalidraw" || fileExtension == "excalidraw.md" || path.toLowerCase().endsWith(".excalidraw.md")) return "ui//excalidraw";
        if (fileExtension == "md") return "ui//file-text";
        return "ui//file";
    };

    const tags: string[] = [];
    const fileTags: string[] = pathCache?.tags?.filter((f) => f).map((f) => f.toLowerCase()) ?? [];
    let hidden = excludePathPredicate(settings, path);
    if (path.startsWith(builtinSpacePathPrefix)) {
        const builtin = path.replace(builtinSpacePathPrefix, "");
        hidden = builtinSpaces[builtin]?.hidden;
    }
    tags.push(...fileTags);

    const parentDefaultSticker = spacesCache.get(parent)?.metadata?.defaultSticker;
    const ownSpaceMetadata = spacesCache.get(path)?.metadata;
    const ownSticker = ownSpaceMetadata?.sticker ?? "";
    const sticker = type == "space" ? defaultSticker(parentDefaultSticker, type, subtype, path, ownSticker) : defaultSticker("", type, subtype, path);
    const parentDefaultColor = spacesCache.get(parent)?.metadata?.defaultColor;
    const ownColor = ownSpaceMetadata?.color ?? "";
    const fileColors = spacesCache.get(parent)?.metadata?.["file-colors"] ?? {};
    const color = type == "space" ? ((ownColor || parentDefaultColor) ?? "") : (fileColors[path] ?? parentDefaultColor ?? "");

    const isSpacePath = type == "space" || subtype == "folder";
    const pathType: PathType = isSpacePath ? "space" : "file";
    const pathMetadata = isSpacePath ? {} : { ...(pathCache?.metadata ?? {}) };
    const pathState: PathState = {
        path,
        name: displayName,
        tags: uniq(tags),
        type: pathType,
        subtype,
        parent,
        sticker,
        color,
        metadata: pathMetadata,
        spaces: [],
        linkedSpaces: [],
        pinnedSpaces: [],
        hidden,
    };

    const spaces: string[] = [];
    const linkedSpaces: string[] = [];
    const pinnedSpaces: string[] = [];
    if (subtype == "tag") {
        spaces.push(tagsSpacePath);
    }
    for (const s of tags) {
        spaces.push(tagSpacePathFromTag(s));
    }
    const evaledSpaces = new Set<string>();
    const evalSpace = (s: string, space: SpaceState) => {
        if (evaledSpaces.has(s)) return;
        evaledSpaces.add(s);

        if (subtype != "tag" && subtype != "default") {
            if (space.path == parent) {
                spaces.push(s);
            }
        }
        if (space.metadata?.links?.length > 0) {
            const spaceItem = (space.metadata?.links ?? []).find((f) => f == pathState.path);
            if (spaceItem) {
                if (subtype != "md" && subtype != "folder" && space.type == "tag") {
                    tags.push(tagPathToTag(space.path));
                }
                spaces.push(s);
                linkedSpaces.push(s);
            }
        }
        if (space.metadata?.pinned?.length > 0 && space.metadata.pinned.includes(pathState.path)) {
            spaces.push(s);
            pinnedSpaces.push(s);
        }
    };
    for (const [s, space] of spacesCache) {
        evalSpace(s, space);
    }
    const explicitVisibleSpaces = [...spacesCache.entries()]
        .filter(([, space]) => (space.metadata?.links ?? []).includes(pathState.path) || (space.metadata?.pinned ?? []).includes(pathState.path))
        .map(([spacePath]) => spacePath);
    const visibleHiddenSpaces = uniq([...spaces, ...explicitVisibleSpaces]).filter((spacePath) => explicitVisibleSpaces.includes(spacePath) && spacePath != path);
    const metadata: PathState = hidden
        ? {
              ...pathState,
              tags: uniq(tags),
              spaces: visibleHiddenSpaces,
              linkedSpaces: uniq(linkedSpaces).filter((spacePath) => visibleHiddenSpaces.includes(spacePath)),
              pinnedSpaces: uniq(pinnedSpaces).filter((spacePath) => visibleHiddenSpaces.includes(spacePath)),
              hidden,
          }
        : {
              ...pathState,
              tags: uniq(tags),
              spaces: uniq(spaces).filter((f) => f != path),
              linkedSpaces: uniq(linkedSpaces),
              pinnedSpaces: uniq(pinnedSpaces),
              hidden,
          };
    let changed = true;

    if (oldMetadata && _.isEqual(metadata, oldMetadata)) {
        changed = false;
    }
    return { changed, cache: metadata };
};
