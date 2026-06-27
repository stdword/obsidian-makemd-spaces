export type SpaceSort = {
    field: string;
    asc: boolean;
    group?: boolean;
    recursive?: boolean;
};

export type SpaceType = "folder" | "tag" | "vault" | "default" | "unknown";

export type SpaceDefinition = {
    contexts?: string[];
    sort?: Partial<SpaceSort>;
    links?: string[];
    tags?: string[];
    color?: string;
    sticker?: string;
    "rank-order"?: string[];
    pinned?: string[];
    defaultSticker?: string;
    defaultColor?: string;
    "file-colors"?: Record<string, string>;
};
