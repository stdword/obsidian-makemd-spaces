import { ISuperstate } from "shared/types/superstate";

const isFolderPathState = (pathState: any) => pathState?.type == "space" || pathState?.subtype == "folder";
const supportsFileColors = (spaceState: any) => spaceState?.type == "tag" || !!spaceState?.space;

const updatePathColor = (superstate: ISuperstate, path: string, color: string) => {
    const pathState = superstate.pathsIndex.get(path);
    if (!pathState) return;

    superstate.pathsIndex.set(path, {
        ...pathState,
        color,
    });
    superstate.dispatchEvent("pathStateUpdated", { path });
};

export type PathColorTarget = string | { path: string; space?: string };

const saveFileColorsInSpace = async (superstate: ISuperstate, spaceState: any, nextFileColors: Record<string, string>) => {
    const nextMetadata = {
        ...spaceState.metadata,
        "file-colors": nextFileColors,
    };

    await superstate.updateSpaceMetadata(spaceState.path, nextMetadata);
    if (spaceState.type != "tag") {
        await superstate.spaceManager.saveSpace(spaceState.path, (oldMetadata) => ({
            ...oldMetadata,
            "file-colors": nextFileColors,
        }));
    }
};

const saveFileColorInSpace = async (superstate: ISuperstate, spaceState: any, path: string, color: string) => {
    const { [path]: _oldColor, ...fileColors } = spaceState.metadata?.["file-colors"] ?? {};
    const nextFileColors = color ? { ...fileColors, [path]: color } : fileColors;

    await saveFileColorsInSpace(superstate, spaceState, nextFileColors);
};

export const savePathColor = async (superstate: ISuperstate, path: string, color: string, treeSpace?: string) => {
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
        if (spaceState) {
            const nextMetadata = {
                ...spaceState.metadata,
                color,
            };
            await superstate.updateSpaceMetadata(path, nextMetadata);
            if (spaceState.type != "tag") {
                await superstate.spaceManager.saveSpace(path, (oldMetadata) => ({
                    ...oldMetadata,
                    color,
                }));
            }
        } else {
            superstate.pathsIndex.set(path, {
                ...pathState,
                color,
            });
            superstate.dispatchEvent("pathStateUpdated", { path });
        }
        return;
    }

    const spaces = [...new Set([...(pathState.spaces ?? []), treeSpace].filter((spacePath) => spacePath))]
        .map((spacePath) => superstate.spacesIndex.get(spacePath))
        .filter(supportsFileColors);
    const spaceSaves = spaces.map((spaceState) => saveFileColorInSpace(superstate, spaceState, path, color));
    updatePathColor(superstate, path, color);
    await Promise.all(spaceSaves);
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
            .filter(supportsFileColors)
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
        return saveFileColorsInSpace(superstate, spaceState, fileColors);
    });

    await Promise.all([...pathSaves, ...spaceSaves]);
};
