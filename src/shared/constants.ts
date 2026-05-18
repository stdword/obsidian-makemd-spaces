export const SPACE_SUB_FOLDER = ".space";
export const FOCUSES_FILE = "waypoints.json";

export const DEFAULT_NEW_NOTE_NAME = "Untitled";
export const DEFAULT_SYSTEM_NAME = "Home";

export const SPACE_CONTEXT_FILE = "context.mdb";
export const SPACE_CONTEXT_PATH = `${SPACE_SUB_FOLDER}/${SPACE_CONTEXT_FILE}`;


export const SPACE_DEF_FILE = "def.json";
export const SPACE_DEF_PATH = `${SPACE_SUB_FOLDER}/${SPACE_DEF_FILE}`;
export const SPACE_DEF_DEFAULT_CONTENT = () =>
    JSON.stringify(
        {
            label: {
                color: "",
                sticker: "",
            },
        },
        null,
        2,
    );
