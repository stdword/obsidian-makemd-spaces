import { App } from "obsidian";
import { MakeMDSettings } from "shared/types/settings";
import { uniq } from "utils/array";


export const loadTags = (app: App, _settings: MakeMDSettings): string[] => {
    return uniq(
        [
            ...Object.keys(app.metadataCache.getTags())
                .map((tag) => tag.toLowerCase()),
        ]
    )
};
