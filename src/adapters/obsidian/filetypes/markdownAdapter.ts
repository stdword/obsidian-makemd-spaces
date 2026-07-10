import MakeMDPlugin from "main";
import { AFile, FileTypeAdapter, FilesystemMiddleware } from "makemd-core";
import { App, getAllTags, TFile, TFolder } from "obsidian";
import { DEFAULT_NEW_NOTE_NAME } from "schemas/constants";
import { getAbstractFileAtPath, tFileToAFile } from "../utils/file";


type MarkdownContent = {
    tags: string[];
};


export class ObsidianMarkdownFiletypeAdapter implements FileTypeAdapter<MarkdownContent> {
    public id = "metadata.obsidian.md";
    public cache: Map<string, MarkdownContent>;
    public supportedFileTypes = ["md"];
    public middleware: FilesystemMiddleware;
    public app: App;

    public constructor(public plugin: MakeMDPlugin) {
        this.app = plugin.app;
    }

    public initiate(middleware: FilesystemMiddleware) {
        this.middleware = middleware;
        this.cache = new Map();
    }

    public metadataChange(file: TFile) {
        this.parseCache(tFileToAFile(file), true);
    }

    public async parseCache(file: AFile, refresh?: boolean) {
        if (!file)
            return;

        const metadata = this.app.metadataCache.getCache(file.path);
        if (!metadata)
            return;

        const updatedCache: MarkdownContent = {
            tags: getAllTags(metadata),
        };

        this.cache.set(file.path, updatedCache);
        this.middleware.updateFileCache(file.path, updatedCache, refresh);
    }

    public cacheTypes(_file: AFile): (keyof MarkdownContent)[] {
        return ["tags"];
    }

    public getCache(file: AFile, cacheType: keyof MarkdownContent, _query?: any) {
        return this.cache.get(file.path)?.[cacheType] as MarkdownContent[typeof cacheType];
    }

    public async newFile(parent: string, name: string, _type: string, content?: string) {
        let parentFolder = getAbstractFileAtPath(this.app, parent);
        if (!parentFolder) {
            await this.middleware.createFolder(parent);
            parentFolder = getAbstractFileAtPath(this.app, parent);
        }
        const fileName = name?.length > 0 ? name : DEFAULT_NEW_NOTE_NAME;
        return this.app.fileManager.createNewMarkdownFile(parentFolder ? (parentFolder instanceof TFolder ? parentFolder : parentFolder.parent) : this.app.vault.getRoot(), fileName).then(async (f) => {
            if (content) {
                await this.app.vault.modify(f, content);
            }
            return tFileToAFile(f);
        });
    }
}
