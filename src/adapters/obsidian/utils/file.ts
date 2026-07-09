import MakeMDPlugin from "main";
import { AFile } from "makemd-core";
import { App, TAbstractFile, TFile, TFolder, WorkspaceLeaf, normalizePath } from "obsidian";

import { TargetLocation } from "shared/types/path";
import { DEFAULT_NEW_NOTE_NAME } from "schemas/constants";
import { selectElementContents } from "utils/dom";
import { removeTrailingSlashFromFolder } from "utils/paths";
import { sanitizeFileName, sanitizeFolderName } from "utils/sanitizers";

export const splitFileName = (filename: string) => {
    if (filename.endsWith(".excalidraw.md")) {
        return {
            name: filename.substring(0, filename.length - ".excalidraw.md".length),
            extension: "excalidraw",
        };
    }

    if (filename.lastIndexOf(".") == -1) {
        return {
            name: filename,
            extension: "",
        };
    }

    return {
        name: filename.substring(0, filename.lastIndexOf(".")),
        extension: filename.split(".").pop(),
    };
};

export const fileSuffixForExtension = (extension: string) => (extension == "excalidraw" ? "excalidraw.md" : extension);

export const fileNameWithExtension = (name: string, extension: string) => {
    const suffix = fileSuffixForExtension(extension);
    return suffix?.length > 0 ? `${name}.${suffix}` : name;
};

export const tFileToAFile = (file: TAbstractFile | TFile): AFile => {
    if (!file) return null;
    if (file instanceof TFile && file.stat) {
        const fileNameParts = splitFileName(file.name);
        return {
            isFolder: false,
            name: fileNameParts.name,
            filename: file.name,
            path: file.path,
            parent: file.parent?.path,
            extension: fileNameParts.extension,
            ...file.stat,
        };
    }
    return {
        isFolder: true,
        name: file.name,
        filename: file.name,
        path: file.path,
        parent: file.parent?.path,
    };
};

export const defaultConfigFile = async (plugin: MakeMDPlugin) => {
    return await plugin.app.vault.adapter.read(normalizePath(plugin.app.vault.configDir + "/app.json"));
};

export const fileExtensionForFile = (path: string) => (path?.indexOf(".") > 0 ? path.split(".").pop() : "md");
export const fileNameForFile = (path: string) => (path?.indexOf("/") > 0 ? path.split("/").pop().split(".").shift() : path.split(".").shift());

export const uniqueFileName = (oldName: string, name: string, extension: string, folder: TFolder) => {
    let newName = sanitizeFileName(name);
    const suffix = fileSuffixForExtension(extension);

    let uniqueName = false;
    let append = 1;
    while (!uniqueName) {
        if (!folder.children.some((f) => f.name == fileNameWithExtension(newName, suffix) && f.name != oldName)) {
            uniqueName = true;
        } else {
            newName = `${newName} ${append}`;
            append += 1;
        }
    }
    return fileNameWithExtension(newName, suffix);
};

export const uniqueFolderName = (oldName: string, name: string, folder: TFolder) => {
    let newName = sanitizeFolderName(name);
    let uniqueName = false;
    let append = 1;
    while (!uniqueName) {
        if (!folder.children.some((f) => f.name == `${newName}` && f.name != oldName)) {
            uniqueName = true;
        } else {
            newName = `${newName} ${append}`;
            append += 1;
        }
    }
    return `${newName}`;
};

export const renameFile = async (plugin: MakeMDPlugin, file: TAbstractFile, newName: string) => {
    const afile = tFileToAFile(file);
    const fileName = afile.isFolder ? uniqueFolderName(file.name, newName, file.parent) : uniqueFileName(file.name, newName, afile.extension, file.parent);
    const newPath = file.parent.path == "/" ? fileName : file.parent.path + "/" + fileName;
    return await plugin.files.renameFile(file.path, newPath);
};

export function getAllAbstractFilesInVault(app: App): TAbstractFile[] {
    const files: TAbstractFile[] = [];
    const rootFolder = app.vault.getRoot();
    function recursiveFx(folder: TFolder) {
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                const childFolder: TFolder = child as TFolder;
                if (childFolder.children) recursiveFx(childFolder);
            }
            files.push(child);
        }
    }
    recursiveFx(rootFolder);
    files.push(rootFolder);
    return files;
}

export const getFolderFromPath = (plugin: MakeMDPlugin, path: string): AFile => {
    if (!path) return null;
    const afile = tFileToAFile(getAbstractFileAtPath(plugin.app, removeTrailingSlashFromFolder(path)));
    if (!afile) return null;
    return afile.isFolder ? afile : tFileToAFile(getAbstractFileAtPath(plugin.app, afile.parent));
};

export const getFolderPathFromString = (plugin: MakeMDPlugin, file: string) => getFolderFromPath(plugin, file)?.path;

// Files out of Md should be listed with extension badge - Md without extension

export const deleteFiles = (plugin: MakeMDPlugin, files: string[]) => {
    files.forEach((f) => {
        plugin.files.deleteFile(f);
    });
};

// Returns all parent folder paths

export const getLeaf = (app: App, location: TargetLocation) => {
    let leaf;
    if (location == "system" || location == "hover") {
        return null;
    } else if (location == "right") {
        leaf = app.workspace.getRightLeaf(false);
    } else if (location == "left") {
        leaf = app.workspace.getLeftLeaf(false);
    } else {
        leaf = app.workspace.getLeaf(location);
    }
    return leaf;
};
export const openURL = async (url: string, app: App, location?: TargetLocation) => {
    if (location == "system") {
        window.open(url, "_blank");
        return;
    }
    const leaf = getLeaf(app, location);
    if (url.endsWith(".mdb")) {
        const file = getAbstractFileAtPath(app, url);
        if (file instanceof TFile) await openTFile(leaf, file, app);
    } else {
        window.open(url, "_blank");
    }
};

export function getAllFoldersInVault(app: App): TFolder[] {
    const folders: TFolder[] = [];
    const rootFolder = app.vault.getRoot();
    folders.push(rootFolder);
    function recursiveFx(folder: TFolder) {
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                const childFolder: TFolder = child as TFolder;
                folders.push(childFolder);
                if (childFolder.children) recursiveFx(childFolder);
            }
        }
    }
    recursiveFx(rootFolder);
    return folders;
}

export const openTFile = async (leaf: WorkspaceLeaf, file: TFile, app: App) => {
    if (!file) return;

    app.workspace.setActiveLeaf(leaf, { focus: true });

    await leaf.openFile(file);
};

export const openTagContext = async (_leaf: WorkspaceLeaf, _tag: string, _app: App) => {
    return;
};

export const openArbitraryView = async (view: string, app: App, newLeaf: TargetLocation) => {
    const leaf = getLeaf(app, newLeaf);
    app.workspace.setActiveLeaf(leaf, { focus: true });
    await leaf.setViewState({ type: view });
    await app.workspace.requestSaveLayout();
};

export const getAbstractFileAtPath = (app: App, path: string) => {
    return app.vault.getAbstractFileByPath(path);
};

export const abstractFileAtPathExists = (app: App, path: string) => {
    return app.vault.getAbstractFileByPath(path) ? true : false;
};

export const createNewMarkdownFile = async (plugin: MakeMDPlugin, folder: AFile, newFileName: string, content?: string, dontOpen?: boolean): Promise<AFile> => {
    const fileName = newFileName?.length > 0 ? newFileName : DEFAULT_NEW_NOTE_NAME;
    const newFile = await plugin.files.newFile(folder.path, fileName, "md");

    if (content && content !== "") await plugin.files.writeTextToFile(newFile.path, content);

    if (dontOpen) {
        return newFile;
    }
    await plugin.superstate.ui.openPath(newFile.path, false);
    const titleEl = plugin.app.workspace.activeLeaf.view.containerEl.querySelector(".inline-title") as HTMLDivElement;
    if (titleEl) {
        titleEl.focus();
        selectElementContents(titleEl);
    }
    plugin.superstate.ui.setActivePath(newFile.path);
    return newFile;
};
