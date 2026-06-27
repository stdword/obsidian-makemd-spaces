import { FileCache, FilesystemMiddleware } from "core/middleware/filesystem";
import { AFile } from "shared/types/afile";
import { PathLabel } from "shared/types/caches";

import { fileSystemSpaceInfoByPath, fileSystemSpaceInfoFromFolder, fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { parseSpaceMetadata } from "core/superstate/utils/spaces";
import { builtinSpaces } from "core/types/space";
import { ensureArray, tagSpacePathFromTag } from "core/utils/strings";
import { DEFAULT_SYSTEM_NAME, FOCUSES_FILE, SPACE_DEF_DEFAULT_CONTENT, SPACE_DEF_FILE, SPACE_SUB_FOLDER } from "shared/constants";
import { Focus } from "shared/types/focus";
import { SpaceProperty } from "shared/types/mdb";
import { SpaceDefinition } from "shared/types/spaceDef";
import { SpaceInfo } from "shared/types/spaceInfo";
import { SpaceAdapter } from "shared/types/spaceManager";
import { safelyParseJSON } from "shared/utils/json";
import { excludeSpacesPredicate } from "utils/hide";
import { SpaceManager } from "../spaceManager";

export class FilesystemSpaceAdapter implements SpaceAdapter {
    public constructor(
        public fileSystem: FilesystemMiddleware,
        public dataPath: string,
    ) {
        fileSystem.eventDispatch.addListener("onCreate", this.onCreate, 0, this);
        fileSystem.eventDispatch.addListener("onRename", this.onRename, 0, this);
        fileSystem.eventDispatch.addListener("onDelete", this.onDelete, 0, this);
        fileSystem.eventDispatch.addListener("onFocusesUpdated", this.onFocusesUpdated, 0, this);
        fileSystem.eventDispatch.addListener("onSpaceUpdated", this.onSpaceUpdated, 0, this);
        fileSystem.eventDispatch.addListener("onCacheUpdated", this.onMetadataChange, 0, this);
    }

    public spaceManager: SpaceManager;
    public schemes = ["spaces", "vault"];
    public initiateAdapter(manager: SpaceManager) {
        this.spaceManager = manager;
    }

    public onFocusesUpdated = () => {
        this.spaceManager.onFocusesUpdated();
    };

    public onSpaceUpdated = (payload: { path: string; type: string }) => {
        if (payload.type == SPACE_DEF_FILE) {
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

    private spacePathFromDefPath(path: string) {
        if (!path || path.split("/").pop() != SPACE_DEF_FILE) return null;
        const parentFolder = path.split("/").slice(-2, -1)[0];
        if (parentFolder != SPACE_SUB_FOLDER) return null;
        const spacePath = path.split("/").slice(0, -2).join("/");
        return spacePath || "/";
    }

    private spacePathFromSpaceFolderPath(path: string) {
        if (!path || path.split("/").pop() != SPACE_SUB_FOLDER) return null;
        const spacePath = path.split("/").slice(0, -1).join("/");
        return spacePath || "/";
    }

    private async onMetadataChange(payload: { path: string }) {
        if (!payload.path) return;
        const spacePathFromDef = this.spacePathFromDefPath(payload.path);
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
                .filter((f) => !hidden && !excludeSpacesPredicate(this.spaceManager.superstate.settings, f)),
        ];
    }
    public async pathExists(path: string) {
        const uri = this.uriByPath(path);
        if (uri.scheme == "spaces") {
            if (uri.authority.charAt(0) == "$") {
                const builtIn = Object.keys(builtinSpaces).find((f) => f == uri.authority.slice(1));
                if (builtIn) {
                    return true;
                }
            }

            if (uri.authority.charAt(0) == "#") {
                return true;
            }
            if (path == "/") {
                return true;
            }
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
            const file = await this.fileSystem.getFile(parent);
            if (!file) return null;
            return this.fileSystem.newFileFragment(file, type, name, content)?.then(() => file.path);
        }
        return this.fileSystem.newFile(parent, name, type, content).then((f) => f?.path);
    }
    public async renamePath(oldPath: string, path: string): Promise<string> {
        const uri = this.uriByPath(oldPath);
        const newUri = this.uriByPath(path);
        const file = await this.fileSystem.getFile(uri.path);
        if (uri.refStr) {
            const refType = await this.fileSystem.getFileCacheTypeByRefString(file, uri.refStr);
            await this.fileSystem.saveFileFragment(file, refType, uri.refStr, () => newUri.refStr);
            return path;
        }
        return await this.fileSystem.renameFile(oldPath, path);
    }
    public async deletePath(path: string) {
        const uri = this.uriByPath(path);
        if (uri.refStr) {
            const file = await this.fileSystem.getFile(uri.path);
            const refType = await this.fileSystem.getFileCacheTypeByRefString(file, uri.refStr);
            return this.fileSystem.deleteFileFragment(file, refType, uri.refStr);
        }
        return this.fileSystem.deleteFile(path);
    }

    public async getPathInfo(path: string) {
        const uri = this.uriByPath(path);
        const file = await this.fileSystem.getFile(uri.path);
        if (uri.refStr) {
            this.fileSystem.getFileCacheTypeByRefString(file, uri.refStr);
        }
        return file as Record<string, any>;
    }

    public keysForCacheType(path: string) {
        return this.fileSystem.keysForCacheType(path);
    }

    public async readPathCache(path: string): Promise<FileCache> {
        const uri = this.uriByPath(path);
        if (uri.scheme == "spaces") {
            if (uri.authority.charAt(0) == "$") {
                const builtIn = Object.keys(builtinSpaces).find((f) => f == uri.authority.slice(1));
                if (builtIn) {
                    return {
                        file: {
                            name: builtinSpaces[builtIn].name,
                        },
                        metadata: null,
                        label: {
                            sticker: builtinSpaces[builtIn].icon,
                            color: "",
                        },
                        readOnly: false,
                        type: "space",
                        parent: "",
                        tags: [],
                    } as FileCache;
                }
            }

            if (uri.authority.charAt(0) == "#") {
                return {
                    file: {
                        name: uri.authority,
                    },
                    metadata: null,
                    label: {
                        sticker: "",
                        color: "",
                    },
                    type: "space",
                    subtype: "tag",
                    parent: "",
                    tags: [],
                    readOnly: false,
                } as FileCache;
            }
        }
        if (path == "/") {
            return {
                file: {
                    name: DEFAULT_SYSTEM_NAME,
                    path: "/",
                    isFolder: true,
                },
                metadata: {},
                label: {
                    sticker: "",
                    color: "",
                },
                type: "space",
                subtype: "folder",
                parent: "",
                tags: [],
                readOnly: false,
            } as FileCache;
        }

        return this.fileSystem.getFileCache(path);
    }
    public async readPath(path: string) {
        const uri = this.uriByPath(path);
        const file = await this.fileSystem.getFile(uri.path);
        if (uri.refStr) {
            const fragmentType = this.fileSystem.getFileCacheTypeByRefString(file, uri.refStr);
            this.fileSystem.getFileContent(file, fragmentType, uri.refStr);
        }
        return this.fileSystem.readTextFromFile(path);
    }
    public async copyPath(path: string, newPath: string, newName?: string) {
        const uri = this.uriByPath(path);
        const file = await this.fileSystem.getFile(uri.path);

        return this.fileSystem.copyFile(file.path, newPath, newName);
    }
    public async writeToPath(path: string, content: any, binary: boolean) {
        const uri = this.uriByPath(path);
        const file = await this.fileSystem.getFile(uri.path);
        if (uri.refStr) {
            const fragmentType = this.fileSystem.getFileCacheTypeByRefString(file, uri.refStr);
            this.fileSystem.saveFileFragment(file, fragmentType, uri.refStr, () => content);
        }
        if (binary) {
            return this.fileSystem.writeBinaryToFile(path, content);
        }
        return this.fileSystem.writeTextToFile(path, content);
    }

    public async childrenForPath(path: string, type?: string) {
        if (await this.fileSystem.fileExists(path)) return this.fileSystem.childrenForFolder(path, type);
        return [];
    }

    public parentPathForPath(path: string) {
        // const uri = this.uriByPath(path);
        // const file = await this.fileSystem.getFile(uri.path);
        // if (uri.refStr) {
        //   return file.path
        // }
        return this.fileSystem.parentPathForPath(path);
    }

    public async spaceInitiated(_path: string) {
        return true;
    }
    public async addProperty(path: string, property: SpaceProperty) {
        const file = await this.fileSystem.getFile(path);
        this.fileSystem.newFileFragment(file, "property", property.name, property);
    }
    public async saveProperties(path: string, properties: { [key: string]: any }) {
        const file = await this.fileSystem.getFile(path);

        return this.fileSystem.saveFileFragment(file, "property", null, (prev) => ({ ...prev, ...properties }));
    }

    public async readLabel(path: string) {
        if (path?.split("/").pop() == SPACE_DEF_FILE) {
            const metadata = parseSpaceMetadata(safelyParseJSON(await this.fileSystem.readTextFromFile(path)) ?? {}, this.spaceManager.superstate.settings);
            return {
                sticker: metadata.sticker ?? "",
                color: metadata.color ?? "",
            } as PathLabel;
        }
        const pathCache = this.fileSystem.getFileCache(path)?.label as PathLabel;
        if (!pathCache) {
            const file = await this.fileSystem.getFile(path);
            if (file) {
                return this.fileSystem.readFileFragments(file, "label", null);
            }
            return {};
        }
        return pathCache;
    }

    public async saveLabel(path: string, label: keyof PathLabel, value: any) {
        if (this.spaceManager.superstate.spacesIndex.has(path)) {
            await this.saveSpace(path, (metadata) => ({ ...metadata, [label]: value }));
            return;
        }

        const file = await this.fileSystem.getFile(path);
        this.fileSystem.saveFileLabel(file, label, value);
    }

    public async renameProperty(path: string, property: string, newProperty: string) {
        const file = await this.fileSystem.getFile(path);
        this.fileSystem.saveFileFragment(file, "property", null, (prev: { [key: string]: any }) => {
            const { [property]: value, ...properties } = prev;
            if (!value) return prev;
            return { ...properties, [newProperty]: value };
        });
    }
    public async readProperties(path: string) {
        const file = await this.fileSystem.getFile(path);
        return this.fileSystem.readFileFragments(file, "property", null);
    }
    public async deleteProperty(path: string, property: string) {
        const file = await this.fileSystem.getFile(path);
        this.fileSystem.deleteFileFragment(file, "property", property);
    }

    onCreate = async (payload: { file: AFile }) => {
        if (payload.file.isFolder) {
            this.spaceManager.onSpaceCreated(payload.file.path);
        } else {
            this.spaceManager.onPathCreated(payload.file.path);
        }
    };

    onDelete = (payload: { file: AFile }) => {
        if (!payload.file) return;
        const changedSpacePath = this.spacePathFromDefPath(payload.file.path) ?? this.spacePathFromSpaceFolderPath(payload.file.path);
        if (changedSpacePath) {
            this.spaceManager.onPathPropertyChanged(changedSpacePath);
            return;
        }
        if (!payload.file.isFolder && payload.file.extension != "mdb") {
            this.spaceManager.onPathDeleted(payload.file.path);
        } else if (payload.file.isFolder) {
            this.spaceManager.onSpaceDeleted(payload.file.path);
        }
    };

    onRename = (payload: { file: AFile; oldPath: string }) => {
        if (!payload.file) return;
        if (!payload.file.isFolder && payload.file.extension != "mdb") {
            this.spaceManager.onPathChanged(payload.file.path, payload.oldPath);
        } else if (payload.file.isFolder) {
            this.spaceManager.onSpaceRenamed(payload.file.path, payload.oldPath);
        }
    };

    public authorities = ["vault"];

    public allSpaces(hidden?: boolean) {
        const getAllFolderContextFiles = () => {
            const folders = this.allPaths(["folder"], hidden).filter((f) => !excludeSpacesPredicate(this.spaceManager.superstate.settings, f) && !hidden);

            return folders.map((f) => fileSystemSpaceInfoFromFolder(this.spaceManager, f));
        };

        const allFolders = getAllFolderContextFiles();
        return allFolders;
    }

    public readTags() {
        return this.fileSystem.allTags();
    }

    //Local SpaceInfo for Path
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

    private async writeSpaceDefinition(space: SpaceInfo, metadata: SpaceDefinition) {
        let defFile = await this.fileSystem.getFile(space.defPath);
        const metadataForStore = this.spaceDefinitionForStore(metadata);
        if (!defFile) {
            const extension = space.defPath.split(".").pop();
            const folder = space.defPath.split("/").slice(0, -1).join("/");
            const filename = space.defPath.split("/").pop().split(".")[0];
            if (!(await this.fileSystem.fileExists(folder))) {
                await this.fileSystem.createFolder(folder);
            }
            defFile = await this.fileSystem.newFile(folder, filename, extension, SPACE_DEF_DEFAULT_CONTENT(metadataForStore));
        }
        await this.fileSystem.saveFileFragment(defFile, "definition", null, () => metadataForStore);
    }

    private spaceFolderForDefinition(space: SpaceInfo) {
        return space.defPath.split("/").slice(0, -1).join("/");
    }

    private async deleteEmptySpaceDefinition(space: SpaceInfo) {
        if (await this.fileSystem.fileExists(space.defPath)) {
            await this.fileSystem.deleteFile(space.defPath);
        }

        const folder = this.spaceFolderForDefinition(space);
        if (!folder || !(await this.fileSystem.fileExists(folder))) return;

        const children = await this.fileSystem.childrenForFolder(folder);
        if ((children ?? []).length == 0) {
            await this.fileSystem.deleteFile(folder);
        }
    }

    private async rankOrderIsAlphabetical(spacePath: string, rankOrder: string[]) {
        if (rankOrder.length == 0) return true;
        const items = this.spaceManager.superstate.getSpaceItems?.(spacePath) ?? [];
        if (items.length != rankOrder.length) return false;

        const nameByPath = new Map(items.map((item: any) => [item.path, item.name ?? item.path]));
        if (!rankOrder.every((path) => nameByPath.has(path))) return false;

        const alphabetical = [...rankOrder].sort((a, b) => String(nameByPath.get(a)).localeCompare(String(nameByPath.get(b)), undefined, { sensitivity: "base" }));
        return JSON.stringify(rankOrder) == JSON.stringify(alphabetical);
    }

    private async spaceDefinitionHasContent(spacePath: string, metadata: SpaceDefinition) {
        if (metadata.color || metadata.sticker || metadata.defaultColor || metadata.defaultSticker) return true;
        if ((metadata.links ?? []).length > 0) return true;
        if ((metadata.pinned ?? []).length > 0) return true;
        if (Object.values(metadata["file-colors"] ?? {}).some((color) => !!color)) return true;
        if (metadata.sort && Object.keys(metadata.sort).length > 0) return true;

        const rankOrder = metadata["rank-order"] ?? [];
        if (rankOrder.length == 0) return false;
        return !(await this.rankOrderIsAlphabetical(spacePath, rankOrder));
    }

    public async spaceDefForSpace(path: string) {
        const space = this.spaceInfoForPath(path);
        if (!space) return null;

        const metaCache = space.defPath ? await this.fileSystem.readTextFromFile(space.defPath) : null;
        if (!metaCache) {
            const metadata = parseSpaceMetadata({}, this.spaceManager.superstate.settings);
            return metadata;
        }
        const spaceDef = safelyParseJSON(metaCache) ?? {};
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

        const newPath = spaceInfo.folderPath == "/" ? name : spaceInfo.folderPath + "/" + name;
        await this.fileSystem.createFolder(newPath);
        if (Object.keys(definition ?? {}).length > 0) return this.saveSpace(newPath, () => definition);
    }

    public async saveSpace(path: string, definitionFn: (def: SpaceDefinition) => SpaceDefinition, properties?: Record<string, any>) {
        const spaceInfo = this.spaceInfoForPath(path);
        const rawDefinition = safelyParseJSON(spaceInfo.defPath ? await this.fileSystem.readTextFromFile(spaceInfo.defPath) : null) ?? {};
        const currentMetadata = parseSpaceMetadata(rawDefinition, this.spaceManager.superstate.settings);
        const metadata = definitionFn(currentMetadata) ?? {};
        const sortChanged = JSON.stringify(metadata.sort) != JSON.stringify(currentMetadata.sort);
        const metadataForStore = {
            ...metadata,
            sort: sortChanged ? metadata.sort : rawDefinition.sort,
        };
        if (properties) {
            let noteFile = await this.fileSystem.getFile(spaceInfo.defPath);
            if (!noteFile) {
                const extension = spaceInfo.defPath.split(".").pop();
                const folder = spaceInfo.defPath.split("/").slice(0, -1).join("/");
                const filename = spaceInfo.defPath.split("/").pop().split(".")[0];
                if (!(await this.fileSystem.fileExists(folder))) {
                    await this.fileSystem.createFolder(folder);
                }
                noteFile = await this.fileSystem.newFile(folder, filename, extension, SPACE_DEF_DEFAULT_CONTENT(this.spaceDefinitionForStore(metadataForStore)));
            }
            await this.fileSystem.saveFileFragment(noteFile, "property", null, (frontmatter) => ({
                ...frontmatter,
                ...(properties ?? {}),
            }));
        }
        const storedDefinition = this.spaceDefinitionForStore(metadataForStore);
        const hasProperties = !!properties || Object.keys(rawDefinition.property ?? {}).length > 0;
        if (hasProperties || (await this.spaceDefinitionHasContent(path, storedDefinition))) {
            await this.writeSpaceDefinition(spaceInfo, metadataForStore);
        } else {
            await this.deleteEmptySpaceDefinition(spaceInfo);
        }
        // await this.spaceManager.onPathPropertyChanged(file.path);
        // await this.spaceManager.onSpaceCreated(path);
        return;
    }

    public renameSpace(oldPath: string, newPath: string) {
        const spaceInfo = this.spaceInfoForPath(oldPath);
        const newSpaceInfo = this.spaceInfoForPath(newPath);
        return this.fileSystem.renameFile(spaceInfo.folderPath, newSpaceInfo.folderPath).then((f) => {
            return f;
        });
    }
    public deleteSpace(path: string) {
        const spaceCache = this.spaceInfoForPath(path);
        const spaceInfo = fileSystemSpaceInfoFromTag(this.spaceManager, spaceCache.name);
        this.fileSystem.deleteFile(spaceInfo.folderPath);
    }

    public childrenForSpace(path: string) {
        return this.fileSystem
            .allFiles()
            .filter((f) => f.parent == path)
            .map((f) => f.path);
    }

    public async addTag(path: string, tag: string) {
        const fileCache = this.fileSystem.getFileCache(path);

        if (fileCache.subtype == "md" || fileCache.subtype == "folder") {
            this.fileSystem.addTagToFile(path, tag);
            return;
        }
        const tagPath = tagSpacePathFromTag(tag);
        const metadata = this.spaceManager.superstate.spacesIndex.get(tagPath)?.metadata ?? (await this.spaceDefForSpace(tagPath));
        const spaceExists = ensureArray(metadata.links) ?? [];
        const pathExists = spaceExists.find((f) => f == path);
        if (!pathExists) {
            spaceExists.push(path);
        }

        const newMetadata = { ...metadata, links: spaceExists };
        await this.spaceManager.superstate.updateSpaceMetadata(tagPath, newMetadata);
        this.spaceManager.superstate.reloadPath(path, true).then(() => this.spaceManager.superstate.dispatchEvent("pathStateUpdated", { path: path }));
    }

    public renameTag(path: string, tag: string, newTag: string) {
        return this.fileSystem.renameTagForFile(path, tag, newTag);
    }

    public deleteTag(path: string, tag: string) {
        return this.fileSystem.removeTagFromFile(path, tag);
    }

    public pathsForTag(tag: string) {
        return this.fileSystem.filesForTag(tag);
    }

    public resolvePath(path: string, source: string) {
        return this.fileSystem.resolvePath(path, source);
    }
}
