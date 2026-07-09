import { PathState } from "shared/types/PathState";


export const builtinSpacePathPrefix = "spaces://$";
export const tagsSpacePath = "spaces://$tags";
export const tagSpacePathPrefix = "spaces://#";

export const encodeSpaceName = (spaceName: string) => spaceName?.replace(/\//g, "+");
export const tagSpacePathFromTag = (tag: string) => "spaces://" + tag;

export const isTagSpacePath = (path: string) => path?.startsWith(tagSpacePathPrefix);
export const tagSpaceNameFromPath = (path: string) =>
    path?.startsWith(tagSpacePathPrefix) ? path.slice(tagSpacePathPrefix.length) : path;

export const isTagTreeItemPath = (pathState: PathState) => pathState?.subtype == "tag" || isTagSpacePath(pathState?.path);
export const canOpenTreeItemPath = (pathState: PathState) => Boolean(pathState && !isTagTreeItemPath(pathState));
