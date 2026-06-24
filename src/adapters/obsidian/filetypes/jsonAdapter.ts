import { AFile, FileTypeAdapter, FilesystemMiddleware } from "makemd-core";

import { omit } from "lodash";
import MakeMDPlugin from "main";
import { SPACE_DEF_FILE, SPACE_SUB_FOLDER } from "shared/constants";
import { safelyParseJSON } from "shared/utils/json";
import { parseProperty } from "utils/parsers";

type CachedMetadataContentTypes = {
    property: any;
    label: string;
    definition: any;
};

export class JSONFiletypeAdapter implements FileTypeAdapter<Record<string, any>, CachedMetadataContentTypes> {
    public supportedFileTypes: string[] = ["json"];
    public id = "json.make.md";
    public constructor(public plugin: MakeMDPlugin) {
        this.plugin = plugin;
        this.cache = new Map();
    }

    public initiate(middleware: FilesystemMiddleware) {
        this.middleware = middleware;
    }
    public middleware: FilesystemMiddleware;
    public async parseCache(file: AFile, refresh?: boolean) {
        if (!file) return;
        const cache = safelyParseJSON(await this.middleware.readTextFromFile(file.path)) ?? {};
        const label = cache.label ?? {};
        const property = cache.property ?? {};
        const definition = omit(cache, ["label", "property"]);
        const updatedCache = {
            property: property,
            definition: definition,
            label: {
                sticker: label?.sticker?.length > 0 ? label.sticker : "ui//json",
                color: label?.color,
            },
        };

        if (file.parent.split("/").pop() == SPACE_SUB_FOLDER && file.path.split("/").pop() == SPACE_DEF_FILE) {
            const label = await this.readContent(file, "label", null);
            updatedCache.label = { ...label };
        }

        this.cache.set(file.path, updatedCache);
        this.middleware.updateFileCache(file.path, updatedCache, refresh);
    }
    public cache: Map<string, Record<string, any>>;
    public cacheTypes: (file: AFile) => string[];
    public contentTypes(_file: AFile) {
        return ["property", "label", "definition"] as Array<keyof CachedMetadataContentTypes>;
    }
    public async newFile(parent: string, name: string, _type: string, content: string) {
        const newPath = parent == "/" ? name + ".json" : `${parent}/${name}.json`;

        if (!(await this.middleware.fileExists(parent))) {
            await this.middleware.createFolder(parent);
        }
        await this.middleware.writeTextToFile(newPath, content ?? "");
        return this.middleware.getFile(newPath);
    }
    public getCacheTypeByRefString: (file: AFile, refString: string) => any;
    public getCache: (file: AFile, fragmentType: string, query?: string) => never;
    public async readContent(file: AFile, fragmentType: string, _fragmentId: any) {
        if (fragmentType == "definition") {
            const cache = await this.middleware.readTextFromFile(file.path);
            return omit(safelyParseJSON(cache) ?? {}, ["label", "property"]);
        }
        if (fragmentType == "property") {
            const cache = await this.middleware.readTextFromFile(file.path);
            return safelyParseJSON(cache)?.property ?? {};
        }
        if (fragmentType == "label") {
            const cache = await this.middleware.readTextFromFile(file.path);
            const fm = safelyParseJSON(cache)?.label ?? {};
            const sticker = parseProperty("sticker", fm[this.plugin.superstate.settings.fmKeySticker]);
            const color = parseProperty("color", fm[this.plugin.superstate.settings.fmKeyColor]);
            const rows: Record<string, any> = {};
            if (sticker?.length > 0) {
                rows["sticker"] = sticker;
            }
            if (color?.length > 0) {
                rows["color"] = color;
            }
            return rows;
        }
        return null;
    }
    public newContent: (file: AFile, fragmentType: string, name: string, content: never, options: { [key: string]: any }) => Promise<any>;
    public async saveContent(file: AFile, fragmentType: string, fragmentId: any, content: (prev: any) => any) {
        if (fragmentType == "label") {
            const currentProperties = await this.readContent(file, "label", fragmentId);

            if (fragmentId == "sticker") {
                currentProperties[this.plugin.superstate.settings.fmKeySticker] = content(currentProperties);
            } else if (fragmentId == "color") {
                currentProperties[this.plugin.superstate.settings.fmKeyColor] = content(currentProperties);
            }

            const currentJSON = safelyParseJSON(await this.middleware.readTextFromFile(file.path)) ?? {};

            await this.middleware.writeTextToFile(file.path, JSON.stringify({ ...currentJSON, label: currentProperties }));
            this.parseCache(file, true);
        }
        if (fragmentType == "definition") {
            const currentProperties = await this.readContent(file, fragmentType, fragmentId);

            const newProperties = content(currentProperties);
            const currentJSON = safelyParseJSON(await this.middleware.readTextFromFile(file.path)) ?? {};
            await this.middleware.writeTextToFile(file.path, JSON.stringify({ ...currentJSON, ...newProperties }));
            this.parseCache(file, true);
        }
        if (fragmentType == "property") {
            const currentProperties = await this.readContent(file, fragmentType, fragmentId);

            const newProperties = content(currentProperties);
            const currentJSON = safelyParseJSON(await this.middleware.readTextFromFile(file.path))?.property ?? {};
            await this.middleware.writeTextToFile(file.path, JSON.stringify({ ...currentJSON, property: newProperties }));
            this.parseCache(file, true);
        }
        return true;
    }
    public async deleteContent(file: AFile, fragmentType: string, fragmentId: any) {
        if (fragmentType == "property") {
            const currentProperties = await this.readContent(file, fragmentType, fragmentId);
            delete currentProperties[fragmentId];
            const currentJSON = safelyParseJSON(await this.middleware.readTextFromFile(file.path)) ?? {};
            await this.middleware.writeTextToFile(file.path, JSON.stringify({ ...currentJSON, property: currentProperties }));
            this.parseCache(file, true);
        }
    }
}
