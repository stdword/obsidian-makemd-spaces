import { Superstate } from "makemd-core";
import { defaultContextSchemaID } from "shared/schemas/context";
import { PathPropertyName } from "shared/types/context";

export const savePathColor = async (superstate: Superstate, path: string, color: string) => {
    const pathState = superstate.pathsIndex.get(path);
    if (!pathState) return;

    const spaces = (pathState.spaces ?? []).map((spacePath) => superstate.spacesIndex.get(spacePath)).filter((space) => space?.space);
    await Promise.all(
        spaces.map(async (spaceState) => {
            const table = await superstate.spaceManager.contextForSpace(spaceState.space.path);
            if (!table) return;
            const hasRow = table.rows.some((row) => row[PathPropertyName] == path);
            const rows = hasRow
                ? table.rows.map((row) => (row[PathPropertyName] == path ? { ...row, color } : row))
                : [...table.rows, { [PathPropertyName]: path, color }];
            await superstate.spaceManager.saveTable(
                spaceState.space.path,
                {
                    ...table,
                    schema: table.schema ?? { id: defaultContextSchemaID, name: "Items", type: "db", primary: "true" },
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
