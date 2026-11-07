import { readFileSync } from "fs";
import { getDB, readDBFile, saveDBFile } from "adapters/mdb/db/db";

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

const makeStorage = (files: Record<string, ArrayBuffer>, folders: string[] = []) => {
    const writeBinaryToFile = jest.fn((path: string, buffer: ArrayBuffer) => {
        files[path] = buffer;
        return Promise.resolve();
    });
    const createFolder = jest.fn((path: string) => {
        folders.push(path);
        return Promise.resolve(null);
    });
    return {
        storage: {
            plugin: {},
            sqlJS: jest.fn(),
            middleware: {
                fileExists: jest.fn((path: string) => Promise.resolve(path in files || folders.includes(path))),
                readBinaryToFile: jest.fn((path: string) => Promise.resolve(files[path])),
                writeBinaryToFile,
                createFolder,
            },
        } as any,
        writeBinaryToFile,
        createFolder,
    };
};

describe("sqlite cache file", () => {
    it("writes the exported database bytes as-is", async () => {
        const files: Record<string, ArrayBuffer> = {};
        const { storage, writeBinaryToFile, createFolder } = makeStorage(files, [".space"]);
        const exported = bytes(83, 81, 76, 105, 116, 101);

        await saveDBFile(storage, ".space/superstate.mdb", exported);

        expect(createFolder).not.toHaveBeenCalled();
        expect(writeBinaryToFile).toHaveBeenCalledWith(".space/superstate.mdb", exported);
        expect(new Uint8Array(files[".space/superstate.mdb"])).toEqual(new Uint8Array(exported));
    });

    it("creates the parent folder before the first save", async () => {
        const files: Record<string, ArrayBuffer> = {};
        const { storage, createFolder } = makeStorage(files);

        await saveDBFile(storage, ".space/superstate.mdb", bytes(1));

        expect(createFolder).toHaveBeenCalledWith(".space");
    });

    it("reads the raw file back and returns null when it does not exist", async () => {
        const stored = bytes(1, 2, 3);
        const { storage } = makeStorage({ ".space/superstate.mdb": stored });

        await expect(readDBFile(storage, ".space/superstate.mdb")).resolves.toBe(stored);
        await expect(readDBFile(storage, ".space/missing.mdb")).resolves.toBeNull();
    });

    it("opens the stored bytes as a database and falls back to an empty one when unreadable", async () => {
        const stored = bytes(9, 9, 9);
        const { storage } = makeStorage({ ".space/superstate.mdb": stored });
        const exec = jest.fn();
        const Database = jest.fn(function (this: any, data?: Uint8Array) {
            this.data = data;
            this.exec = data ? exec : jest.fn();
        });
        const sqlJS = { Database } as any;

        const db = (await getDB(storage, sqlJS, ".space/superstate.mdb")) as any;
        expect(Array.from(db.data)).toEqual([9, 9, 9]);
        expect(exec).toHaveBeenCalledWith("SELECT name FROM sqlite_schema");

        exec.mockImplementation(() => {
            throw new Error("file is not a database");
        });
        const fallback = (await getDB(storage, sqlJS, ".space/superstate.mdb")) as any;
        expect(fallback.data).toBeUndefined();

        const fresh = (await getDB(storage, sqlJS, ".space/none.mdb")) as any;
        expect(fresh.data).toBeUndefined();
    });

    it("no longer depends on jszip and names the cache file superstate.mdb", () => {
        expect(readFileSync("src/adapters/mdb/db/db.ts", "utf8")).not.toMatch(/jszip/i);
        expect(readFileSync("package.json", "utf8")).not.toMatch(/"jszip"/);
        expect(readFileSync("src/adapters/obsidian/filesystem/filesystem.ts", "utf8")).toContain('stateFileName = "superstate.mdb"');
    });
});
