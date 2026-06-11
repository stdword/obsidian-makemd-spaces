import { defaultContextSchemaID } from "shared/schemas/context";
import { PathPropertyName } from "shared/types/context";
import { ISuperstate } from "shared/types/superstate";

export const savePathLabel = async (superstate: ISuperstate, path: string, field: "color" | "sticker", value: string) => {
    const pathState = superstate.pathsIndex.get(path);
    if (!pathState) return;

    const spaces = (pathState.spaces ?? []).map((spacePath) => superstate.spacesIndex.get(spacePath)).filter((space) => space?.space);
    await Promise.all(
        spaces.map(async (spaceState) => {
            const table = await superstate.spaceManager.contextForSpace(spaceState.space.path);
            if (!table) return;
            const hasRow = table.rows.some((row) => row[PathPropertyName] == path);
            const rows = hasRow
                ? table.rows.map((row) => (row[PathPropertyName] == path ? { ...row, [field]: value } : row))
                : [...table.rows, { [PathPropertyName]: path, [field]: value }];
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
            [field]: value,
        },
    });
    superstate.dispatchEvent("pathStateUpdated", { path });
};

export const savePathColor = async (superstate: ISuperstate, path: string, color: string) => {
    return savePathLabel(superstate, path, "color", color);
};
