import { Superstate } from "makemd-core";
import { SPACE_FOLDER } from "schemas/constants";

export const pathInSpaceFolder = (basePath: string, path: string) => `${basePath}/${SPACE_FOLDER}/${path}`;

export const pathIsSpace = (superstate: Superstate, path: string) => {
    if (!path) return false;
    return superstate.spacesIndex.has(path);
};
