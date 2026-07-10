import { AFile } from "shared/types/afile";
import { EventTypeToPayload } from "utils/dispatcher";
import { FilesystemMiddleware } from "./filesystem";

export interface FileTypeEventTypes extends EventTypeToPayload {
    onFileMetadataChanged: { file: AFile };
}

export interface FileTypeCache {
    [cacheType: string]: any;
}

export abstract class FileTypeAdapter<T extends FileTypeCache> {
    public supportedFileTypes: string[];
    public id: string;
    public initiate: (middleware: FilesystemMiddleware) => void;
    public middleware: FilesystemMiddleware;
    public loadFile?: (file: AFile) => Promise<void>;
    public parseCache: (file: AFile, refresh: boolean) => Promise<void>;
    public cache: Map<string, T>;
    public cacheTypes: (file: AFile) => (keyof T)[];

    public newFile: (parent: string, name: string, type: string, content?: any) => Promise<AFile>;

    public getCache: (file: AFile, cacheType: keyof T, query?: string) => T[typeof cacheType];
    public readContent?: (file: AFile) => Promise<any>;
    public saveContent?: (file: AFile, content: any) => Promise<boolean>;
}
