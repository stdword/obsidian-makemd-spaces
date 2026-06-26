jest.mock("adapters/mdb/db/db", () => ({
    dbResultsToDBTables: jest.fn((): any[] => []),
    deleteFromDB: jest.fn(),
    getZippedDB: jest.fn(),
    insertIntoDB: jest.fn(),
    replaceDB: jest.fn(),
    saveZippedDBFile: jest.fn(),
    selectDB: jest.fn(),
}));

import { deleteFromDB, insertIntoDB } from "adapters/mdb/db/db";
import { LocalStorageCache } from "adapters/mdb/localCache/localCache";

describe("LocalStorageCache", () => {
    it("stores rows with an explicit empty version when requested", async () => {
        const cache = new LocalStorageCache("state", {} as any, ["space"]) as any;
        cache.initialized = true;
        const db = { export: jest.fn(() => ({ buffer: new ArrayBuffer(0) })) };
        cache.db = db;

        await cache.store("spaces://#project", "{}", "space", "");
        cache.debounceSaveSpaceDatabase.cancel();

        expect(insertIntoDB).toHaveBeenCalledWith(
            db,
            expect.objectContaining({
                space: expect.objectContaining({
                    rows: [{ path: "spaces://#project", cache: "{}", version: "" }],
                }),
            }),
            true,
        );
    });

    it("does not clean rows with an empty version", () => {
        const cache = new LocalStorageCache("state", {} as any, ["space"]) as any;
        cache.initialized = true;
        const db = { export: jest.fn(() => ({ buffer: new ArrayBuffer(0) })) };
        cache.db = db;
        cache.indexVersion = "current";

        cache.cleanType("space");

        expect(deleteFromDB).toHaveBeenCalledWith(db, "space", `version != 'current' AND version != ''`);
    });
});
