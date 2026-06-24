import { Superstate } from "makemd-core";
import { fieldTypeForField } from "schemas/mdb";
import { Metadata, fileProperties, labelProperties, pathCacheMetadata } from "shared/types/metadata";

export const allMetadata = (
    superstate: Superstate,
): Record<
    string,
    {
        name: string;
        properties: Metadata[];
    }
> => ({
    file: {
        name: "metadata.fileMetadata",
        properties: fileProperties,
    },
    path: {
        name: "metadata.outlinks",
        properties: pathCacheMetadata,
    },
    label: {
        name: "metadata.label",
        properties: labelProperties,
    },
    context: {
        name: "metadata.contexts",
        properties: [...superstate.contextsIndex.values()].flatMap((f) =>
            f?.contextTable?.cols
                .filter((f) => f.primary != "true")
                .map((g) => ({
                    id: "contexts." + f.path + "." + g.name,
                    label: g.name,
                    field: f.path + "." + g.name,
                    vType: fieldTypeForField(g),
                    defaultFilter: "contains",
                    type: "context",
                    description: f.path + " context property",
                })),
        ),
    },
});
