import { stringifyJob } from "core/utils/superstate/serializer";
import { Superstate } from "makemd-core";
import { WorkerJobType } from "shared/types/PathState";
import { BatchPathWorkerPayload, PathWorkerPayload } from "./impl";
//@ts-ignore
import SuperstateWorker from "./indexer.worker";
/** Callback when a file is resolved. */
type FileCallback = (p: any) => void;

const mapSummary = (map: Map<string, any>, sampleSize = 5) => ({
    size: map?.size ?? 0,
    sampleKeys: map ? [...map.keys()].slice(0, sampleSize) : [],
});

const valueKeys = (value: any) => (value && typeof value == "object" ? Object.keys(value) : []);

const payloadSummary = (payload: any) => ({
    settingsKeys: valueKeys(payload?.settings),
    spacesCache: payload?.spacesCache instanceof Map ? mapSummary(payload.spacesCache) : undefined,
    pathCache: payload?.pathCache instanceof Map ? mapSummary(payload.pathCache) : undefined,
    pathsIndex: payload?.pathsIndex instanceof Map ? mapSummary(payload.pathsIndex) : undefined,
    oldMetadata: payload?.oldMetadata instanceof Map ? mapSummary(payload.oldMetadata) : valueKeys(payload?.oldMetadata),
    pathMetadataKeys: valueKeys(payload?.pathMetadata),
    pathMetadataFileKeys: valueKeys(payload?.pathMetadata?.file),
    name: payload?.name,
    parent: payload?.parent,
    type: payload?.type,
    subtype: payload?.subtype,
});

/** Multi-threaded file parser which debounces rapid file requests automatically. */
export class Indexer {
    /* Background workers which do the actual file parsing. */
    workers: Worker[];
    /** Tracks which workers are actively parsing a file, to make sure we properly delegate results. */
    busy: boolean[];
    /** List of files which have been queued for a reload. */
    reloadQueue: WorkerJobType[];
    /** Fast-access set which holds the list of files queued to be reloaded; used for debouncing. */
    reloadSet: Set<string>;
    /** Paths -> promises for file reloads which have not yet been queued. */
    callbacks: Map<string, [FileCallback, FileCallback][]>;
    private jobStarts: Map<string, number>;
    /** Job currently running on each worker, so a worker crash can reject the right promise. */
    private activeJobs: Map<number, WorkerJobType>;

    public constructor(
        public numWorkers: number,
        public cache: Superstate,
    ) {
        this.workers = [];
        this.busy = [];

        this.reloadQueue = [];
        this.reloadSet = new Set();
        this.callbacks = new Map();
        this.jobStarts = new Map();
        this.activeJobs = new Map();

        for (let index = 0; index < numWorkers; index++) {
            const worker = new SuperstateWorker({ name: "Superstate Indexer " + (index + 1) });

            worker.onmessage = (evt: Partial<any>) => this.finish(evt.data.job, evt.data.result, index);
            // An uncaught exception or an unserializable message never produces onmessage; without
            // these the worker would stay busy forever and every reload of its job would hang.
            worker.onerror = (evt: Partial<ErrorEvent>) => this.failWorker(index, `Indexer worker crashed: ${evt?.message ?? evt?.error ?? "unknown error"}`);
            worker.onmessageerror = () => this.failWorker(index, "Indexer worker received an unreadable message");
            this.workers.push(worker);
            // this.register(() => worker.terminate());
            this.busy.push(false);
        }
    }

    /**
     * Queue the given file for reloading. Multiple reload requests for the same file in a short time period will be de-bounced
     * and all be resolved by a single actual file reload.
     */
    public reload<T>(jerb: WorkerJobType): Promise<T> {
        const jobKey = stringifyJob(jerb);
        const promise: Promise<T> = new Promise((resolve, reject) => {
            if (this.callbacks.has(jobKey)) this.callbacks.get(jobKey)?.push([resolve, reject]);
            else this.callbacks.set(jobKey, [[resolve, reject]]);
        });
        // De-bounce repeated requests for the same file.
        if (this.reloadSet.has(jobKey)) {
            return promise;
        }
        this.reloadSet.add(jobKey);

        // Immediately run this task if there are available workers; otherwise, add it to the queue.
        const workerId = this.nextAvailableWorker();
        if (workerId !== undefined) {
            this.start(jerb, workerId);
        } else {
            this.reloadQueue.push(jerb);
        }

        return promise;
    }

    /** Reject whatever job the worker was running and hand it the next queued one. */
    private failWorker(index: number, message: string) {
        const job = this.activeJobs.get(index);
        if (job) {
            this.finish(job, { $error: message }, index);
            return;
        }
        this.busy[index] = false;
        const next = this.reloadQueue.shift();
        if (next !== undefined) this.start(next, index);
    }

    /** Finish the parsing of a file, potentially queueing a new file. */
    private finish(jerb: WorkerJobType, data: any, index: number) {
        const jobKey = stringifyJob(jerb);
        this.activeJobs.delete(index);
        const elapsedMs = this.jobStarts.has(jobKey) ? Date.now() - this.jobStarts.get(jobKey) : undefined;
        this.jobStarts.delete(jobKey);
        // Cache the callbacks before we do book-keeping.
        const calls = ([] as [FileCallback, FileCallback][]).concat(this.callbacks.get(jobKey) ?? []);
        // Book-keeping to clear metadata & allow the file to be re-loaded again.
        this.reloadSet.delete(jobKey);
        this.callbacks.delete(jobKey);

        // Notify the queue this file is available for new work.
        this.busy[index] = false;

        // Queue a new job onto this worker.
        const job = this.reloadQueue.shift();
        if (job !== undefined) this.start(job, index);

        // Resolve promises to let users know this file has finished.
        const result = data ?? { $error: `Indexer returned no result for ${jobKey}` };
        if (typeof result == "object" && "$error" in result) {
            for (const [_, reject] of calls) reject(result["$error"]);
        } else {
            for (const [callback, _] of calls) callback(result);
        }
    }

    private start(job: WorkerJobType, workerId: number) {
        const jobKey = stringifyJob(job);
        this.busy[workerId] = true;
        this.activeJobs.set(workerId, job);
        this.jobStarts.set(jobKey, Date.now());
        this.send(job, workerId).catch((error) => {
            this.finish(job, { $error: error }, workerId);
        });
    }

    /** Send a new task to the given worker ID. */
    private async send(job: WorkerJobType, workerId: number) {
        if (job.type == "paths") {
            const pathCaches = await this.cache.spaceManager.allCaches();
            const payload: BatchPathWorkerPayload = {
                settings: this.cache.settings,
                spacesCache: this.cache.spacesIndex,
                pathCache: pathCaches,
                oldMetadata: this.cache.pathsIndex,
            };
            this.message(workerId, {
                job,
                payload: payload,
            });
            return;
        }
        if (job.type == "path") {
            const spaceState = this.cache.spacesIndex.get(job.path);
            let cachePath = job.path;
            let name;
            if (spaceState) {
                name = spaceState.name;
                cachePath = spaceState.space.defPath;
            }
            const pathMetadata = (await this.cache.spaceManager.readPathCache(cachePath)) ?? (await this.cache.spaceManager.readPathCache(job.path));
            name = name ?? pathMetadata?.name;
            const parent = this.cache.spaceManager.parentPathForPath(job.path);
            const type = spaceState ? "space" : pathMetadata?.type;
            const subtype = spaceState ? spaceState.type : pathMetadata?.subtype;
            const payload: PathWorkerPayload = {
                path: job.path,
                settings: this.cache.settings,
                spacesCache: this.cache.spacesIndex,
                pathMetadata,
                name,
                parent,
                type,
                subtype,
                oldMetadata: this.cache.pathsIndex.get(job.path),
            };
            this.message(workerId, {
                job,
                payload: payload,
            });
            return;
        }
        if (job.type == "index") {
            const pathsIndex = this.cache.pathsIndex;
            this.message(workerId, {
                job,
                payload: {
                    pathsIndex,
                },
            });
            return;
        }
    }

    private message(workerId: number, message: { job: WorkerJobType; payload: any }) {
        this.workers[workerId].postMessage(message);
    }
    public terminate() {
        const error = new Error("Indexer terminated");
        for (const calls of this.callbacks.values()) {
            for (const [_, reject] of calls) {
                reject(error);
            }
        }
        this.callbacks.clear();
        this.reloadQueue = [];
        this.reloadSet.clear();
        this.jobStarts.clear();
        this.activeJobs.clear();
        this.busy = this.busy.map(() => false);
        this.workers.forEach((worker) => worker.terminate());
    }
    /** Find the next available, non-busy worker; return undefined if all workers are busy. */
    private nextAvailableWorker(): number | undefined {
        const index = this.busy.indexOf(false);
        return index == -1 ? undefined : index;
    }
}
