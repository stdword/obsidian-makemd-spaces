import MakeMDPlugin from "main";
import { SpaceManager } from "makemd-core";
import { App, CachedMetadata, Pos, TFile, getAllTags } from "obsidian";
import { MakeMDSettings } from "shared/types/settings";
import { uniq } from "utils/array";
import { serializeMultiDisplayString } from "utils/serializers";
import { stringFromTag, validateName } from "utils/tags";

const tagKeys = ["tags"];

export const loadTags = (app: App, _settings: MakeMDSettings): string[] => {
    return uniq(
        [
            ...Object.keys(app.metadataCache.getTags())
                .map((tag) => tag.toLowerCase()),
        ]
    )
};

const tagExists = (currentCache: CachedMetadata, tag: string): boolean => {
    const fileTags = getAllTags(currentCache)
    if (!fileTags)
        return false

    return !!fileTags.find(
        tag_ => tag_.toLowerCase() == tag.toLowerCase()
    )
};

export const getAllFilesForTag = (plugin: MakeMDPlugin, tag: string): string[] => {
    return plugin.app.vault.getMarkdownFiles()
        .filter(tfile => {
            const cache = plugin.app.metadataCache.getFileCache(tfile);
            return cache && tagExists(cache, tag);
        })
        .map(tfile => tfile.path);
};

export const addTagToProperties = (manager: SpaceManager, tag: string, path: string) => {
    console.log('TRACE add tag', {path, tag})
    const newTag = validateName(tag);
    editTagInProperties(manager, "", newTag, path);
};

const positionsForTag = (plugin: MakeMDPlugin, tag: string, file: TFile) => {
    const currentCache = plugin.app.metadataCache.getFileCache(file);
    if (currentCache.tags) {
        const positions = currentCache.tags
            .filter((f) => f.tag.toLowerCase() == tag.toLowerCase())
            .map((f) => f.position)
            .sort((a: Record<string, any>, b: Record<string, any>) => {
                if (a.start.offset < b.start.offset) {
                    return -1;
                }
                if (a.start.offset > b.start.offset) {
                    return 1;
                }
                return 0;
            });
        return positions;
    }
    return [];
};

export const renameTagInMarkdownFile = async (plugin: MakeMDPlugin, tag: string, newTag: string, tFile: TFile) => {
    console.log('TRACE rename tag', {tFile, tag, newTag})
    const positions = positionsForTag(plugin, tag, tFile);
    if (positions.length > 0) {
        await editTagInFileBody(plugin, tag, newTag, positions, tFile);
    } else {
        await editTagInProperties(plugin.superstate.spaceManager, tag, newTag, tFile.path);
    }
};

const editTagInProperties = async (manager: SpaceManager, oldTag: string, newTag: string, path: string) => {
    console.log('TRACE edit tag', {path, oldTag, newTag})
    const addTag = (value: string | string[]) => {
        if (Array.isArray(value)) {
            return uniq([...value, stringFromTag(newTag)]).filter((f) => f?.length > 0);
        } else if (typeof value === "string") {
            return serializeMultiDisplayString(uniq([...value.replace(/\s/g, "").split(","), stringFromTag(newTag)]).filter((f) => f?.length > 0));
        }
        return stringFromTag(newTag);
    };
    const fm = await manager.readProperties(path);
    if (fm) {
        const processKey = (value: string | string[]) => {
            if (Array.isArray(value)) {
                return uniq(value.map((f) => (stringFromTag(oldTag) == f ? stringFromTag(newTag) : f)));
            } else if (typeof value === "string") {
                return serializeMultiDisplayString(
                    uniq(
                        value
                            .replace(/\s/g, "")
                            .split(",")
                            .map((f) => (stringFromTag(oldTag) == f ? stringFromTag(newTag) : f)),
                    ),
                );
            }
            return value;
        };

        const editKeys = tagKeys.filter((f) => {
            let tags: string[] = [];
            if (Array.isArray(fm[f])) {
                tags = fm[f];
            } else if (typeof fm[f] === "string") {
                tags = fm[f].replace(/\s/g, "").split(",");
            }
            if (tags.find((g) => g == stringFromTag(oldTag))) return true;
            return false;
        });
        if (editKeys.length > 0) {
            editKeys.forEach((key) => {
                // manager.saveProperties(path, {
                //     [key]: processKey(fm[key]),
                // });
            });
        } else {
            // manager.saveProperties(path, {
            //     tags: addTag(fm["tags"]),
            // });
        }
    } else {
        // manager.saveProperties(path, {
        //     tags: stringFromTag(newTag),
        // });
    }
};

const editTagInFileBody = async (plugin: MakeMDPlugin, oldTag: string, newTag: string, positions: Pos[], file: TFile) => {
    console.log('TRACE edit tag body', {file, oldTag, newTag, positions})
    if (!newTag) return false;
    const offsetOffset = newTag.length - oldTag.length;
    if (positions.length == 0) return false;
    const original = await plugin.files.readTextFromFile(file.path);
    let text = original;
    let offset = 0;
    for (const { start, end } of positions) {
        const startOff = start.offset + offset;
        const endOff = end.offset + offset;
        if (text.slice(startOff, endOff).toLowerCase() !== oldTag.toLocaleLowerCase()) {
            return false;
        }
        text = text.slice(0, startOff) + newTag + text.slice(startOff + oldTag.length);
        offset += offsetOffset;
    }
    if (text !== original) {
        await plugin.files.writeTextToFile(file.path, text);
        return true;
    }
};
