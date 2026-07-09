import { PathState, WorkerJobType } from "shared/types/PathState";

export const serializePathState = (pathState: PathState) => {
    const { color: _color, sticker: _sticker, spaces: _spaces, linkedSpaces: _linkedSpaces, pinnedSpaces: _pinnedSpaces, ...stateForStore } = pathState;
    const metadata = stateForStore.metadata ?? {};
    return JSON.stringify({
        ...stateForStore,
        metadata,
    });
};

export const stringifyJob = (job: WorkerJobType) => `${job.type}:${job.path}`;
