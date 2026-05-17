import { Superstate } from "makemd-core";

export const savePathColor = async (superstate: Superstate, path: string, color: string) => {
    superstate.spaceManager.saveLabel(path, superstate.settings.fmKeyColor, color);
};
