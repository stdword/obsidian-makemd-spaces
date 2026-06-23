import { normalizeContextPath, PathPropertyName } from "shared/types/context";
import { SpaceTable } from "shared/types/mdb";
import { insertMulti } from "shared/utils/array";

const isContextPathMatch = (rowPath: string, path: string) => normalizeContextPath(rowPath) == normalizeContextPath(path);

export const renameRowForPath = (
    spaceTable: SpaceTable,
    paths: string,
    newPath: string
  ): SpaceTable => {
    return {
      ...spaceTable,
      rows: spaceTable.rows.map((f) =>
        isContextPathMatch(f[PathPropertyName], paths)
          ? { ...f, [PathPropertyName]: newPath }
          : f
      ),
    };
  };
  
 

  export const removeRowForPath = (spaceTable: SpaceTable, paths: string): SpaceTable => {
    return {
      ...spaceTable,
      rows: spaceTable.rows.filter(
        (f) => !isContextPathMatch(f[PathPropertyName], paths)
      ),
    };
  };

  export const removeRowsForPath = (spaceTable: SpaceTable, paths: string[]): SpaceTable => {
    return {
      ...spaceTable,
      rows: spaceTable.rows.filter(
        (f) => !paths.some((path) => isContextPathMatch(f[PathPropertyName], path))
      ),
    };
  };



  export const reorderRowsForPath = (spaceTable: SpaceTable, paths: string[], index: number): SpaceTable => {
    const rows = spaceTable.rows.filter(
      (f) => paths.some((path) => isContextPathMatch(f[PathPropertyName], path))
    )
    return {
      ...spaceTable,
      rows: insertMulti(spaceTable.rows.filter(
        (f) => !paths.some((path) => isContextPathMatch(f[PathPropertyName], path))
      ), index, rows),
    };
  };
