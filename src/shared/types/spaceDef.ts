export type SpaceSort = {
    field: string;
    asc: boolean;
    group?: boolean;
    subtags?: boolean;
    recursive?: boolean;
};

export type SpaceDefinition = {
    color?: string;
    sticker?: string;
    defaultSticker?: string;
    defaultColor?: string;

    links?: string[];
    pinned?: string[];

    sort?: Partial<SpaceSort>;
    "rank-order"?: string[];
    "file-colors"?: Record<string, string>;
};
