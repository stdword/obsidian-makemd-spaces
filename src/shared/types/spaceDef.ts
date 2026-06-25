import { Filter } from "./predicate";

export type SpaceSort = {
    field: string;
    asc: boolean;
    group?: boolean;
    recursive?: boolean;
};

export type FilterDef = {
    type: string;
    fType: string;
} & Filter;
export type FilterGroupDef = {
    type: "any" | "all";
    trueFalse: boolean;
    filters: FilterDef[];
};
export type SpaceType = "folder" | "tag" | "vault" | "default" | "unknown";

export type SpaceDefinition = {
    contexts?: string[];
    sort?: SpaceSort;
    links?: string[];
    tags?: string[];
    color?: string;
    "rank-order"?: string[];
    pinned?: string[];
    defaultSticker?: string;
    defaultColor?: string;
};
