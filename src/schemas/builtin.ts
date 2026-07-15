import { PathState } from "shared/types/PathState";


export const encodeSpaceName = (spaceName: string) => spaceName?.replace(/\//g, "+");

export const SPACE_SEPARATOR_PATH = "spaces://$separator";
export const SPACE_HIDDEN_SEPARATOR_PATH = `${SPACE_SEPARATOR_PATH}?non-visible`;
export const isSpaceSeparatorPath = (path: string) => path == SPACE_SEPARATOR_PATH || path == SPACE_HIDDEN_SEPARATOR_PATH;

export const tagSpacePathPrefix = "spaces://#";
export const tagSpacePathFromTag = (tag: string) => tagSpacePathPrefix + tag.replace(/^#/, "");
export const isTagSpacePath = (path: string) => path?.startsWith(tagSpacePathPrefix);
export const parseTagSpaceLink = (path: string) => {
    if (!isTagSpacePath(path)) return { path, params: new URLSearchParams() };
    const queryIndex = path.indexOf("?");
    return {
        path: queryIndex == -1 ? path : path.slice(0, queryIndex),
        params: new URLSearchParams(queryIndex == -1 ? "" : path.slice(queryIndex + 1)),
    };
};
export const canonicalTagSpacePath = (path: string) => parseTagSpaceLink(path).path;
export const isFilteredTagSpaceLink = (path: string) => isTagSpacePath(path) && parseTagSpaceLink(path).params.has("filter");
export const setTagSpaceLinkFiltered = (path: string, filtered: boolean) => {
    const parsed = parseTagSpaceLink(path);
    if (!isTagSpacePath(parsed.path)) return path;
    if (filtered) parsed.params.set("filter", "");
    else parsed.params.delete("filter");
    const query = [...parsed.params.entries()]
        .map(([key, value]) => value == "" ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
    return query ? `${parsed.path}?${query}` : parsed.path;
};
export const sameTagSpaceLink = (left: string, right: string) => canonicalTagSpacePath(left) == canonicalTagSpacePath(right);
export const replaceTagSpaceLinkPath = (link: string, nextPath: string) => {
    if (!isTagSpacePath(link)) return nextPath;
    const queryIndex = link.indexOf("?");
    return queryIndex == -1 ? nextPath : `${nextPath}${link.slice(queryIndex)}`;
};
export const tagSpaceNameFromPath = (path: string) => isTagSpacePath(path) ? canonicalTagSpacePath(path).slice(tagSpacePathPrefix.length) : path;

export const isTagTreeItemPath = (pathState: PathState) => pathState?.subtype == "tag" || isTagSpacePath(pathState?.path);
export const canOpenTreeItemPath = (pathState: PathState) => Boolean(pathState && !isTagTreeItemPath(pathState));
