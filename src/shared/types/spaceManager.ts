import { IAPI } from "shared/types/api";
import { Focus } from "shared/types/focus";
import { URI } from "shared/types/path";
import { PathCache } from "./PathState";
import { SpaceDefinition } from "./spaceDef";
import { SpaceFragmentType } from "./spaceFragment";
import { SpaceState, SpaceType } from "./PathState";
import { ISuperstate, PathState } from "./superstate";

export interface ISpaceManager {
    primarySpaceAdapter: SpaceAdapter;
    spaceAdapters: SpaceAdapter[];
    superstate: ISuperstate;
    api: IAPI;
    getPathState: (path: string) => PathState;
    getPathsIndexMap: () => Map<string, PathState>;
    loadPath: (path: string) => Promise<PathCache | void>;
    onSpaceUpdated(path: string, type: SpaceFragmentType): void;
    onFocusesUpdated(): void;
    onPathCreated(path: string): Promise<void>;
    onPathDeleted(path: string): Promise<void>;
    onPathChanged(path: string, oldPath: string): Promise<void>;
    onSpaceCreated(path: string): Promise<void>;
    onSpaceRenamed(path: string, oldPath: string): Promise<void>;
    onSpaceDeleted(path: string): Promise<void>;
    onPathPropertyChanged(path: string): Promise<void>;
    resolvePath(path: string, source?: string): string;
    uriByString(uri: string, source?: string): URI;
    spaceTypeByString(uri: URI): SpaceType;
    allCaches(): Promise<Map<string, PathCache>>;
    keysForCacheType(type: string): string[];
    pathExists(path: string): Promise<boolean>;
    addSpaceAdapter(spaceAdapter: SpaceAdapter, primary?: boolean): void;
    adapterForPath(path: string): SpaceAdapter;
    createSpace(name: string, parentPath: string, definition: SpaceDefinition): void;
    saveSpace(path: string, definition: (def: SpaceDefinition) => SpaceDefinition, properties?: Record<string, any>): void;
    renameSpace(path: string, newPath: string): Promise<string>;
    deleteSpace(path: string): void;
    childrenForSpace(path: string): string[];
    spaceInitiated(path: string): Promise<boolean>;
    allPaths(type?: string[], hidden?: boolean): string[];
    createItemAtPath(parent: string, type: string, name: string, content?: any): Promise<string>;
    renamePath(oldPath: string, newPath: string): Promise<string>;
    copyPath(source: string, destination: string, newName?: string): Promise<string>;
    getPathInfo(path: string): Promise<Record<string, any>>;
    deletePath(path: string): void;
    readPath(path: string): Promise<string>;
    writeToPath(path: string, content: any, binary?: boolean): Promise<void>;
    parentPathForPath(path: string): string;
    readPathCache(path: string): Promise<PathCache>;
    allSpaces(): SpaceState[];
    spaceInfoForPath(path: string): SpaceState;
    spaceDefinitionForPath(path: string): Promise<SpaceDefinition>;
    readProperties(path: string): Promise<{ [key: string]: any }>;
    readTags(): string[];
    pathsForTag(tag: string): string[];
    childrenForPath(path: string, type?: string): Promise<string[]>;
    readFocuses(): Promise<Focus[]>;
    saveFocuses(focuses: Focus[]): Promise<void>;
}
//Space Manager creates an abstraction that manipulates Spaces and their Items
//Works both on local systems, non-local systems, ACLed systems and cloud systems

export abstract class SpaceAdapter {
    //authorities that this cosmoform supports
    public schemes: string[];
    public loadPath: (path: string) => Promise<PathCache | void>;
    public initiateAdapter: (manager: ISpaceManager) => void;
    //basic space operations
    public spaceInfoForPath: (path: string) => SpaceState;
    public spaceDefinitionForPath: (path: string) => Promise<SpaceDefinition>;
    public parentPathForPath: (path: string) => string;
    public createSpace: (name: string, parentPath: string, definition: SpaceDefinition) => void;
    public saveSpace: (path: string, definitionFn: (def: SpaceDefinition) => SpaceDefinition, properties?: Record<string, any>) => void;
    public renameSpace: (path: string, newPath: string) => Promise<string>;
    public deleteSpace: (path: string) => void;
    public childrenForSpace: (path: string) => string[];
    public allPaths: (type?: string[], hidden?: boolean) => string[];
    public keysForCacheType: (type: string) => string[];
    public spaceInitiated: (path: string) => Promise<boolean>;

    //Space Features
    //basic item operations
    public resolvePath: (path: string, source: string) => string;
    public pathExists: (path: string) => Promise<boolean>;
    public createItemAtPath: (parent: string, type: string, name: string, content: any) => Promise<string>;
    public renamePath: (oldPath: string, newPath: string) => Promise<string>;
    public copyPath: (source: string, destination: string, newName?: string) => Promise<string>;
    public getPathInfo: (path: string) => Promise<Record<string, any>>;
    public deletePath: (path: string) => void;
    public readPath: (path: string) => Promise<string>;

    public readPathCache: (path: string) => Promise<PathCache>;

    public writeToPath: (path: string, content: any, binary?: boolean) => Promise<void>;

    public allSpaces: (hidden?: boolean) => SpaceState[];
    public allCaches: () => Map<string, PathCache>;

    public readProperties: (path: string) => Promise<{ [key: string]: any }>;

    //tag management
    public readTags: () => string[];

    public pathsForTag: (tag: string) => string[];
    public childrenForPath: (path: string, type?: string) => Promise<string[]>;

    public readFocuses: () => Promise<Focus[]>;
    public saveFocuses: (focuses: Focus[]) => Promise<void>;
}
