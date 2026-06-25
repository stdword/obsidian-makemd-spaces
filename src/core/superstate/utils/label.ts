import { defaultContextSchemaID } from "shared/schemas/context";
import { defaultContextFields } from "shared/schemas/fields";
import { normalizeContextPath, PathPropertyName, PathPropertyPinned } from "shared/types/context";
import { ISuperstate } from "shared/types/superstate";

const isFolderPathState = (pathState: any) => pathState?.type == "space" || pathState?.subtype == "folder" || pathState?.metadata?.file?.isFolder;

const contextColorRow = (row: Record<string, string> | null, path: string, color: string): Record<string, string> => ({
    [PathPropertyName]: row?.[PathPropertyName] ?? path,
    color: (row?.[PathPropertyName] ?? path)?.endsWith("/") ? "" : color,
    [PathPropertyPinned]: row?.[PathPropertyPinned] ?? "false",
});

export const savePathColor = async (superstate: ISuperstate, path: string, color: string) => {
    const pathState = superstate.pathsIndex.get(path);
    const spaceState = superstate.spacesIndex.get(path);
    if (!pathState && spaceState?.type == "tag") {
        await superstate.updateSpaceMetadata(path, {
            ...spaceState.metadata,
            color,
        });
        superstate.dispatchEvent("pathStateUpdated", { path });
        return;
    }
    if (!pathState) return;

    if (isFolderPathState(pathState)) {
        await superstate.spaceManager.saveLabel(path, "color", color);
        superstate.pathsIndex.set(path, {
            ...pathState,
            label: {
                ...pathState.label,
                color,
            },
        });
        superstate.dispatchEvent("pathStateUpdated", { path });
        return;
    }

    const spaces = (pathState.spaces ?? []).map((spacePath) => superstate.spacesIndex.get(spacePath)).filter((space) => space?.space);
    await Promise.all(
        spaces.map(async (spaceState) => {
            const table = await superstate.spaceManager.contextForSpace(spaceState.space.path);
            if (!table) return;
            const hasRow = table.rows.some((row) => normalizeContextPath(row[PathPropertyName]) == path);
            const rows = hasRow
                ? table.rows.map((row) => (normalizeContextPath(row[PathPropertyName]) == path ? contextColorRow(row, path, color) : contextColorRow(row, normalizeContextPath(row[PathPropertyName]), row.color ?? "")))
                : [...table.rows.map((row) => contextColorRow(row, normalizeContextPath(row[PathPropertyName]), row.color ?? "")), contextColorRow(null, path, color)];
            await superstate.spaceManager.saveTable(
                spaceState.space.path,
                {
                    ...table,
                    schema: table.schema ?? { id: defaultContextSchemaID, name: "Items", type: "db", primary: "true" },
                    cols: defaultContextFields.rows as any,
                    rows,
                },
                true,
            );
        }),
    );

    superstate.pathsIndex.set(path, {
        ...pathState,
        label: {
            ...pathState.label,
            color,
        },
    });
    superstate.dispatchEvent("pathStateUpdated", { path });
};
