import { resolvePath } from "core/utils/superstate/path";
import { Focus } from "shared/types/focus";
import { URI } from "shared/types/path";
import { SpaceDefinition } from "shared/types/spaceDef";
import { SpaceType } from "shared/types/PathState";
import { SpaceAdapter, ISpaceManager } from "shared/types/spaceManager";
import { ISuperstate } from "shared/types/superstate";
import { parseURI } from "utils/uri";
import { PathCache } from "shared/types/PathState";

export class SpaceManager implements ISpaceManager {
    public primarySpaceAdapter: SpaceAdapter;
    public spaceAdapters: SpaceAdapter[] = [];
    public superstate: ISuperstate;

    public onSpaceUpdated(_path: string, _type: string) {
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
        await this.superstate.onPathDeleted(path);
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
        await this.superstate.onPathDeleted(path);
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
        if (uri.authority?.charAt(0) == "#")
            return "tag";
        if (uri.path == "/")
            return "vault";
        if (uri.path.charAt(uri.path.length - 1) == "/")
            return "folder";
        return "folder";
    };

    public async allCaches() {
        const caches = new Map<string, PathCache>();
        const keys = new Set([...this.primarySpaceAdapter.allCaches().keys(), ...this.allPaths(undefined, true)]);
        for (const key of keys) {
            const cache = await this.readPathCache(key);
            if (cache) caches.set(key, cache);
        }
        return caches;
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
    public saveSpace(path: string, definition: (def: SpaceDefinition) => SpaceDefinition) {
        return this.adapterForPath(path).saveSpace(path, definition);
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
    public allPaths(type?: string[], hidden?: boolean) {
        return this.spaceAdapters.flatMap((f) => f.allPaths(type, hidden));
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
        return pathCache;
    }

    public allSpaces(hidden?: boolean) {
        return this.primarySpaceAdapter.allSpaces(hidden);
    }

    // Local
    public spaceInfoForPath(path: string) {
        return this.adapterForPath(path).spaceInfoForPath(path);
    }
    public spaceDefinitionForPath(path: string) {
        return this.adapterForPath(path).spaceDefinitionForPath(path);
    }

    public readProperties(path: string) {
        return this.adapterForPath(path).readProperties(path);
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
