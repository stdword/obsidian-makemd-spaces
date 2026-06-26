import { PathState, WorkerJobType } from "shared/types/PathState";

export const serializePathState = (pathState: PathState) => {
    const { effectiveLabel: _effectiveLabel, label: _label, ...stateForStore } = pathState;
    const { label: _metadataLabel, ...metadata } = stateForStore.metadata ?? {};
    return JSON.stringify({
        ...stateForStore,
        metadata,
    });
};

export const stringifyJob = (job: WorkerJobType) => `${job.type}:${job.path}`;
