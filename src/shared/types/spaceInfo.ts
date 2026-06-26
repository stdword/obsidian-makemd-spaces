export type FilesystemSpaceInfo = SpaceInfo & {
    folderPath: string;
};

export type SpaceInfo = {
    name: string;
    path: string;
    defPath: string;
    notePath: string;
};
