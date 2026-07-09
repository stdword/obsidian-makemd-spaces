import { PathState } from "shared/types/PathState";
import { safelyParseJSON } from "utils/json";

export const parsePathState = (cache: string): PathState => {
    const pathState = safelyParseJSON(cache) as PathState;
    if (!pathState) return pathState;
    return {
        ...pathState,
        color: pathState.color ?? "",
        sticker: pathState.sticker ?? "",
        spaces: pathState.spaces ?? [],
        linkedSpaces: pathState.linkedSpaces ?? [],
        pinnedSpaces: pathState.pinnedSpaces ?? [],
    };
};
