export const PathPropertyName = "path";
export const PathPropertyPinned = "isPinned";

export const normalizeContextPath = (path: string): string => {
    if (!path || path == "/") return path;
    return path.endsWith("/") ? path.slice(0, -1) : path;
};

export type ContextDefType = "tag";
export type ContextDef = {
    type: ContextDefType;
    value: string;
};

export type ContextLookup = {
    field: string;
    property: string;
};
