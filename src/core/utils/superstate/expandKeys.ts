import { isTagSpacePath, tagSpaceParentPath } from "schemas/builtin";
import { parentPathOf } from "utils/path";

// Expanded state is keyed by what a row is, not by its id in the tree, so one folder keeps
// separate state for each way it is shown:
//   the folder itself, under its real parent   -> its path
//   a link to it inside another space          -> <space path>/?link=<path>
//   a section of a focus                       -> spaces://$focus/<focus name>?section=<path>
const SECTION_PREFIX = "spaces://$focus/";
const SECTION_MARK = "?section=";
const LINK_MARK = "/?link=";

export const sectionExpandKey = (focusName: string, path: string) => `${SECTION_PREFIX}${focusName ?? ""}${SECTION_MARK}${path}`;
export const linkExpandKey = (spacePath: string, path: string) => `${spacePath}${LINK_MARK}${path}`;

/** Shown in `spacePath` without living there: a link, or a tagged item in a tag space. */
export const isLinkedInSpace = (path: string, spacePath: string) => {
    const owner = isTagSpacePath(path) ? tagSpaceParentPath(path) : parentPathOf(path) || "/";
    return owner != spacePath;
};

export const childExpandKey = (spacePath: string, path: string) => (isLinkedInSpace(path, spacePath) ? linkExpandKey(spacePath, path) : path);

type ParsedExpandKey =
    | { kind: "section"; focusName: string; path: string }
    | { kind: "link"; spacePath: string; path: string }
    | { kind: "path"; path: string };

export const parseExpandKey = (key: string): ParsedExpandKey => {
    if (key.startsWith(SECTION_PREFIX)) {
        const mark = key.indexOf(SECTION_MARK, SECTION_PREFIX.length);
        if (mark != -1) return { kind: "section", focusName: key.slice(SECTION_PREFIX.length, mark), path: key.slice(mark + SECTION_MARK.length) };
    }
    const link = key.indexOf(LINK_MARK);
    if (link != -1) return { kind: "link", spacePath: key.slice(0, link), path: key.slice(link + LINK_MARK.length) };
    return { kind: "path", path: key };
};

const isUnder = (path: string, root: string) => path == root || path.startsWith(`${root}/`);
const moveUnder = (path: string, oldRoot: string, newRoot: string) => (isUnder(path, oldRoot) ? newRoot + path.slice(oldRoot.length) : path);

const keyPaths = (key: string): string[] => {
    const parsed = parseExpandKey(key);
    return parsed.kind == "link" ? [parsed.spacePath, parsed.path] : [parsed.path];
};

const renameKey = (key: string, oldPath: string, newPath: string): string => {
    const parsed = parseExpandKey(key);
    if (parsed.kind == "section") return sectionExpandKey(parsed.focusName, moveUnder(parsed.path, oldPath, newPath));
    if (parsed.kind == "link") return linkExpandKey(moveUnder(parsed.spacePath, oldPath, newPath), moveUnder(parsed.path, oldPath, newPath));
    return moveUnder(parsed.path, oldPath, newPath);
};

/** Also drops state left at `newPath` by something that lived there earlier. Returns the same array when nothing changes. */
export const renameExpandKeys = (keys: string[], oldPath: string, newPath: string): string[] => {
    const names = (key: string, path: string) => keyPaths(key).some((keyPath) => isUnder(keyPath, path));
    const moved = keys.filter((key) => names(key, oldPath));
    const kept = keys.filter((key) => !names(key, oldPath) && !names(key, newPath));
    if (moved.length == 0 && kept.length == keys.length) return keys;
    return Array.from(new Set([...kept, ...moved.map((key) => renameKey(key, oldPath, newPath))]));
};

export const renameFocusInExpandKeys = (keys: string[], oldName: string, newName: string): string[] =>
    keys.map((key) => {
        const parsed = parseExpandKey(key);
        return parsed.kind == "section" && parsed.focusName == oldName ? sectionExpandKey(newName, parsed.path) : key;
    });

/** State inside `path`, without the row of `path` itself. */
export const expandKeysInside = (keys: string[], path: string): string[] =>
    keys.filter((key) => {
        const parsed = parseExpandKey(key);
        if (parsed.kind == "section") return false;
        if (parsed.kind == "link") return isUnder(parsed.spacePath, path);
        return parsed.path != path && isUnder(parsed.path, path);
    });
