import { indexAllPaths, parseAllContexts, parseAllPaths, parseContext, parsePath } from "./impl";
const ctx: Worker = self as any;

ctx.onmessage = async evt => {
    const { payload, job } = evt.data;
        let result;
        if (job.type == 'path') {
            result = parsePath(payload);
        } else if (job.type == 'context') {
            result = parseContext(payload)
        } else if (job.type == 'contexts') {
            result = parseAllContexts(payload)
        } else if (job.type == 'paths') {
            result = parseAllPaths(payload)
        } else if (job.type == 'index') {
            result = indexAllPaths(payload);
        }
    try {
        (postMessage as any)({ job, result });
    } catch (error) {
        (postMessage as any)({
            job,
            result: {
                $error: `Failed to index ${job.type} ${job.path}: ${error}`,
            },
        });
    }
};
