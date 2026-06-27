import { saveSpaceCache } from "./spaces";
import { ISuperstate } from "shared/types/superstate";

const isFolderPathState = (pathState: any) => pathState?.type == "space" || pathState?.subtype == "folder" || pathState?.metadata?.file?.isFolder;

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
        if (spaceState) {
            await superstate.updateSpaceMetadata(path, {
                ...spaceState.metadata,
                color,
            });
        } else {
            superstate.pathsIndex.set(path, {
                ...pathState,
                effectiveLabel: {
                    ...pathState.effectiveLabel,
                    color,
                },
            });
            superstate.dispatchEvent("pathStateUpdated", { path });
        }
        return;
    }

    const spaces = (pathState.spaces ?? []).map((spacePath) => superstate.spacesIndex.get(spacePath)).filter((space) => space?.space);
    await Promise.all(
        spaces.map(async (spaceState) => {
            const { [path]: _oldColor, ...fileColors } = spaceState.metadata?.["file-colors"] ?? {};
            await saveSpaceCache(superstate as any, spaceState.space, {
                ...spaceState.metadata,
                "file-colors": color ? { ...fileColors, [path]: color } : fileColors,
            });
        }),
    );

    superstate.pathsIndex.set(path, {
        ...pathState,
        effectiveLabel: {
            ...pathState.effectiveLabel,
            color,
        },
    });
    superstate.dispatchEvent("pathStateUpdated", { path });
};
