import { AFile, FileTypeAdapter, FilesystemMiddleware } from "makemd-core";

import MakeMDPlugin from "main";
import { TFolder } from "obsidian";
import { getAbstractFileAtPath, uniqueFileName } from "../utils/file";

export class ObsidianBaseFiletypeAdapter implements FileTypeAdapter<Record<string, any>> {
    public supportedFileTypes: string[] = ["base"];
    public id = "base.obsidian.md";
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
        this.cache.set(file.path, {});
    }
    public cache: Map<string, Record<string, any>>;
    public cacheTypes: (file: AFile) => string[];
    public async newFile(parent: string, name: string, _type: string) {
        if (!name) {
            name = uniqueFileName("Untitled", "Untitled", "base", getAbstractFileAtPath(this.plugin.app, parent) as TFolder);
        }
        const newPath = `${parent}/${name}`;
        await this.middleware.writeTextToFile(newPath, "");
        return this.middleware.getFile(newPath);
    }
    public getCache: (file: AFile, cacheType: string, query?: string) => never;
}
