import { AFile, FileTypeAdapter, FilesystemMiddleware } from "makemd-core";
import MakeMDPlugin from "main";
import { safelyParseJSON } from "utils/json";

export class JSONFiletypeAdapter implements FileTypeAdapter<Record<string, any>> {
    public id = "json.make.md";
    public supportedFileTypes: string[] = ["json"];

    public middleware: FilesystemMiddleware;
    public cache: Map<string, Record<string, any>>;
    public cacheTypes: (file: AFile) => string[];

    public getCache: (file: AFile, cacheType: string, query?: string) => never;
    public parseCache: (file: AFile, refresh: boolean) => Promise<void>;

    public constructor(public plugin: MakeMDPlugin) {
        this.plugin = plugin;
        this.cache = new Map();
    }

    public initiate(middleware: FilesystemMiddleware) {
        this.middleware = middleware;
    }

    public async newFile(parent: string, name: string, _type: string, content: string) {
        const newPath = parent == "/" ? name + ".json" : `${parent}/${name}.json`;

        if (!(await this.middleware.fileExists(parent)))
            await this.middleware.createFolder(parent);

        await this.middleware.writeTextToFile(newPath, content ?? "");
        return this.middleware.getFile(newPath);
    }

    public async readContent(file: AFile) {
        return safelyParseJSON(await this.middleware.readTextFromFile(file.path));
    }

    public async saveContent(file: AFile, content: Record<string, any>) {
        await this.middleware.writeTextToFile(file.path, JSON.stringify(content ?? {}, null, 2));
        return true;
    }
}
