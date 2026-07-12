import { Superstate } from "makemd-core";

import { tagSpacePathFromTag } from "schemas/builtin";
import { fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { ensureArray } from "core/utils/schema";
import { ensureTag } from "utils/tags";


export const addTag = (superstate: Superstate, tag: string, initialized = true) => {
    const normalizedTag = ensureTag(tag);
    const tagPath = tagSpacePathFromTag(normalizedTag);
    if (superstate.spacesIndex.has(tagPath))
        return Promise.resolve(superstate.spacesIndex.get(tagPath));

    return Promise.resolve(
        superstate.reloadSpace(
            fileSystemSpaceInfoFromTag(superstate.spaceManager, normalizedTag),
            null,
            initialized,
        )
    );
};

export const syncTagSpacesFromObsidian = async (superstate: Superstate) => {
    const tags = superstate.spaceManager.readTags().map((tag) => ensureTag(tag)).filter((tag) => tag);
    await Promise.all(tags.map((tag) => addTag(superstate, tag, false)));
    return new Set([
        ...tags.map((tag) => tagSpacePathFromTag(tag)),
        ...[...superstate.spacesIndex.values()].filter((space) => space.type == "tag").map((space) => space.path),
    ]);
};

export const mergeTagSpaceMetadata = async (superstate: Superstate, sourcePath: string, targetPath: string) => {
    const source = superstate.spacesIndex.get(sourcePath);
    const target = superstate.spacesIndex.get(targetPath);
    if (!source || !target || source.type != "tag" || target.type != "tag") return;
    await superstate.updateSpaceMetadata(targetPath, {
        ...target.metadata,
        ...source.metadata,
        sort: source.metadata.sort,
        color: source.metadata.color,
        pinned: [...new Set([...ensureArray(source.metadata.pinned), ...ensureArray(target.metadata.pinned)])],
        "rank-order": [...new Set([...ensureArray(source.metadata["rank-order"]), ...ensureArray(target.metadata["rank-order"])])],
        "file-colors": {
            ...(target.metadata["file-colors"] ?? {}),
            ...(source.metadata["file-colors"] ?? {}),
        },
    });

    const replaceSource = (paths: unknown) => [...new Set(ensureArray(paths).map((path) => path == sourcePath ? targetPath : path))];
    const referencingSpaces = [...superstate.spacesIndex.values()].filter((space) =>
        space.path != sourcePath && (
            ensureArray(space.metadata.links).includes(sourcePath) ||
            ensureArray(space.metadata.pinned).includes(sourcePath) ||
            ensureArray(space.metadata["rank-order"]).includes(sourcePath) ||
            Object.prototype.hasOwnProperty.call(space.metadata["file-colors"] ?? {}, sourcePath)
        )
    );
    for (const space of referencingSpaces) {
        const fileColors = { ...(space.metadata["file-colors"] ?? {}) };
        if (Object.prototype.hasOwnProperty.call(fileColors, sourcePath)) {
            if (!Object.prototype.hasOwnProperty.call(fileColors, targetPath))
                fileColors[targetPath] = fileColors[sourcePath];
            delete fileColors[sourcePath];
        }
        const metadata = {
            ...space.metadata,
            links: replaceSource(space.metadata.links),
            pinned: replaceSource(space.metadata.pinned),
            "rank-order": replaceSource(space.metadata["rank-order"]),
            "file-colors": fileColors,
        };
        if (space.type != "tag")
            await superstate.spaceManager.saveSpace(space.path, () => metadata);
        await superstate.updateSpaceMetadata(space.path, metadata);
    }

    superstate.onSpaceDeleted(sourcePath);

    let focusesChanged = false;
    superstate.focuses.forEach((focus) => {
        if (!focus.paths.includes(sourcePath)) return;
        focus.paths = focus.paths.includes(targetPath)
            ? focus.paths.filter((path) => path != sourcePath)
            : focus.paths.map((path) => path == sourcePath ? targetPath : path);
        focusesChanged = true;
    });
    if (focusesChanged)
        await superstate.spaceManager.saveFocuses(superstate.focuses);

};
