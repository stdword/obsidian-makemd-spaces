import { PathState } from "shared/types/PathState";

export const isTagTreeItemPath = (pathState: PathState) => pathState?.subtype == "tag" || pathState?.path?.startsWith("spaces://#");

export const canOpenTreeItemPath = (pathState: PathState) => Boolean(pathState && !isTagTreeItemPath(pathState));
