export type FilesystemSpaceInfo = SpaceInfo & {
    folderPath: string;
    dbPath: string;
};

export type SpaceInfo = {
    name: string;
    path: string;
    defPath: string;
    notePath: string;
};
