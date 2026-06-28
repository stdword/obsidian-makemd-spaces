import { saveSpaceCache } from "./spaces";
import { ISuperstate } from "shared/types/superstate";

const isFolderPathState = (pathState: any) => pathState?.type == "space" || pathState?.subtype == "folder" || pathState?.metadata?.file?.isFolder;

const updatePathColor = (superstate: ISuperstate, path: string, color: string) => {
    const pathState = superstate.pathsIndex.get(path);
    if (!pathState) return;

    superstate.pathsIndex.set(path, {
        ...pathState,
        effectiveLabel: {
            ...pathState.effectiveLabel,
            color,
        },
    });
    superstate.dispatchEvent("pathStateUpdated", { path });
};

export type PathColorTarget = string | { path: string; space?: string };

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
    updatePathColor(superstate, path, color);
    await Promise.all(
        spaces.map(async (spaceState) => {
            const { [path]: _oldColor, ...fileColors } = spaceState.metadata?.["file-colors"] ?? {};
            await saveSpaceCache(superstate as any, spaceState.space, {
                ...spaceState.metadata,
                "file-colors": color ? { ...fileColors, [path]: color } : fileColors,
            });
        }),
    );
};

export const savePathColors = async (superstate: ISuperstate, targets: PathColorTarget[], color: string) => {
    const spacePathUpdates = new Map<string, { spaceState: any; paths: Set<string> }>();
    const pathSaves: Promise<any>[] = [];

    targets.forEach((target) => {
        const path = typeof target == "string" ? target : target.path;
        const treeSpace = typeof target == "string" ? null : target.space;
        const pathState = superstate.pathsIndex.get(path);
        const spaceState = superstate.spacesIndex.get(path);
        if (!pathState || isFolderPathState(pathState)) {
            pathSaves.push(savePathColor(superstate, path, color));
            return;
        }

        updatePathColor(superstate, path, color);
        ([...(pathState.spaces ?? []), treeSpace] as string[])
            .filter((spacePath) => spacePath)
            .map((spacePath) => superstate.spacesIndex.get(spacePath))
            .filter((space) => space?.space)
            .forEach((spaceState) => {
                const currentUpdate = spacePathUpdates.get(spaceState.path) ?? {
                    spaceState,
                    paths: new Set<string>(),
                };
                currentUpdate.paths.add(path);
                spacePathUpdates.set(spaceState.path, currentUpdate);
            });
    });

    const spaceSaves = [...spacePathUpdates.values()].map(({ spaceState, paths }) => {
        const fileColors = { ...(spaceState.metadata?.["file-colors"] ?? {}) };
        paths.forEach((path) => {
            if (color) {
                fileColors[path] = color;
            } else {
                delete fileColors[path];
            }
        });
        return saveSpaceCache(superstate as any, spaceState.space, {
            ...spaceState.metadata,
            "file-colors": fileColors,
        });
    });

    await Promise.all([...pathSaves, ...spaceSaves]);
};
