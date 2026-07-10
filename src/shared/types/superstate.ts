import { LocalCachePersister } from "shared/types/persister";

import { MakeMDSettings } from "shared/types/settings";
import { EventDispatcher } from "utils/dispatcher";
import { IAPI } from "./api";
import { Focus } from "./focus";
import { IndexMap } from "./indexMap";
import { PathState, SpaceState, SuperstateEvent } from "./PathState";
import { SpaceDefinition } from "./spaceDef";
import { ISpaceManager } from "./spaceManager";
import { IUIManager } from "./uiManager";

export type { PathState, SpaceState, SuperstateEvent };

export abstract class ISuperstate {
    initialized: boolean;
    eventsDispatcher: EventDispatcher<SuperstateEvent>;
    spaceManager: ISpaceManager;
    settings: MakeMDSettings;
    onSpaceDefinitionChanged: (space: SpaceState, metadata?: SpaceDefinition) => Promise<void>;
    saveSettings: () => Promise<void>;
    api: IAPI;
    ui: IUIManager;
    pathsIndex: Map<string, PathState>;
    spacesIndex: Map<string, SpaceState>;
    spacesMap: IndexMap;
    tagsMap: IndexMap;
    liveSpaceLinkMap: IndexMap;
    focuses: Focus[];
    persister: LocalCachePersister;

    initializeIndex: () => Promise<void>;
    unload: () => void;
    initialize: () => Promise<void>;
    initializePaths: () => Promise<void>;
    initializeSpaces: () => Promise<void>;
    getSpaceItems: (spacePath: string, filesOnly?: boolean) => PathStateWithRank[];
    pathStateForPath: (path: string) => PathState;
    loadFromCache: () => Promise<void>;
    dispatchEvent: (event: keyof SuperstateEvent, payload: any) => void;
    initializeTags: () => Promise<void>;
    onTagRenamed: (tag: string, newTag: string) => Promise<void>;
    onTagDeleted: (tag: string) => Promise<void>;
    deleteTagInPath: (tag: string, path: string) => Promise<void>;
    onMetadataChange: (path: string) => Promise<void>;
    reloadSpaceByPath: (path: string, metadata?: SpaceDefinition) => Promise<SpaceState>;
    onPathRename: (oldPath: string, newPath: string) => Promise<void>;
    onPathCreated: (path: string) => Promise<void>;
    onPathDeleted: (path: string) => Promise<void>;
    onSpaceRenamed: (oldPath: string, newSpaceInfo: SpaceState) => Promise<void>;
    onSpaceDeleted: (space: string) => void;
    allSpaces: (ordered?: boolean, hidden?: boolean) => SpaceState[];
    spaceOrder: () => string[];
    updateSpaceMetadata: (spacePath: string, metadata: SpaceDefinition) => Promise<SpaceState>;
    reloadSpace: (space: SpaceState, spaceMetadata?: SpaceDefinition, initialized?: boolean) => Promise<SpaceState>;
    reloadPath: (path: string, force?: boolean) => Promise<boolean>;
    onPathReloaded: (path: string) => Promise<boolean>;
}

export type PathStateWithRank = PathState & { rank?: number };
