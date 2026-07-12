export type DBRow = Record<string, string>;
export type DBRows = DBRow[];
export type DBTable = {
    uniques: string[];
    cols: string[];
    rows: DBRows;
};

export type DBTables = Record<string, DBTable>;
