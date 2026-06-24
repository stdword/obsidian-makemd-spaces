import { parseFieldValue } from "core/schemas/parseFieldValue";
import { resolvePath } from "core/superstate/utils/path";
import { normalizeContextPath, PathPropertyName } from "shared/types/context";
import { IndexMap } from "shared/types/indexMap";
import { DBRow, DBRows, SpaceProperty } from "shared/types/mdb";
import { ContextState, PathState } from "shared/types/PathState";
import { uniq } from "shared/utils/array";
import { serializeMultiString } from "utils/serializers";
import { parseMultiString, parseProperty } from "../../../utils/parsers";

export const linkContextProp = (propType: string, rows: string, contextTableRows: DBRows) => {
    const contextRows = contextTableRows.filter((f) => parseMultiString(rows).includes(f[PathPropertyName]));
    return serializeMultiString(uniq(contextRows.map((f) => f[propType]).filter((f) => f)));
};

export const syncContextRow = (paths: Map<string, PathState>, _row: DBRow, fields: SpaceProperty[], path: PathState) => {
    if (!path) return _row;
    const resolvedPath = resolvePath(_row[PathPropertyName], path?.path, (spacePath) => paths.get(spacePath)?.type == "space");

    const frontmatter = paths.get(resolvedPath)?.metadata?.property ?? {};

    const filteredFrontmatter = Object.keys(frontmatter)
        .filter((f) => fields.some((g) => g.name == f) && f != PathPropertyName)
        .reduce((p, c) => ({ ...p, [c]: parseProperty(c, frontmatter[c]) }), {});

    const tagData: Record<string, string> = {};
    const tagField = fields.find((f) => f.name?.toLowerCase() == "tags");
    if (tagField) {
        tagData[tagField.name] = serializeMultiString([...(paths.get(resolvedPath)?.tags ?? [])]);
    }
    return {
        ..._row,

        ...filteredFrontmatter,
        ...tagData,
    };
};

export const mergeContextRows = (paths: string[], rows: DBRows, pathStates: Map<string, PathState>, _spaceMap: IndexMap, path: PathState) => {
    // Filter existing rows to only include valid paths, preserving database order (rank)
    const validRows = rows.filter((row) => {
        const resolvedPath = normalizeContextPath(resolvePath(row[PathPropertyName], path?.path, (spacePath) => pathStates.get(spacePath)?.type == "space"));
        return paths.includes(resolvedPath);
    });

    // Find paths that are in the paths array but not in any existing row
    const existingPaths = validRows.map((row) => normalizeContextPath(resolvePath(row[PathPropertyName], path?.path, (spacePath) => pathStates.get(spacePath)?.type == "space")));
    const missingPaths = paths.filter((f) => !existingPaths.includes(f));

    // Return existing rows (in their original order) plus new rows for missing paths
    return [...validRows, ...missingPaths.map((f) => ({ [PathPropertyName]: f }))];
};

export const linkContextRow = (paths: Map<string, PathState>, contextsMap: Map<string, ContextState>, _row: DBRow, fields: SpaceProperty[], path: PathState) => {
    if (!_row) return {};
    if (!path) return _row;
    const resolvedPath = resolvePath(_row[PathPropertyName], path?.path, (spacePath) => paths.get(spacePath)?.type == "space");

    const relationFields = fields
        .filter((f) => f && f.type.startsWith("context"))
        .reduce((p, c) => {
            const fieldValue = parseFieldValue(c.value, c.type);
            const multi = c.type.endsWith("multi");
            const value = multi ? parseMultiString(_row[c.name]) : _row[c.name]?.length > 0 ? [_row[c.name]] : [];
            if (!fieldValue.space) {
                return p;
            }
            const items = contextsMap.get(fieldValue.space)?.contextTable?.rows ?? [];
            const values = items
                .reduce((p, c) => {
                    if ((fieldValue.field, parseMultiString(c[fieldValue.field]).includes(resolvedPath))) {
                        return [...p, c[PathPropertyName]];
                    }
                    return p;
                }, [])
                .filter((f) => f);

            if (multi) {
                return {
                    ...p,
                    [c.name]: serializeMultiString(uniq([...value, ...values])),
                };
            }
            return {
                ...p,
                [c.name]: value[0] ?? values[0] ?? "",
            };
        }, {} as DBRow);
    return {
        ..._row,
        ...relationFields,
    };
};
