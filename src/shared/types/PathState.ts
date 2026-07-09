import { SpaceDefinition } from "./spaceDef";

export type SuperstateEvent = {
    pathCreated: { path: string };
    pathChanged: { path: string; newPath: string };
    pathDeleted: { path: string };
    pathStateUpdated: { path: string };
    spaceChanged: { path: string; newPath: string };
    spaceDeleted: { path: string };
    spaceStateUpdated: { path: string };
    settingsChanged: null;
    focusesChanged: null;
    superstateUpdated: null;
    superstateReindex: null;
};

export type WorkerJobType = {
    type: string;
    path: string;
    payload?: { [key: string]: any };
};


export type SpaceType = "folder" | "tag" | "vault";
export type FilesystemSpaceInfo = {
    defPath: string;
    folderPath: string;
    notePath: string;
};
export type SpaceState = {
    type: SpaceType;

    name: string;
    path: string;
    space?: FilesystemSpaceInfo;  // empty for tag-spaces

    metadata: SpaceDefinition;
};


export type PathType = "space" | "file";
export type FileMetadata = {
    ctime: number;
    mtime: number;
    size: number;
}
export type PathCache = {
    type: PathType;
    subtype: string;  // extension for files; "folder" for folders

    name: string;
    path: string;
    parent: string;

    metadata: Partial<FileMetadata>;  // full for files, empty for folders

    tags: string[];
    hidden: boolean;
};
export type PathState = PathCache & {
    color: string;
    sticker: string;

    spaces: string[];
    linkedSpaces: string[];
    pinnedSpaces: string[];
};
