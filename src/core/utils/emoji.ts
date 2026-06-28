import { PathColorTarget, savePathColor, savePathColors } from "core/superstate/utils/label";
import { Superstate } from "makemd-core";
import { savePathSticker } from "shared/utils/sticker";

export const saveIconsForPaths = (superstate: Superstate, paths: string[], icon: string) => {
    paths.forEach((path) => {
        savePathSticker(superstate, path, icon);
    });
};

export const saveColorForPaths = (superstate: Superstate, paths: PathColorTarget[], icon: string) => savePathColors(superstate, paths, icon);

export const savePathIcon = (superstate: Superstate, path: string, icon: string) => {
    savePathSticker(superstate, path, icon);
};

export const removePathIcon = (superstate: Superstate, path: string) => {
    savePathSticker(superstate, path, "");
};
