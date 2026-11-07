jest.mock("core/superstate/workers/indexer/impl", () => ({
    parsePath: jest.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'tags')");
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
        await onmessage({ data: { job, payload: {} } });

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
});
