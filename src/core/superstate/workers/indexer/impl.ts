

import { parseAllMetadata, parseMetadata } from "core/superstate/metadataParsing";
import { PathCache, PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";

// The spaces index is not part of job payloads: the worker keeps a mirror of it, refreshed
// by a "spaces" message only when the main-thread index changed (see Indexer.syncSpaces).
export type SpacesSyncPayload = { spacesCache: Map<string, SpaceState> };
export type PathWorkerPayload = {path: string, settings: MakeMDSettings, pathMetadata: PathCache, name: string, type: string, subtype: string, parent: string, oldMetadata: PathState};
export type BatchPathWorkerPayload = {pathCache: Map<string, PathCache>, settings: MakeMDSettings, oldMetadata: Map<string, PathState>};


export function parsePath (payload: PathWorkerPayload, spacesCache: Map<string, SpaceState>) {
    const {path, settings, pathMetadata, name, type, subtype, parent, oldMetadata} = payload;
    return parseMetadata(path, settings, spacesCache, pathMetadata, name, type, subtype, parent, oldMetadata);
}

export function parseAllPaths (payload: BatchPathWorkerPayload, spacesCache: Map<string, SpaceState>) {
    const {pathCache, settings, oldMetadata} = payload;
    return parseAllMetadata(pathCache, settings, spacesCache, oldMetadata);
}
