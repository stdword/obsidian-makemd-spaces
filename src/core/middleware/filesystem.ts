import { AFile } from "shared/types/afile";
import { PathCache } from "shared/types/PathState";
import { EventDispatcher, EventTypeToPayload } from "utils/dispatcher";
import { FileTypeAdapter, FileTypeCache } from "./filetypes";

export interface FileSystemEventTypes extends EventTypeToPayload {
    onCreate: { file: AFile };
    onRename: { file: AFile; oldPath: string };
    onModified: { file: AFile };
    onDelete: { file: AFile };
    onSpaceUpdated: { path: string; type: string };
    onCacheUpdated: { path: string };
    onFocusesUpdated: null;
    onFilesystemIndexed: null;
}

export abstract class FileSystemAdapter {
    public cache: Map<string, PathCache & { file?: AFile }>;
    public initiate: (middleware: FilesystemMiddleware) => void;
    public middleware: FilesystemMiddleware;
    public getRoot: () => Promise<AFile>;
    public keysForCacheType: (cacheType: string) => string[];
    public allFiles: (hidden?: boolean) => AFile[];
    public allContent: () => any[];
    public resourcePathForPath: (path: string) => string;
    public copyFile: (folder: string, path: string, newName?: string) => Promise<string>;
    public parentPathForPath: (path: string) => string;
    public updateFileCache: (path: string, cache: FileTypeCache, refresh: boolean) => void;
    public writeTextToFile: (path: string, content: string) => Promise<void>;
    public readTextFromFile: (path: string) => Promise<string>;
    public writeBinaryToFile: (path: string, buffer: ArrayBuffer) => Promise<void>;
    public readBinaryToFile: (path: string) => Promise<ArrayBuffer>;
    public renameFile: (path: string, newPath: string) => Promise<string>;
    public createFolder: (path: string) => Promise<AFile>;
    public fileExists: (path: string) => Promise<boolean>;
    public childrenForFolder: (path: string, type?: string) => Promise<string[]>;
    public getFile: (path: string, source?: string) => Promise<AFile>;
    public getFileCache: (path: string, source?: string) => PathCache & { file?: AFile };
    public deleteFile: (path: string) => Promise<void>;
    public readAllTags: () => string[];
    public filesForTag: (tag: string) => string[];
    public resolvePath: (path: string, source: string) => string;
}

export class FilesystemMiddleware {
    public eventDispatch: EventDispatcher<FileSystemEventTypes>;
    public primary: FileSystemAdapter;
    public filesystems: FileSystemAdapter[] = [];
    public filetypes: FileTypeAdapter<FileTypeCache>[] = [];
    public static create(): FilesystemMiddleware {
        return new FilesystemMiddleware();
    }
    private constructor() {
        //Initialize
        this.eventDispatch = new EventDispatcher();
    }

    public loadPath = async (path: string): Promise<void> => {
        const file = await this.getFile(path);
        if (!file) return null;
        this.filetypeAdaptersForFile(file).forEach((adapter) => {
            if (adapter.loadFile) adapter.loadFile(file);
        });
        return null;
    };

    public resolvePath(path: string, source: string) {
        return this.primary.resolvePath(path, source);
    }

    public keysForCacheType(cacheType: string) {
        return this.primary.keysForCacheType(cacheType);
    }

    public allTags() {
        return this.primary.readAllTags();
    }

    public initiateFileSystemAdapter(adapter: FileSystemAdapter, primary: boolean) {
        adapter.initiate(this);
        if (primary) {
            this.primary = adapter;
        }
        this.filesystems.push(adapter);
    }

    public initiateFiletypeAdapter(adapter: FileTypeAdapter<FileTypeCache>) {
        adapter.initiate(this);
        this.filetypes.push(adapter);
    }

    public filetypeAdaptersForFile(file: AFile) {
        if (!file) return [];
        return this.filetypes.filter((f) => f.supportedFileTypes.includes(file.extension));
    }

    public allCaches() {
        return this.primary.cache;
    }

    public allFiles(hidden?: boolean) {
        return this.primary.allFiles(hidden);
    }
    public resourcePathForPath(path: string) {
        return this.adapterForPath(path).resourcePathForPath(path);
    }
    public parentPathForPath(path: string) {
        return this.adapterForPath(path).parentPathForPath(path);
    }

    public async createFileCache(path: string) {
        const file = await this.getFile(path);
        for (const adapter of this.filetypeAdaptersForFile(file)) {
            if (adapter.parseCache) await adapter.parseCache(file, false);
        }
    }

    public getFileCache(path: string) {
        return this.adapterForPath(path).getFileCache(path);
    }

    public updateFileCache(path: string, cache: FileTypeCache, refresh: boolean) {
        this.adapterForPath(path).updateFileCache(path, cache, refresh);
    }

    public async newFile(parent: string, name: string, type: string, content?: any): Promise<AFile> {
        // Construct the full path: parent/name.type

        // Find the appropriate file type adapter for this file type
        const adapter = this.filetypes.find((f) => f.supportedFileTypes.includes(type));
        if (adapter?.newFile) {
            return adapter.newFile(parent, name, type, content);
        }
    }

    public onCreate(file: AFile) {
        this.eventDispatch.dispatchEvent("onCreate", { file });
    }

    public onModify(file: AFile) {
        this.eventDispatch.dispatchEvent("onModify", { file });
    }

    public onRename(file: AFile, oldPath: string) {
        this.eventDispatch.dispatchEvent("onRename", { file, oldPath });
    }

    public onDelete(file: AFile) {
        this.eventDispatch.dispatchEvent("onDelete", { file });
    }

    public onSpaceUpdated(path: string, type: string) {
        this.eventDispatch.dispatchEvent("onSpaceUpdated", { path, type });
    }

    public onFocusesUpdated() {
        this.eventDispatch.dispatchEvent("onFocusesUpdated", null);
    }

    public adapterForPath(_path?: string) {
        return this.primary;
    }

    public async getRoot() {
        return this.adapterForPath().getRoot();
    }

    public async copyFile(path: string, folder: string, newName?: string) {
        return this.adapterForPath(path).copyFile(path, folder, newName);
    }
    public async writeTextToFile(path: string, content: string) {
        return this.adapterForPath(path).writeTextToFile(path, content);
    }
    public async readTextFromFile(path: string) {
        return this.adapterForPath(path).readTextFromFile(path);
    }

    public async writeBinaryToFile(path: string, buffer: ArrayBuffer) {
        return this.adapterForPath(path).writeBinaryToFile(path, buffer);
    }

    public async readBinaryToFile(path: string) {
        return this.adapterForPath(path).readBinaryToFile(path);
    }

    public async renameFile(path: string, newPath: string) {
        return this.adapterForPath(path).renameFile(path, newPath);
    }

    public async createFolder(path: string) {
        return this.adapterForPath(path).createFolder(path);
    }
    public async childrenForFolder(path: string, type?: string) {
        return this.adapterForPath(path).childrenForFolder(path, type);
    }
    public async fileExists(path: string) {
        return this.adapterForPath(path).fileExists(path);
    }

    public async getFile(path: string, source?: string) {
        return this.adapterForPath(path).getFile(path, source);
    }
    public async deleteFile(path: string) {
        return this.adapterForPath(path).deleteFile(path);
    }

    public filesForTag(tag: string) {
        return this.primary.filesForTag(tag);
    }
}
