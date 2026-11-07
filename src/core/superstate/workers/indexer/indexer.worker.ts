import { indexAllPaths, parseAllPaths, parsePath } from "./impl";
const ctx: Worker = self as any;

const describeError = (error: unknown) => (error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error));

// Every message must get a reply: the main thread keeps the worker marked busy until it hears
// back, so a thrown exception here would otherwise hang that worker forever.
ctx.onmessage = async (evt) => {
    const { payload, job } = evt.data;
    try {
        let result;
        if (job.type == "path") {
            result = parsePath(payload);
        } else if (job.type == "paths") {
            result = parseAllPaths(payload);
        } else if (job.type == "index") {
            result = indexAllPaths(payload);
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
