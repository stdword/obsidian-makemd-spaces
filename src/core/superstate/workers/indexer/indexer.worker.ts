import { SpaceState } from "shared/types/PathState";
import { parseAllPaths, parsePath } from "./impl";
const ctx: Worker = self as any;

// Mirror of the main thread's spacesIndex. Messages to a worker are delivered in order, so a
// "spaces" sync sent right before a job is always applied before that job runs.
let spacesMirror: Map<string, SpaceState> = new Map();

const describeError = (error: unknown) => (error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error));

// Every message must get a reply: the main thread keeps the worker marked busy until it hears
// back, so a thrown exception here would otherwise hang that worker forever.
ctx.onmessage = async (evt) => {
    const { payload, job } = evt.data;
    if (job.type == "spaces") {
        // Not a job: no reply, otherwise the main thread would treat it as a finished job.
        spacesMirror = payload.spacesCache ?? new Map();
        return;
    }
    try {
        let result;
        if (job.type == "path") {
            result = parsePath(payload, spacesMirror);
        } else if (job.type == "paths") {
            result = parseAllPaths(payload, spacesMirror);
        } else {
            throw new Error(`Unknown job type ${job.type}`);
        }
        (postMessage as any)({ job, result });
    } catch (error) {
        (postMessage as any)({
            job,
            result: {
                $error: `Failed to index ${job.type} ${job.path}: ${describeError(error)}`,
            },
        });
    }
};
