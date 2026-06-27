import { resolvePath } from "core/superstate/utils/path";
import { builtinSpacePathPrefix } from "shared/schemas/builtin";
import { IAPI } from "shared/types/api";
import { Focus } from "shared/types/focus";
import { SpaceProperty } from "shared/types/mdb";
import { URI } from "shared/types/path";
import { SpaceDefinition, SpaceType } from "shared/types/spaceDef";
import { SpaceFragmentType } from "shared/types/spaceFragment";
import { SpaceAdapter, SpaceManagerInterface } from "shared/types/spaceManager";
import { ISuperstate } from "shared/types/superstate";
import { parseURI } from "shared/utils/uri";
import { PathCache } from "../../shared/types/caches";

export class SpaceManager implements SpaceManagerInterface {
    public primarySpaceAdapter: SpaceAdapter;
    public spaceAdapters: SpaceAdapter[] = [];
    public superstate: ISuperstate;
    public api: IAPI;

    public onSpaceUpdated(_path: string, _type: SpaceFragmentType) {
        return;
    }

    public getPathState = (path: string) => {
        return this.superstate.pathStateForPath(path);
    };
    public getPathsIndexMap = () => {
        return this.superstate.pathsIndex;
    };
    public onFocusesUpdated = () => {
        this.readFocuses().then((f) => {
            this.superstate.focuses = f;
            this.superstate.dispatchEvent("focusesChanged", null);
        });
    };

    public onPathCreated = async (path: string) => {
        this.superstate.onPathCreated(path);
    };

    public onPathDeleted = async (path: string) => {
        this.superstate.onPathDeleted(path);
    };

    public onPathChanged = async (path: string, oldPath: string) => {
        this.superstate.onPathRename(oldPath, path);
    };

    public onSpaceCreated = async (path: string) => {
        const space = await this.superstate.reloadSpace(this.spaceInfoForPath(path), null, true);
        await this.superstate.onSpaceDefinitionChanged(space);

        await this.superstate.onPathCreated(path);
    };
    public onSpaceRenamed = async (path: string, oldPath: string) => {
        await this.superstate.onSpaceRenamed(oldPath, this.spaceInfoForPath(path));
        await this.superstate.onPathRename(oldPath, path);
    };

    public onSpaceDeleted = async (path: string) => {
        this.superstate.onSpaceDeleted(path);
        this.superstate.onPathDeleted(path);
    };

    public onPathPropertyChanged = async (path: string) => {
        await this.superstate.onMetadataChange(path);
    };

    public resolvePath(path: string, source?: string) {
        const resolvedPath = resolvePath(path, source, (p) => this.superstate.spacesIndex.has(p));
        if (resolvedPath !== path) return resolvedPath;
        if (this.superstate.pathsIndex.has(path)) return path;
        return this.primarySpaceAdapter.resolvePath(path, source) ?? path;
    }
    public uriByString(uri: string, source?: string): URI {
        if (!uri) return null;

        if (source) {
            uri = this.resolvePath(uri, source);
            if (!uri) return null;
        }
        return parseURI(uri);
    }

    public spaceTypeByString = (uri: URI): SpaceType => {
        if (uri.fullPath.startsWith(builtinSpacePathPrefix)) {
            return "default";
        }
        if (uri.scheme == "space") {
            return "folder";
        }
        if (uri.authority?.charAt(0) == "#") {
            return "tag";
        }
        if (uri.path.charAt(uri.path.length - 1) == "/") {
            if (uri.path == "/") return "vault";
            return "folder";
        }
        return "folder";
    };

    public async allCaches() {
        const caches = new Map<string, PathCache>();
        const keys = this.primarySpaceAdapter.allCaches().keys();
        for (const key of keys) {
            const cache = await this.readPathCache(key);
            caches.set(key, cache);
        }
        return caches;
    }
    public keysForCacheType(type: string) {
        return this.primarySpaceAdapter.keysForCacheType(type);
    }
    public pathExists(path: string) {
        return this.primarySpaceAdapter.pathExists(path);
    }
    public addSpaceAdapter(spaceAdapter: SpaceAdapter, primary?: boolean) {
        spaceAdapter.initiateAdapter(this);
        if (primary) this.primarySpaceAdapter = spaceAdapter;

        this.spaceAdapters.push(spaceAdapter);
    }

    public adapterForPath(path: string) {
        const uri = this.uriByString(path);
        if (!uri) return this.primarySpaceAdapter;
        return this.spaceAdapters.find((f) => f.schemes.includes(uri.scheme)) ?? this.primarySpaceAdapter;
    }
    //basic space operations
    public createSpace(name: string, parentPath: string, definition: SpaceDefinition) {
        return this.adapterForPath(parentPath).createSpace(name, parentPath, definition);
    }
    public saveSpace(path: string, definition: (def: SpaceDefinition) => SpaceDefinition, properties?: Record<string, any>) {
        return this.adapterForPath(path).saveSpace(path, definition, properties);
    }
    public renameSpace(path: string, newPath: string) {
        return this.adapterForPath(path).renameSpace(path, newPath);
    }
    public deleteSpace(path: string) {
        return this.adapterForPath(path).deleteSpace(path);
    }
    public loadPath(path: string) {
        return this.adapterForPath(path).loadPath(path);
    }
    public childrenForSpace(path: string) {
        return this.adapterForPath(path).childrenForSpace(path);
    }
    public spaceInitiated(path: string) {
        return this.adapterForPath(path).spaceInitiated(path);
    }
    //basic item operations
    public allPaths(type?: string[]) {
        return this.spaceAdapters.flatMap((f) => f.allPaths(type));
    }
    public createItemAtPath(parent: string, type: string, name: string, content?: any): Promise<string> {
        return this.adapterForPath(parent).createItemAtPath(parent, type, name, content);
    }
    public renamePath(oldPath: string, newPath: string) {
        return this.adapterForPath(oldPath).renamePath(oldPath, newPath);
    }
    public copyPath(source: string, destination: string, newName?: string) {
        return this.adapterForPath(source).copyPath(source, destination, newName);
    }
    public getPathInfo(path: string) {
        return this.adapterForPath(path).getPathInfo(path);
    }
    public deletePath(path: string) {
        return this.adapterForPath(path).deletePath(path);
    }
    public readPath(path: string) {
        return this.adapterForPath(path).readPath(path);
    }

    public writeToPath(path: string, content: any, binary?: boolean) {
        return this.adapterForPath(path).writeToPath(path, content, binary);
    }
    public parentPathForPath(path: string) {
        return this.adapterForPath(path).parentPathForPath(path);
    }

    public async readPathCache(path: string) {
        const pathCache = await this.adapterForPath(path).readPathCache(path);
        if (pathCache && pathCache.type == "space") {
            const defPath = this.spaceInfoForPath(path).defPath;

            if (defPath && (await this.pathExists(defPath))) {
                pathCache.label = { ...pathCache.label, ...(await this.readLabel(defPath)) };
                pathCache.property = await this.readProperties(defPath);
            }
        }
        return pathCache;
    }

    public allSpaces(hidden?: boolean) {
        return this.primarySpaceAdapter.allSpaces(hidden);
    }

    //Local SpaceInfo for Path
    public spaceInfoForPath(path: string) {
        return this.adapterForPath(path).spaceInfoForPath(path);
    }
    public spaceDefForSpace(path: string) {
        return this.adapterForPath(path).spaceDefForSpace(path);
    }

    public readLabel(path: string) {
        return this.adapterForPath(path).readLabel(path);
    }
    public saveLabel(path: string, key: string, value: any) {
        return this.adapterForPath(path).saveLabel(path, key, value);
    }
    public addProperty(path: string, property: SpaceProperty) {
        return this.adapterForPath(path).addProperty(path, property);
    }
    public saveProperties(path: string, properties: { [key: string]: any }) {
        if (!path) return;
        return this.adapterForPath(path).saveProperties(path, properties);
    }
    public readProperties(path: string) {
        return this.adapterForPath(path).readProperties(path);
    }
    public renameProperty(path: string, property: string, newProperty: string) {
        return this.adapterForPath(path).renameProperty(path, property, newProperty);
    }
    public deleteProperty(path: string, property: string) {
        return this.adapterForPath(path).deleteProperty(path, property);
    }


    public addTag(path: string, tag: string) {
        return this.adapterForPath(path).addTag(path, tag);
    }

    public deleteTag(path: string, tag: string) {
        return this.adapterForPath(path).deleteTag(path, tag);
    }

    public renameTag(path: string, tag: string, newTag: string) {
        return this.adapterForPath(path).renameTag(path, tag, newTag);
    }
    public readTags() {
        return this.primarySpaceAdapter.readTags();
    }
    public pathsForTag(tag: string) {
        return this.primarySpaceAdapter.pathsForTag(tag);
    }
    public childrenForPath(path: string, type?: string) {
        return this.adapterForPath(path).childrenForPath(path, type);
    }
    public readFocuses() {
        return this.primarySpaceAdapter.readFocuses();
    }
    public saveFocuses(focuses: Focus[]) {
        this.superstate.focuses = focuses;
        this.superstate.dispatchEvent("focusesChanged", null);
        return this.primarySpaceAdapter.saveFocuses(focuses);
    }
}
