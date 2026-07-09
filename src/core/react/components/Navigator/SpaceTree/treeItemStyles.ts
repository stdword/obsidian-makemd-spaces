export const treeItemDisplayColor = (pathState: any, _defaultColor = "") => pathState?.color ?? "";

export const treeItemDisplayName = (pathState: any, data: any, spacesIndex?: Map<string, any>) => {
    if (pathState?.name?.length > 0) return pathState.name;
    if (pathState?.type == "space" && pathState?.path) return spacesIndex?.get(pathState.path)?.name || data?.item?.name || data?.path;
    return data?.item?.name || data?.path;
};

export const treeItemColorVariables = (color: string, isFolder: boolean) =>
    color?.length > 0
        ? isFolder
            ? {
                  "--icon-color": "#ffffff",
                  position: "relative",
              }
            : {
                  "--label-color": color,
                  "--icon-color": color,
                  position: "relative",
              }
        : {
              "--icon-color": "var(--mk-ui-text-secondary)",
              position: "relative",
          };

export const treeItemActiveColorVariables = (color: string, isFolder: boolean) =>
    color?.length > 0
        ? isFolder
            ? {
                  "--icon-color": "#ffffff",
              }
            : {
                  "--label-color": color,
                  "--icon-color": color,
              }
        : {};
