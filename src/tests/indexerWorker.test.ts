jest.mock("core/superstate/workers/indexer/impl", () => ({
    parsePath: jest.fn((payload: { path: string }, spaces: Map<string, unknown>) => {
        if (payload.path.endsWith("Broken.md")) throw new TypeError("Cannot read properties of undefined (reading 'tags')");
        return { spaces: [...spaces.keys()] };
    }),
    parseAllPaths: jest.fn(() => ({ ok: true })),
}));

describe("indexer worker", () => {
    const postMessage = jest.fn();
    let onmessage: (evt: { data: any }) => Promise<void> | void;

    beforeAll(async () => {
        (global as any).self = {};
        (global as any).postMessage = postMessage;
        await import("core/superstate/workers/indexer/indexer.worker");
        onmessage = (global as any).self.onmessage;
    });

    afterAll(() => {
        delete (global as any).self;
        delete (global as any).postMessage;
    });

    beforeEach(() => postMessage.mockClear());

    it("always answers, posting $error when parsing throws", async () => {
        const job = { type: "path", path: "Notes/Broken.md" };
        await onmessage({ data: { job, payload: { path: "Notes/Broken.md" } } });

        expect(postMessage).toHaveBeenCalledTimes(1);
        const message = postMessage.mock.calls[0][0];
        expect(message.job).toEqual(job);
        expect(message.result.$error).toContain("Notes/Broken.md");
        expect(message.result.$error).toContain("reading 'tags'");
    });

    it("posts the result for jobs that succeed", async () => {
        const job = { type: "paths", path: "" };
        await onmessage({ data: { job, payload: {} } });

        expect(postMessage).toHaveBeenCalledWith({ job, result: { ok: true } });
    });

    it("keeps the spaces mirror from a sync message, answers nothing to it, and parses paths against it", async () => {
        const spacesCache = new Map([["Projects", { path: "Projects" }]]);
        await onmessage({ data: { job: { type: "spaces", path: "" }, payload: { spacesCache } } });
        expect(postMessage).not.toHaveBeenCalled();

        const job = { type: "path", path: "Projects/Plan.md" };
        await onmessage({ data: { job, payload: { path: "Projects/Plan.md" } } });
        expect(postMessage).toHaveBeenCalledWith({ job, result: { spaces: ["Projects"] } });
    });
});
