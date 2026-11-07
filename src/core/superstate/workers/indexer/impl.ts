

import { parseAllMetadata, parseMetadata } from "core/superstate/metadataParsing";
import { PathCache, PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";

export type PathWorkerPayload = {path: string, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>, pathMetadata: PathCache, name: string, type: string, subtype: string, parent: string, oldMetadata: PathState};
export type BatchPathWorkerPayload = {pathCache: Map<string, PathCache>, settings: MakeMDSettings, spacesCache: Map<string, SpaceState>,  oldMetadata: Map<string, PathState>};


export function parsePath (payload: PathWorkerPayload) {
    const {path, settings, spacesCache, pathMetadata, name, type, subtype, parent, oldMetadata} = payload;
    return parseMetadata(path, settings, spacesCache, pathMetadata, name, type, subtype, parent, oldMetadata);
}

export function parseAllPaths (payload: BatchPathWorkerPayload) {
    const {pathCache, settings, spacesCache, oldMetadata} = payload;
    return parseAllMetadata(pathCache, settings, spacesCache, oldMetadata);
}
