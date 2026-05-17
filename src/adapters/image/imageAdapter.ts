import MakeMDPlugin from "main";
import { AFile, FileTypeAdapter, FilesystemMiddleware } from "makemd-core";

export const supportedFileTypes = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

type ImageTypeCache = Record<never, never>;
type ImageTypeContent = Record<never, never>;

export class ImageFileTypeAdapter implements FileTypeAdapter<ImageTypeCache, ImageTypeContent> {
    public id = "images.make.md";
    public supportedFileTypes = supportedFileTypes;

    public constructor(public plugin: MakeMDPlugin) {
        this.plugin = plugin;
    }
    public middleware: FilesystemMiddleware;
    public cache: Map<string, ImageTypeCache>;
    public initiate(middleware: FilesystemMiddleware) {
        this.middleware = middleware;
        this.cache = new Map();
    }
    public loadFile: (file: AFile) => Promise<void>;
    public async parseCache(file: AFile, refresh: boolean) {
        if (!file) return;
        let thumbnail = file.path;
        const label = this.middleware.getFileCache(file.path)?.label;
        const updatedCache = {
            subtype: "image",
            label: {
                name: file.name,
                sticker: "lucide//file-image",
                color: label?.color,
                thumbnail: thumbnail,
                cover: thumbnail,
            },
            preview: {
                thumbnail: thumbnail,
            },
        };
        this.cache.set(file.path, updatedCache);
        this.middleware.updateFileCache(file.path, this.cache.get(file.path), refresh);
    }

    public cacheTypes(file: AFile) {
        return [] as Array<keyof ImageTypeCache>;
    }
    public contentTypes(file: AFile) {
        return [] as Array<keyof ImageTypeContent>;
    }

    public newFile: (path: string, type: string, parent: string, content?: any) => Promise<AFile>;

    public getCacheTypeByRefString: (file: AFile, refString: string) => any;
    public getCache: (file: AFile, fragmentType: keyof ImageTypeContent, query?: string) => never;
    public readContent: (file: AFile, fragmentType: keyof ImageTypeContent, fragmentId: any) => any;
    public newContent: (file: AFile, fragmentType: keyof ImageTypeContent, name: string, content: ImageTypeContent[typeof fragmentType], options: { [key: string]: any }) => Promise<any>;
    public saveContent: (file: AFile, fragmentType: keyof ImageTypeContent, fragmentId: any, content: (prev: ImageTypeContent[typeof fragmentType]) => any) => Promise<boolean>;
    public deleteContent: (file: AFile, fragmentType: keyof ImageTypeContent, fragmentId: any) => void;
}
