export const PathPropertyName = "path"
export const PathPropertyCreated = "ctime"

export type ContextDefType = 'tag'
export type ContextDef = {
    type: ContextDefType,
    value: string
}

export type ContextLookup = {
    field: string;
    property: string;
}
