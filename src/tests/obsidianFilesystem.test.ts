jest.mock("main", () => jest.fn());
jest.mock(
    "obsidian",
    () => ({
        normalizePath: (path: string) => path,
        TFile: class TFile {},
        TFolder: class TFolder {},
    }),
    { virtual: true },
);

import { ObsidianFileSystem } from "adapters/obsidian/filesystem/filesystem";
import { fileNameWithExtension, fileNameWithSameSuffix, tFileToAFile, uniqueFileName } from "adapters/obsidian/utils/file";
import { TFile } from "obsidian";

const createFilesystem = (paths: Record<string, { type: "file" | "folder" }>) => {
    const filesystem = Object.create(ObsidianFileSystem.prototype) as ObsidianFileSystem;
    (filesystem as any).plugin = {
        app: {
            metadataCache: {
                getFirstLinkpathDest: jest.fn(),
            },
            vault: {
                getAbstractFileByPath: jest.fn((): null => null),
                adapter: {
                    exists: jest.fn((path: string) => Promise.resolve(path in paths)),
                    stat: jest.fn((path: string) => Promise.resolve(paths[path] ?? null)),
                },
            },
        },
    };
    return filesystem;
};

describe("ObsidianFileSystem.getFile", () => {
    it("treats excalidraw as the extension for .excalidraw.md files only", async () => {
        const filesystem = createFilesystem({
            "Drawings/Sketch.excalidraw.md": { type: "file" },
            "Archives/archive.tar.gz": { type: "file" },
        });

        await expect(filesystem.getFile("Drawings/Sketch.excalidraw.md")).resolves.toMatchObject({
            name: "Sketch",
            filename: "Sketch.excalidraw.md",
            extension: "excalidraw",
        });
        await expect(filesystem.getFile("Archives/archive.tar.gz")).resolves.toMatchObject({
            name: "archive.tar",
            filename: "archive.tar.gz",
            extension: "gz",
        });
    });
});

describe("ObsidianFileSystem.copyFile", () => {
    const createCopyFilesystem = (paths: Record<string, { type: "file" | "folder" }>, copies: Record<string, TFile>) => {
        const filesystem = Object.create(ObsidianFileSystem.prototype) as ObsidianFileSystem;
        filesystem.cache = new Map();
        const copy = jest.fn((source: string, destination: string) => {
            if (destination in paths) return Promise.reject(new Error("File already exists"));
            paths[destination] = { type: "file" };
            return Promise.resolve();
        });
        (filesystem as any).plugin = {
            app: {
                metadataCache: {
                    getFirstLinkpathDest: jest.fn(),
                },
                vault: {
                    getAbstractFileByPath: jest.fn((path: string) => copies[path] ?? null),
                    adapter: {
                        exists: jest.fn((path: string) => Promise.resolve(path in paths)),
                        stat: jest.fn((path: string) => Promise.resolve(paths[path] ?? null)),
                        list: jest.fn((folder: string) =>
                            Promise.resolve({
                                files: Object.keys(paths).filter((p) => paths[p].type == "file" && p.startsWith(folder + "/")),
                                folders: Object.keys(paths).filter((p) => paths[p].type == "folder" && p.startsWith(folder + "/")),
                            }),
                        ),
                        copy,
                    },
                },
            },
        };
        return { filesystem, copy };
    };

    const tFile = (path: string, basename: string, extension: string): TFile =>
        Object.assign(new TFile(), {
            basename,
            extension,
            name: path.split("/").pop(),
            path,
            parent: { path: path.split("/").slice(0, -1).join("/") },
            stat: { ctime: 1, mtime: 2, size: 3 },
        });

    it("duplicates excalidraw files next to the original", async () => {
        const { filesystem, copy } = createCopyFilesystem(
            {
                Drawings: { type: "folder" },
                "Drawings/Sketch.excalidraw.md": { type: "file" },
            },
            {
                "Drawings/Sketch1.excalidraw.md": tFile("Drawings/Sketch1.excalidraw.md", "Sketch1.excalidraw", "md"),
            },
        );

        await expect(filesystem.copyFile("Drawings/Sketch.excalidraw.md", "Drawings", "Sketch")).resolves.toBe("Drawings/Sketch1.excalidraw.md");
        expect(copy).toHaveBeenCalledWith("Drawings/Sketch.excalidraw.md", "Drawings/Sketch1.excalidraw.md");
    });

    it("preserves the .excalidraw suffix when duplicating legacy Excalidraw files", async () => {
        const { filesystem, copy } = createCopyFilesystem(
            {
                Drawings: { type: "folder" },
                "Drawings/Sketch.excalidraw": { type: "file" },
            },
            {
                "Drawings/Sketch1.excalidraw": tFile("Drawings/Sketch1.excalidraw", "Sketch1", "excalidraw"),
            },
        );

        await expect(filesystem.copyFile("Drawings/Sketch.excalidraw", "Drawings", "Sketch")).resolves.toBe("Drawings/Sketch1.excalidraw");
        expect(copy).toHaveBeenCalledWith("Drawings/Sketch.excalidraw", "Drawings/Sketch1.excalidraw");
    });

    it("duplicates non-standard files next to the original", async () => {
        const { filesystem, copy } = createCopyFilesystem(
            {
                Files: { type: "folder" },
                "Files/archive.tar.gz": { type: "file" },
            },
            {
                "Files/archive.tar1.gz": tFile("Files/archive.tar1.gz", "archive.tar1", "gz"),
            },
        );

        await expect(filesystem.copyFile("Files/archive.tar.gz", "Files", "archive.tar")).resolves.toBe("Files/archive.tar1.gz");
        expect(copy).toHaveBeenCalledWith("Files/archive.tar.gz", "Files/archive.tar1.gz");
    });
});

describe("ObsidianFileSystem cache", () => {
    it("keeps file metadata in memory without a persistent file cache", () => {
        const filesystem = Object.create(ObsidianFileSystem.prototype) as ObsidianFileSystem;
        filesystem.cache = new Map();
        filesystem.middleware = {
            eventDispatch: {
                dispatchEvent: jest.fn(),
            },
        } as any;

        expect(() =>
            filesystem.updateFileCache(
                "Note.md",
                {
                    tags: ["#test"],
                },
                false,
            ),
        ).not.toThrow();
        expect(filesystem.getFileCache("Note.md")).toMatchObject({
            tags: ["#test"],
        });
    });

    it("only defines the superstate storage filename", () => {
        expect(Object.keys(ObsidianFileSystem)).toEqual(["stateFileName"]);
    });
});

describe("tFileToAFile", () => {
    it("normalizes Obsidian TFile metadata for .excalidraw.md files only", () => {
        const excalidrawFile = Object.assign(new TFile(), {
            basename: "Sketch.excalidraw",
            extension: "md",
            name: "Sketch.excalidraw.md",
            path: "Drawings/Sketch.excalidraw.md",
            parent: { path: "Drawings" },
            stat: { ctime: 1, mtime: 2, size: 3 },
        });
        const archiveFile = Object.assign(new TFile(), {
            basename: "archive.tar",
            extension: "gz",
            name: "archive.tar.gz",
            path: "Archives/archive.tar.gz",
            parent: { path: "Archives" },
            stat: { ctime: 1, mtime: 2, size: 3 },
        });

        expect(tFileToAFile(excalidrawFile)).toMatchObject({
            name: "Sketch",
            filename: "Sketch.excalidraw.md",
            extension: "excalidraw",
        });
        expect(tFileToAFile(archiveFile)).toMatchObject({
            name: "archive.tar",
            filename: "archive.tar.gz",
            extension: "gz",
        });
    });
});

describe("file names with extensions", () => {
    it("keeps .excalidraw.md as the physical suffix for excalidraw files only", () => {
        expect(fileNameWithExtension("Sketch", "excalidraw")).toBe("Sketch.excalidraw.md");
        expect(fileNameWithExtension("archive.tar", "gz")).toBe("archive.tar.gz");
        expect(fileNameWithExtension("README", "")).toBe("README");
    });

    it("preserves the original physical suffix when creating a copy name", () => {
        expect(fileNameWithSameSuffix("Sketch copy", "Sketch.excalidraw")).toBe("Sketch copy.excalidraw");
        expect(fileNameWithSameSuffix("Sketch copy", "Sketch.excalidraw.md")).toBe("Sketch copy.excalidraw.md");
    });

    it("uses the physical excalidraw suffix when generating unique file names", () => {
        const folder = {
            children: [
                {
                    name: "Sketch.excalidraw.md",
                },
            ],
        };

        expect(uniqueFileName("Other.excalidraw.md", "Sketch", "excalidraw", folder as any)).toBe("Sketch 1.excalidraw.md");
    });
});
