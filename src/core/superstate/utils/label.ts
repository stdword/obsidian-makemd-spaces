import { Superstate } from "makemd-core";

export const savePathColor = async (superstate: Superstate, path: string, color: string) => {
    await superstate.spaceManager.saveLabel(path, superstate.settings.fmKeyColor, color);

    const pathState = superstate.pathsIndex.get(path);
    if (!pathState) return;

    superstate.pathsIndex.set(path, {
        ...pathState,
        label: {
            ...pathState.label,
            color,
        },
    });
    superstate.dispatchEvent("pathStateUpdated", { path });
};
