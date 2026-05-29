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
import { fileNameWithExtension, tFileToAFile, uniqueFileName } from "adapters/obsidian/utils/file";
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
