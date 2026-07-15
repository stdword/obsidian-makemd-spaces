import { FilesystemMiddleware } from "core/middleware/filesystem";
import { AFile } from "shared/types/afile";

import { fileSystemSpaceInfoByPath, fileSystemSpaceInfoFromFolder, fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { defaultSortForSettings, parseSpaceMetadata, spaceSortFn } from "core/utils/superstate/spaces";
import { ensureArray } from "core/utils/schema";
import { DEFAULT_SYSTEM_NAME, FOCUSES_FILE, SPACE_CONFIG_DEFAULT_CONTENT, SPACE_CONFIG_FILE, SPACE_FOLDER } from "schemas/constants";
import { Focus } from "shared/types/focus";
import { SpaceDefinition } from "shared/types/spaceDef";
import { PathCache, SpaceState } from "shared/types/PathState";
import { SpaceAdapter } from "shared/types/spaceManager";
import { safelyParseJSON } from "utils/json";
import { excludeSpacesPredicate, isSpaceInternalPath } from "utils/hide";
import { SpaceManager } from "../spaceManager";

export class FilesystemSpaceAdapter implements SpaceAdapter {
    public spaceManager: SpaceManager;
    public schemes = ["spaces", "vault"];
    public authorities = ["vault"];
    private recentlyCreatedFolders = new Map<string, number>();
    private static readonly EXTERNAL_RENAME_WINDOW_MS = 2000;

    public constructor(public fileSystem: FilesystemMiddleware, public dataPath: string) {
        fileSystem.eventDispatch.addListener("onCreate", this.onCreate, 0, this);
        fileSystem.eventDispatch.addListener("onRename", this.onRename, 0, this);
        fileSystem.eventDispatch.addListener("onDelete", this.onDelete, 0, this);
        fileSystem.eventDispatch.addListener("onFocusesUpdated", this.onFocusesUpdated, 0, this);
        fileSystem.eventDispatch.addListener("onSpaceUpdated", this.onSpaceUpdated, 0, this);
        fileSystem.eventDispatch.addListener("onCacheUpdated", this.onMetadataChange, 0, this);
    }

    private filesystemInfo(space: SpaceState) {
        return space?.space ?? (space as any);
    }

    public initiateAdapter(manager: SpaceManager) {
        this.spaceManager = manager;
    }

    public onFocusesUpdated = () => {
        this.spaceManager.onFocusesUpdated();
    };

    public onSpaceUpdated = (payload: { path: string; type: string }) => {
        if (payload.type == SPACE_CONFIG_FILE) {
            this.spaceManager.onPathPropertyChanged(payload.path);
        }
    };
    public loadPath = async (path: string) => {
        return this.fileSystem.loadPath(path);
    };

    public async readFocuses(): Promise<Focus[]> {
        if (!(await this.fileSystem.fileExists(this.dataPath))) {
            await this.fileSystem.createFolder(this.dataPath);
        }
        if (!(await this.fileSystem.fileExists(`${this.dataPath}/${FOCUSES_FILE}`))) {
            return [];
        }
        return this.fileSystem.readTextFromFile(`${this.dataPath}/${FOCUSES_FILE}`).then((f) => ensureArray(safelyParseJSON(f)));
    }
    public async saveFocuses(focuses: Focus[]) {
        if (!(await this.fileSystem.fileExists(this.dataPath))) {
            await this.fileSystem.createFolder(this.dataPath);
        }
        return this.fileSystem.writeTextToFile(`${this.dataPath}/${FOCUSES_FILE}`, JSON.stringify(focuses, null, 2));
    }

    private spacePathFromConfigPath(path: string) {
        if (!path || path.split("/").pop() != SPACE_CONFIG_FILE) return null;
        const parentFolder = path.split("/").slice(-2, -1)[0];
        if (parentFolder != SPACE_FOLDER) return null;
        const spacePath = path.split("/").slice(0, -2).join("/");
        return spacePath || "/";
    }

    private spacePathFromSpaceFolderPath(path: string) {
        if (!path || path.split("/").pop() != SPACE_FOLDER) return null;
        const spacePath = path.split("/").slice(0, -1).join("/");
        return spacePath || "/";
    }

    private async onMetadataChange(payload: { path: string }) {
        if (!payload.path) return;
        const spacePathFromDef = this.spacePathFromConfigPath(payload.path);
        if (spacePathFromDef) {
            this.spaceManager.onPathPropertyChanged(spacePathFromDef);
            return;
        }
        this.spaceManager.onPathPropertyChanged(payload.path);
    }

    public uriByPath(path: string) {
        return this.spaceManager.uriByString(path);
    }
    public allPaths(type?: string[], hidden?: boolean) {
        return [
            ...this.fileSystem
                .allFiles(hidden)
                .filter((f) => (type ? type.some((g) => (g == "folder" ? f.isFolder : f.extension == g)) : true))
                .map((g) => g.path)
                .filter((f) => !isSpaceInternalPath(f) && (hidden || !excludeSpacesPredicate(this.spaceManager.superstate.settings, f))),
        ];
    }
    public async pathExists(path: string) {
        const uri = this.uriByPath(path);
        if (uri.scheme == "spaces") {
            if (uri.authority.charAt(0) == "#")
                return true;
            if (path == "/")
                return true;
        }
        return this.fileSystem.fileExists(path);
    }
    public async createItemAtPath(parent: string, type: string, name: string, content?: any) {
        // Handle folder creation
        if (type === "folder") {
            const folderPath = parent ? `${parent}/${name}` : name;
            await this.fileSystem.createFolder(folderPath);
            return folderPath;
        }

        const parentURI = await this.getPathInfo(parent);
        if (!parentURI) {
            await this.fileSystem.createFolder(parent);
        } else if (!parentURI?.isFolder) {
            return null;
        }
        return this.fileSystem.newFile(parent, name, type, content).then((f) => f?.path);
    }
    public async renamePath(oldPath: string, path: string): Promise<string> {
        return await this.fileSystem.renameFile(oldPath, path);
    }
    public async deletePath(path: string) {
        return this.fileSystem.deleteFile(path);
    }

    public async getPathInfo(path: string) {
        const uri = this.uriByPath(path);
        const file = await this.fileSystem.getFile(uri.path);
        return file as Record<string, any>;
    }

    public async readPathCache(path: string): Promise<PathCache> {
        const uri = this.uriByPath(path);
        if (uri.scheme == "spaces") {
            if (uri.authority.charAt(0) == "#") {
                return {
                    metadata: {},
                    type: "space",
                    subtype: "tag",
                    name: uri.authority,
                    path,
                    parent: "",
                    tags: [],
                    hidden: false,
                };
            }
        }
        if (path == "/") {
            return {
                metadata: {},
                type: "space",
                subtype: "folder",
                name: DEFAULT_SYSTEM_NAME,
                path,
                parent: "",
                tags: [],
                hidden: false,
            };
        }

        const fileCache = this.fileSystem.getFileCache(path);
        if (fileCache) {
            return {
                type: fileCache.type,
                subtype: fileCache.subtype,
                metadata: fileCache.metadata ?? {},
                name: fileCache.name,
                path: fileCache.path,
                parent: fileCache.parent,
                tags: fileCache.tags ?? [],
                hidden: fileCache.hidden ?? false,
            };
        }

        const file = await this.fileSystem.getFile(uri.path);
        if (!file) return null;
        return {
            metadata: file.isFolder ? {} : {
                ctime: file.ctime,
                mtime: file.mtime,
                size: file.size,
            },
            type: file.isFolder ? "space" : "file",
            subtype: file.isFolder ? "folder" : file.extension,
            name: file.isFolder ? file.name : file.name.replace(new RegExp(`\\.${file.extension}$`), ""),
            path,
            parent: this.spaceManager.parentPathForPath(path),
            tags: [],
            hidden: false,
        };
    }
    public async readPath(path: string) {
        const uri = this.uriByPath(path);
        return this.fileSystem.readTextFromFile(uri.path);
    }
    public async copyPath(path: string, newPath: string, newName?: string) {
        const uri = this.uriByPath(path);
        const file = await this.fileSystem.getFile(uri.path);

        return this.fileSystem.copyFile(file.path, newPath, newName);
    }
    public async writeToPath(path: string, content: any, binary: boolean) {
        console.log('TRACE writeToPath', {path, content})
        const uri = this.uriByPath(path);
        if (uri.refStr) {
            return null;
        }
        if (binary) {
            return this.fileSystem.writeBinaryToFile(uri.path, content);
        }
        return this.fileSystem.writeTextToFile(uri.path, content);
    }

    public async childrenForPath(path: string, type?: string) {
        if (await this.fileSystem.fileExists(path)) return this.fileSystem.childrenForFolder(path, type);
        return [];
    }

    public parentPathForPath(path: string) {
        return this.fileSystem.parentPathForPath(path);
    }

    public async spaceInitiated(_path: string) {
        return true;
    }

    public async readProperties(path: string) {
        return {};
    }

    onCreate = async (payload: { file: AFile }) => {
        if (payload.file.isFolder) {
            this.recentlyCreatedFolders.set(payload.file.path, Date.now());
            this.spaceManager.onSpaceCreated(payload.file.path);
        } else {
            this.spaceManager.onPathCreated(payload.file.path);
        }
    };

    onDelete = (payload: { file: AFile }) => {
        if (!payload.file) return;
        const changedSpacePath = this.spacePathFromConfigPath(payload.file.path) ?? this.spacePathFromSpaceFolderPath(payload.file.path);
        if (changedSpacePath) {
            this.spaceManager.onPathPropertyChanged(changedSpacePath);
            return;
        }
        if (!payload.file.isFolder && payload.file.extension != "mdb") {
            this.spaceManager.onPathDeleted(payload.file.path);
        } else if (payload.file.isFolder) {
            const now = Date.now();
            const parentPath = this.spaceManager.parentPathForPath(payload.file.path);
            const oldPathIsFocusSection = this.spaceManager.superstate.focuses.some((focus) => focus.paths.includes(payload.file.path));
            const candidates = [...this.recentlyCreatedFolders.entries()]
                .filter(([, createdAt]) => now - createdAt <= FilesystemSpaceAdapter.EXTERNAL_RENAME_WINDOW_MS)
                .filter(([path]) => path != payload.file.path && this.spaceManager.parentPathForPath(path) == parentPath);
            for (const [path, createdAt] of this.recentlyCreatedFolders) {
                if (now - createdAt > FilesystemSpaceAdapter.EXTERNAL_RENAME_WINDOW_MS) this.recentlyCreatedFolders.delete(path);
            }
            if (oldPathIsFocusSection && candidates.length == 1) {
                const [newPath] = candidates[0];
                this.recentlyCreatedFolders.delete(newPath);
                this.spaceManager.onSpaceRenamed(newPath, payload.file.path);
                return;
            }
            this.spaceManager.onSpaceDeleted(payload.file.path);
        }
    };

    onRename = (payload: { file: AFile; oldPath: string }) => {
        if (!payload.file) return;
        if (payload.file.isFolder) this.recentlyCreatedFolders.delete(payload.file.path);
        if (!payload.file.isFolder && payload.file.extension != "mdb") {
            this.spaceManager.onPathChanged(payload.file.path, payload.oldPath);
        } else if (payload.file.isFolder) {
            this.spaceManager.onSpaceRenamed(payload.file.path, payload.oldPath);
        }
    };

    public allSpaces(hidden?: boolean) {
        const getAllFolderContextFiles = () => {
            const folders = this.allPaths(["folder"], hidden).filter((f) => hidden || !excludeSpacesPredicate(this.spaceManager.superstate.settings, f));

            return folders.map((f) => fileSystemSpaceInfoFromFolder(this.spaceManager, f));
        };

        const allFolders = getAllFolderContextFiles();
        return allFolders;
    }

    public readTags() {
        return this.fileSystem.allTags();
    }

    // Local
    public spaceInfoForPath(path: string) {
        return fileSystemSpaceInfoByPath(this.spaceManager, path);
    }

    public allCaches() {
        return this.fileSystem.allCaches();
    }

    private spaceDefinitionForStore(metadata: SpaceDefinition): SpaceDefinition {
        const storedDefinition = {
            color: metadata.color ?? "",
            sticker: metadata.sticker ?? "",
            defaultColor: metadata.defaultColor ?? "",
            defaultSticker: metadata.defaultSticker ?? "",
            "rank-order": metadata["rank-order"] ?? [],
            links: metadata.links ?? [],
            pinned: metadata.pinned ?? [],
            "file-colors": metadata["file-colors"] ?? {},
        } as SpaceDefinition;
        if (Object.prototype.hasOwnProperty.call(metadata, "sort")) {
            storedDefinition.sort = metadata.sort;
        }
        return storedDefinition;
    }

    private async writeSpaceDefinition(space: SpaceState, metadata: SpaceDefinition) {
        const spaceInfo = this.filesystemInfo(space);
        let defFile = await this.fileSystem.getFile(spaceInfo.defPath);
        const metadataForStore = this.spaceDefinitionForStore(metadata);
        if (!defFile) {
            const extension = spaceInfo.defPath.split(".").pop();
            const folder = spaceInfo.defPath.split("/").slice(0, -1).join("/");
            const filename = spaceInfo.defPath.split("/").pop().split(".")[0];
            if (!(await this.fileSystem.fileExists(folder))) {
                await this.fileSystem.createFolder(folder);
            }
            defFile = await this.fileSystem.newFile(folder, filename, extension, SPACE_CONFIG_DEFAULT_CONTENT(metadataForStore));
        }
        await this.fileSystem.writeTextToFile(defFile.path, JSON.stringify(metadataForStore, null, 2));
    }

    private spaceFolderForDefinition(space: SpaceState) {
        return this.filesystemInfo(space).defPath.split("/").slice(0, -1).join("/");
    }

    private async deleteEmptySpaceDefinition(space: SpaceState) {
        const spaceInfo = this.filesystemInfo(space);
        if (await this.fileSystem.fileExists(spaceInfo.defPath)) {
            await this.fileSystem.deleteFile(spaceInfo.defPath);
        }

        const folder = this.spaceFolderForDefinition(space);
        if (!folder || !(await this.fileSystem.fileExists(folder))) return;

        const children = await this.fileSystem.childrenForFolder(folder);
        if ((children ?? []).length == 0) {
            await this.fileSystem.deleteFile(folder);
        }
    }

    private async rankOrderMatchesDefaultSort(spacePath: string, rankOrder: string[]) {
        if (rankOrder.length == 0) return true;
        const items = this.spaceManager.superstate.getSpaceItems?.(spacePath) ?? [];
        if (items.length != rankOrder.length) return false;

        const pathByItem = new Set(items.map((item: any) => item.path));
        if (!rankOrder.every((path) => pathByItem.has(path))) return false;

        const defaultOrder = [...items].sort(spaceSortFn(defaultSortForSettings(this.spaceManager.superstate.settings))).map((item: any) => item.path);
        return JSON.stringify(rankOrder) == JSON.stringify(defaultOrder);
    }

    private async spaceDefinitionHasContent(spacePath: string, metadata: SpaceDefinition) {
        if (metadata.color || metadata.sticker || metadata.defaultColor || metadata.defaultSticker) return true;
        if ((metadata.links ?? []).length > 0) return true;
        if ((metadata.pinned ?? []).length > 0) return true;
        if (Object.values(metadata["file-colors"] ?? {}).some((color) => !!color)) return true;
        if (metadata.sort && Object.keys(metadata.sort).length > 0) return true;

        const rankOrder = metadata["rank-order"] ?? [];
        if (rankOrder.length == 0) return false;
        return !(await this.rankOrderMatchesDefaultSort(spacePath, rankOrder));
    }

    public async spaceDefinitionForPath(path: string) {
        const space = this.spaceInfoForPath(path);
        if (!space) return null;

        const spaceInfo = this.filesystemInfo(space);
        const metaCache = spaceInfo.defPath ? await this.fileSystem.readTextFromFile(spaceInfo.defPath) : null;
        if (!metaCache) {
            const metadata = parseSpaceMetadata({}, this.spaceManager.superstate.settings);
            return metadata;
        }
        const spaceDef = safelyParseJSON(metaCache);
        const metadata = parseSpaceMetadata(spaceDef, this.spaceManager.superstate.settings);
        const metadataForStore = {
            ...metadata,
            sort: spaceDef.sort,
        };
        if (JSON.stringify(spaceDef) != JSON.stringify(this.spaceDefinitionForStore(metadataForStore))) {
            await this.writeSpaceDefinition(space, metadataForStore);
        }
        return metadata;
    }

    public async createSpace(name: string, parentPath: string, definition: SpaceDefinition) {
        const spaceInfo = this.spaceInfoForPath(parentPath);

        const parentSpaceInfo = this.filesystemInfo(spaceInfo);
        const newPath = parentSpaceInfo.folderPath == "/" ? name : parentSpaceInfo.folderPath + "/" + name;
        await this.fileSystem.createFolder(newPath);
        if (Object.keys(definition ?? {}).length > 0) return this.saveSpace(newPath, () => definition);
    }

    public async saveSpace(path: string, definitionFn: (def: SpaceDefinition) => SpaceDefinition) {
        const spaceInfo = this.spaceInfoForPath(path);
        const filesystemInfo = this.filesystemInfo(spaceInfo);
        const rawDefinition = safelyParseJSON(filesystemInfo.defPath ? await this.fileSystem.readTextFromFile(filesystemInfo.defPath) : null) ?? {};
        const currentMetadata = parseSpaceMetadata(rawDefinition, this.spaceManager.superstate.settings);
        const metadata = definitionFn(currentMetadata) ?? {};
        const sortChanged = JSON.stringify(metadata.sort) != JSON.stringify(currentMetadata.sort);
        const metadataForStore: SpaceDefinition = {
            ...metadata,
            sort: sortChanged ? metadata.sort : rawDefinition.sort,
        };
        const storedDefinition = this.spaceDefinitionForStore(metadataForStore);
        if (await this.spaceDefinitionHasContent(path, storedDefinition)) {
            await this.writeSpaceDefinition(spaceInfo, metadataForStore);
        } else {
            await this.deleteEmptySpaceDefinition(spaceInfo);
        }
        return;
    }

    public renameSpace(oldPath: string, newPath: string) {
        const spaceInfo = this.spaceInfoForPath(oldPath);
        const newSpaceInfo = this.spaceInfoForPath(newPath);
        return this.fileSystem.renameFile(spaceInfo.space.folderPath, newSpaceInfo.space.folderPath).then((f) => {
            return f;
        });
    }
    public deleteSpace(path: string) {
        const spaceCache = this.spaceInfoForPath(path);
        const spaceInfo = fileSystemSpaceInfoFromTag(this.spaceManager, spaceCache.name);
        this.fileSystem.deleteFile(spaceInfo.space.folderPath);
    }

    public childrenForSpace(path: string) {
        return this.fileSystem
            .allFiles()
            .filter((f) => f.parent == path)
            .map((f) => f.path);
    }

    public pathsForTag(tag: string) {
        return this.fileSystem.filesForTag(tag);
    }

    public resolvePath(path: string, source: string) {
        return this.fileSystem.resolvePath(path, source);
    }
}
