export type DBRow = Record<string, string>;
export type DBRows = DBRow[];
export type DBTable = {
    uniques: string[];
    cols: string[];
    rows: DBRows;
};

export type DBTables = Record<string, DBTable>;

export type SpaceProperty = {
    name: string;
    type: string;
    //metadata for field
    value?: string;
    //styling for field
    attrs?: string;
};
