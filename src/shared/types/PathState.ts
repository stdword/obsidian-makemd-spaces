import { PathLabel } from "./caches";
import { SpaceDefinition, SpaceType } from "./spaceDef";
import { SpaceInfo } from "./spaceInfo";

export type SuperstateEvent = {
    pathCreated: { path: string };
    pathChanged: { path: string; newPath: string };
    pathDeleted: { path: string };
    pathStateUpdated: { path: string };
    spaceChanged: { path: string; newPath: string };
    spaceDeleted: { path: string };
    spaceStateUpdated: { path: string };
    settingsChanged: null;
    focusesChanged: null;
    superstateUpdated: null;
    superstateReindex: null;
};
export type WorkerJobType = {
    type: string;
    path: string;
    payload?: { [key: string]: any };
};
export type SpaceState = {
    name: string;
    path: string;
    metadata?: SpaceDefinition;
    dependencies?: string[];
    space?: SpaceInfo;
    contexts?: string[];
    type: SpaceType;
    sortBy?: string;
    sortable?: boolean;

    properties?: Record<string, any>;
} & CacheState;

export type TagsCache = {
    tag: string;
    files: string[];
};

export type CacheState = {
    rank?: number;
};
//everything needed to construct the file
export type PathState = {
    //File System Metadata
    path: string;

    name?: string;
    parent?: string;
    type?: string;
    subtype?: string;
    label?: PathLabel;
    effectiveLabel?: PathLabel;
    metadata?: Record<string, any>;
    properties?: Record<string, any>;
    hidden?: boolean;
    spaces?: string[];
    linkedSpaces?: string[];
    liveSpaces?: string[];
    tags?: string[];
    inlinks?: string[];
    outlinks?: string[];
    spaceNames?: string[];
} & CacheState;
