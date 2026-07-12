import { App, CachedMetadata, getAllTags } from "obsidian";
import { MakeMDSettings } from "shared/types/settings";
import { uniq } from "utils/array";
import MakeMDPlugin from "main";


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
