export const removeLeadingSlash = (path: string) => (
    path.charAt(0) == "/" ? path.substring(1) : path
);

export const folderPathToString = (path: string) => removeLeadingSlash(path.substring(path.lastIndexOf("/"))) || path;
export const getParentFolderPaths = (path: string): string[] => {
    const folderPaths: string[] = [];
    const parts: string[] = path.split("/");
    let current = "";
    for (let i = 0; i < parts.length; i++) {
        current += `${i === 0 ? "" : "/"}` + parts[i];
        if (current != path) {
            folderPaths.push(current);
        }
    }

    return folderPaths;
};
export const pathToString = (path: string) => {
    if (path.lastIndexOf("/") != -1) {
        if (path.lastIndexOf(".") != -1) return removeLeadingSlash(path.substring(path.lastIndexOf("/") + 1, path.lastIndexOf(".")));
        return path.substring(path.lastIndexOf("/") + 1);
    }
    if (path.lastIndexOf(".") != -1) {
        return path.substring(0, path.lastIndexOf("."));
    }

    return path;
};

export const pathNameToString = (path: string) => path.substring(0, path.lastIndexOf(".")) || path;
export const getParentPathFromString = (file: string) => {
    const indexOfLastSlash = file.lastIndexOf("/");
    if (indexOfLastSlash == -1) {
        return "/";
    }
    return file.substring(0, indexOfLastSlash + 1);
};

/** Parent of a vault path: "" for a top-level entry or a missing path (no leading/trailing slash semantics). */
export const parentPathOf = (path: string | undefined): string => {
    if (!path) return "";
    const index = path.lastIndexOf("/");
    return index == -1 ? "" : path.slice(0, index);
};

export const removeTrailingSlashFromFolder = (path: string) => (path == "/" ? path : path.slice(-1) == "/" ? path.substring(0, path.length - 1) : path);

/** "Plan.md" + "md" -> "Plan"; leaves the name alone when it does not end with that extension. */
export const nameWithoutExtension = (name: string, extension: string | undefined): string =>
    extension && name.endsWith(`.${extension}`) ? name.slice(0, -(extension.length + 1)) : name;
