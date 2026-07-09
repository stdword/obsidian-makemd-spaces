import { SpaceDefinition } from "shared/types/spaceDef";

export const DEFAULT_NEW_NOTE_NAME = "Untitled";
export const DEFAULT_SYSTEM_NAME = "Home";

export const FOCUSES_FILE = "focuses.json";

export const SPACE_FOLDER = ".space";
export const SPACE_CONFIG_FILE = "context.json";
export const SPACE_CONFIG_PATH = `${SPACE_FOLDER}/${SPACE_CONFIG_FILE}`;
export const SPACE_CONFIG_DEFAULT_CONTENT = (definition: Partial<SpaceDefinition> = {}) =>
    JSON.stringify(
        {
            color: "",
            sticker: "",
            defaultColor: "",
            defaultSticker: "",
            "rank-order": [],
            links: [],
            pinned: [],
            "file-colors": {},
            ...definition,
        },
        null,
        2,
    );
