import { SpaceDefinition } from "../shared/types/spaceDef";

export const SPACE_SUB_FOLDER = ".space";
export const FOCUSES_FILE = "focuses.json";

export const DEFAULT_NEW_NOTE_NAME = "Untitled";
export const DEFAULT_SYSTEM_NAME = "Home";

export const SPACE_DEF_FILE = "context.json";
export const SPACE_DEF_PATH = `${SPACE_SUB_FOLDER}/${SPACE_DEF_FILE}`;
export const SPACE_DEF_DEFAULT_CONTENT = (definition: Partial<SpaceDefinition> = {}) =>
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
