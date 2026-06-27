import { Superstate } from "makemd-core";
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
        properties: [],
    },
});
