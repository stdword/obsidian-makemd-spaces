export type AFile = {
    path: string;
    name: string;
    filename: string;
    parent: string;
    isFolder: boolean;
    extension?: string;
    ctime?: number;
    mtime?: number;
    size?: number;
};
