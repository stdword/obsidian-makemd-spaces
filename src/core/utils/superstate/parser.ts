import { PathState } from "shared/types/PathState";
import { safelyParseJSON } from "shared/utils/json";

export const parsePathState = (cache: string): PathState => {
    const pathState = safelyParseJSON(cache);
    if (!pathState) return pathState;
    return {
        ...pathState,
        label: pathState.label ?? { sticker: "", color: "" },
    };
};
