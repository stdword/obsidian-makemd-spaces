import { ISuperstate as Superstate } from "shared/types/superstate";

export const savePathSticker = async (superstate: Superstate, path: string, sticker: string) => {
    const pathState = superstate.pathsIndex.get(path);
    if (!pathState) return;
    const spaceState = superstate.spacesIndex.get(path);
    if (spaceState?.type == "folder" || spaceState?.type == "vault") {
        if ((spaceState.metadata?.sticker ?? "") == sticker) return;
        await superstate.spaceManager.saveSpace(path, (metadata) => ({ ...metadata, sticker }));
        await superstate.updateSpaceMetadata(path, { ...(spaceState.metadata ?? {}), sticker });
    }
    superstate.pathsIndex.set(path, {
        ...pathState,
        sticker,
    });
    superstate.dispatchEvent("pathStateUpdated", { path });
};

export const removeIconsForPaths = (superstate: Superstate, paths: string[]) => {
    paths.forEach((path) => {
        savePathSticker(superstate, path, "");
    });
};
