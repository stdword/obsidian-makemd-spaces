import { PathState } from "shared/types/PathState";


export const encodeSpaceName = (spaceName: string) => spaceName?.replace(/\//g, "+");

export const SPACE_SEPARATOR_PATH = "spaces://$separator";
export const SPACE_HIDDEN_SEPARATOR_PATH = `${SPACE_SEPARATOR_PATH}?non-visible`;
export const isSpaceSeparatorPath = (path: string) => path == SPACE_SEPARATOR_PATH || path == SPACE_HIDDEN_SEPARATOR_PATH;

export const tagSpacePathPrefix = "spaces://#";
export const tagSpacePathFromTag = (tag: string) => tagSpacePathPrefix + tag.replace(/^#/, "");
export const isTagSpacePath = (path: string) => path?.startsWith(tagSpacePathPrefix);
export const tagSpaceNameFromPath = (path: string) => isTagSpacePath ? path.slice(tagSpacePathPrefix.length) : path;

export const isTagTreeItemPath = (pathState: PathState) => pathState?.subtype == "tag" || isTagSpacePath(pathState?.path);
export const canOpenTreeItemPath = (pathState: PathState) => Boolean(pathState && !isTagTreeItemPath(pathState));
