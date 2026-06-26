export const treeItemDisplayColor = (pathState: any, _defaultColor = "") => pathState?.effectiveLabel?.color ?? pathState?.label?.color ?? "";

export const treeItemColorVariables = (color: string, isFolder: boolean) =>
    color?.length > 0
        ? {
              "--label-color": color,
              "--icon-color": isFolder ? "#ffffff" : color,
              position: "relative",
          }
        : {
              "--icon-color": "var(--mk-ui-text-secondary)",
              position: "relative",
          };

export const treeItemActiveColorVariables = (color: string, isFolder: boolean) =>
    color?.length > 0
        ? {
              "--label-color": color,
              "--icon-color": isFolder ? "#ffffff" : color,
          }
        : {};
