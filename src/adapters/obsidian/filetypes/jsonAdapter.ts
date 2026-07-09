import { AFile, FileTypeAdapter, FilesystemMiddleware } from "makemd-core";
import MakeMDPlugin from "main";
import { SPACE_CONFIG_PATH } from "schemas/constants";
import { safelyParseJSON } from "utils/json";

type CachedMetadataContentTypes = {
    definition: any;
};

const stringifyJSON = (value: Record<string, any>) => JSON.stringify(value, null, 2);

export class JSONFiletypeAdapter implements FileTypeAdapter<Record<string, any>, CachedMetadataContentTypes> {
    public id = "json.make.md";
    public supportedFileTypes: string[] = ["json"];

    public middleware: FilesystemMiddleware;
    public cache: Map<string, Record<string, any>>;
    public cacheTypes: (file: AFile) => string[];

    public getCacheTypeByRefString: (file: AFile, refString: string) => any;
    public getCache: (file: AFile, fragmentType: keyof CachedMetadataContentTypes, query?: string) => never;
    public newContent: (file: AFile, fragmentType: keyof CachedMetadataContentTypes, name: string, content: never, options: { [key: string]: any }) => Promise<any>;

    public constructor(public plugin: MakeMDPlugin) {
        this.plugin = plugin;
        this.cache = new Map();
    }
    public initiate(middleware: FilesystemMiddleware) {
        this.middleware = middleware;
    }

    public async parseCache(file: AFile, refresh?: boolean) {
        console.log('TRACE parseCache', {file, refresh})

        if (!file)
            return

        if (!file.path.endsWith(SPACE_CONFIG_PATH))  // work only on .space/context.json
            throw new Error('.json adapter wrong usage');

        const cache = safelyParseJSON(await this.middleware.readTextFromFile(file.path));

        this.cache.set(file.path, cache);
        this.middleware.updateFileCache(file.path, cache, refresh);
    }


    public contentTypes(_file: AFile) {
        return ["definition"] as Array<keyof CachedMetadataContentTypes>;
    }

    public async newFile(parent: string, name: string, _type: string, content: string) {
        const newPath = parent == "/" ? name + ".json" : `${parent}/${name}.json`;

        if (!(await this.middleware.fileExists(parent)))
            await this.middleware.createFolder(parent);

        await this.middleware.writeTextToFile(newPath, content ?? "");
        return this.middleware.getFile(newPath);
    }
    public async readContent(file: AFile, fragmentType: keyof CachedMetadataContentTypes, _fragmentId: any) {
        if (fragmentType == "definition")
            return await this.middleware.readTextFromFile(file.path);

        return null;
    }
    public async saveContent(file: AFile, fragmentType: keyof CachedMetadataContentTypes, fragmentId: any, content: (prev: any) => any) {
        if (fragmentType == "definition") {
            const currentProperties = await this.readContent(file, fragmentType, fragmentId);

            const newProperties = content(currentProperties);
            const currentJSON = safelyParseJSON(await this.middleware.readTextFromFile(file.path));
            await this.middleware.writeTextToFile(file.path, stringifyJSON({ ...currentJSON, ...newProperties }));
            this.parseCache(file, true);
        }

        return true;
    }
}
