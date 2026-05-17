import MakeMDPlugin from "main";
import { AFile, FileTypeAdapter, FilesystemMiddleware, PathLabel } from "makemd-core";
import { App, CachedMetadata, TFile, TFolder } from "obsidian";
import { uniq } from "shared/utils/array";
import { parseMultiDisplayString } from "utils/parsers";
import { ensureTag } from "utils/tags";
import { DEFAULT_NEW_NOTE_NAME } from "shared/constants";
import { getAbstractFileAtPath, tFileToAFile } from "../utils/file";

type MarkdownCache = {
    tags: string[];
    label: PathLabel;
};

type MarkdownContent = {
    tags: string[];
};

const tagsFromCache = (cache: CachedMetadata): string[] => {
    const tags: string[] = [];
    if (cache?.tags) tags.push(...(cache.tags.map((f) => f.tag) ?? []));
    if (cache?.frontmatter?.tags) {
        tags.push(
            ...(typeof cache.frontmatter.tags === "string"
                ? parseMultiDisplayString(cache.frontmatter.tags.replace(/ /g, ""))
                : Array.isArray(cache.frontmatter.tags)
                  ? (cache.frontmatter.tags ?? [])
                  : []
            )
                .filter((f) => typeof f === "string")
                .map((f) => ensureTag(f)),
        );
    }
    if (cache?.frontmatter?.tag) {
        tags.push(
            ...(typeof cache.frontmatter.tag === "string"
                ? parseMultiDisplayString(cache.frontmatter.tag.replace(/ /g, ""))
                : Array.isArray(cache.frontmatter.tag)
                  ? (cache.frontmatter.tag ?? [])
                  : []
            )
                .filter((f) => typeof f === "string")
                .map((f) => ensureTag(f)),
        );
    }
    return uniq(tags.filter((f) => f));
};

export class ObsidianMarkdownFiletypeAdapter implements FileTypeAdapter<MarkdownCache, MarkdownContent> {
    public id = "metadata.obsidian.md";
    public cache: Map<string, MarkdownCache>;
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
        if (!file) return;
        const metadata = this.app.metadataCache.getCache(file.path);
        if (!metadata) return;
        const label = this.middleware.getFileCache(file.path)?.label;
        const updatedCache: MarkdownCache = {
            tags: tagsFromCache(metadata),
            label: {
                sticker: label?.sticker,
                color: label?.color,
            },
        };

        this.cache.set(file.path, updatedCache);
        this.middleware.updateFileCache(file.path, updatedCache, refresh);
    }

    public cacheTypes(file: AFile): (keyof MarkdownCache)[] {
        return ["tags"];
    }

    public contentTypes(file: AFile) {
        return ["tags"] as Array<keyof MarkdownContent>;
    }

    public getCacheTypeByRefString(file: AFile, refString: string): null {
        return null;
    }

    public getCache(file: AFile, fragmentType: keyof MarkdownCache, query?: any) {
        return this.cache.get(file.path)?.[fragmentType] as MarkdownCache[typeof fragmentType];
    }

    public async readContent(file: AFile, fragmentType: keyof MarkdownContent, fragmentId: any) {
        if (fragmentType == "tags") {
            const tFile = getAbstractFileAtPath(this.app, file.path) as TFile;
            return tagsFromCache(this.app.metadataCache.getFileCache(tFile));
        }
        return null;
    }

    public async newFile(parent: string, name: string, type: string, content?: string) {
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

    public newContent: (file: AFile, fragmentType: keyof MarkdownContent, fragmentId: string, content: MarkdownContent[keyof MarkdownContent], options: { [key: string]: any }) => Promise<any>;
    public saveContent: (file: AFile, fragmentType: keyof MarkdownContent, fragmentId: string, content: (prev: any) => any) => Promise<boolean>;
    public deleteContent: (file: AFile, fragmentType: keyof MarkdownContent, fragmentId: any) => void;
}
