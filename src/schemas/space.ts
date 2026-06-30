import { PathState } from "shared/types/PathState";
import { DEFAULT_SYSTEM_NAME } from "schemas/constants";


export const vaultPath: PathState = {
    name: DEFAULT_SYSTEM_NAME,
    path: "/",
    label: {
        sticker: "ui//vault",
        color: "",
    },
    type: "default",
};

export type BuiltinSpace = {
    name: string;
    icon: string;
    hidden: boolean;
};

export const builtinSpaces: Record<string, BuiltinSpace> = {
    tags: {
        name: "Tags",
        icon: "ui//tags",
        hidden: false,
    },
};
