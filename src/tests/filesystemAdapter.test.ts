import { fileSystemSpaceInfoFromFolder, fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { FilesystemSpaceAdapter } from "core/spaceManager/filesystemAdapter/filesystemAdapter";
import { SPACE_DEF_DEFAULT_CONTENT } from "shared/constants";

describe("FilesystemSpaceAdapter", () => {
    const createAdapter = () => {
        const files = new Map<string, any>();
        const text = new Map<string, string>();
        const folders = new Set<string>();
        const parentForPath = (path: string) => {
            const index = path.lastIndexOf("/");
            return index == -1 ? "" : path.slice(0, index);
        };
        const fileSystem = {
            eventDispatch: {
                addListener: jest.fn(),
            },
            getFile: jest.fn(async (path: string) => files.get(path) ?? null),
            readTextFromFile: jest.fn(async (path: string) => text.get(path) ?? null),
            fileExists: jest.fn(async (path: string) => files.has(path) || folders.has(path)),
            childrenForFolder: jest.fn(async (path: string) => [
                ...[...files.keys()].filter((filePath) => parentForPath(filePath) == path),
                ...[...folders].filter((folderPath) => parentForPath(folderPath) == path),
            ]),
            createFolder: jest.fn(async (path: string) => {
                folders.add(path);
            }),
            deleteFile: jest.fn(async (path: string) => {
                files.delete(path);
                text.delete(path);
                folders.delete(path);
            }),
            newFile: jest.fn(async (folder: string, filename: string, extension: string, content: string) => {
                const path = folder ? `${folder}/${filename}.${extension}` : `${filename}.${extension}`;
                const file = { path };
                files.set(path, file);
                text.set(path, content);
                return file;
            }),
            saveFileFragment: jest.fn(async (file: { path: string }, _type: string, _id: string, save: (prev: any) => any) => {
                const prev = JSON.parse(text.get(file.path) ?? "{}");
                const next = save(prev);
                text.set(file.path, JSON.stringify(next, null, 2));
                return true;
            }),
        };
        const adapter = new FilesystemSpaceAdapter(fileSystem as any, ".obsidian/plugins/make-md-spaces") as any;
        adapter.spaceInfoForPath = jest.fn((path: string) => ({
            name: path.split("/").pop() || "Home",
            path,
            folderPath: path,
            defPath: path == "/" ? ".space/def.json" : `${path}/.space/def.json`,
            notePath: "",
        }));
        adapter.spaceManager = {
            onPathPropertyChanged: jest.fn(),
            onPathDeleted: jest.fn(),
            onSpaceDeleted: jest.fn(),
            superstate: {
                settings: {
                    defaultFoldersAtTop: true,
                    defaultSpaceSort: {
                        field: "name",
                        asc: true,
                    },
                },
                getSpaceItems: jest.fn(() => [
                    { path: "Projects/Alpha.md", name: "Alpha" },
                    { path: "Projects/Beta.md", name: "Beta" },
                ]),
            },
        };
        return { adapter, text, files, folders, fileSystem };
    };

    it("keeps nested Obsidian tag names intact when building tag spaces", () => {
        const manager = {
            superstate: {
                settings: {},
            },
            spaceInfoForPath: (path: string) => ({ path, name: path }),
            uriByString: jest.fn(),
            spaceTypeByString: jest.fn(),
        };

        const tagSpace = fileSystemSpaceInfoFromTag(manager as any, "#books/psy");

        expect(tagSpace.name).toBe("books/psy");
        expect(tagSpace.path).toBe("spaces://#books/psy");
        expect(tagSpace.folderPath).toBe("#books+psy");
    });

    it("uses the folder name for folder note paths without reading folder-note settings", () => {
        const manager = {
            superstate: {
                settings: {},
            },
        };

        const space = fileSystemSpaceInfoFromFolder(manager as any, "Projects/Alpha");

        expect(space.defPath).toBe("Projects/Alpha/.space/def.json");
        expect(space.notePath).toBe("Projects/Alpha/Alpha.md");
    });

    it("creates def.json default content without sort until sort is explicitly changed", () => {
        expect(JSON.parse(SPACE_DEF_DEFAULT_CONTENT())).toEqual({
            color: "",
            sticker: "",
            defaultColor: "",
            defaultSticker: "",
            "rank-order": [],
            links: [],
            pinned: [],
            "file-colors": {},
        });
    });

    it("does not write default sort when creating def.json for a sticker change", async () => {
        const { adapter, text } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, sticker: "ui//folder" }));

        expect(JSON.parse(text.get("Projects/.space/def.json"))).toEqual({
            color: "",
            sticker: "ui//folder",
            defaultColor: "",
            defaultSticker: "",
            "rank-order": [],
            links: [],
            pinned: [],
            "file-colors": {},
        });
    });

    it("does not create def.json while reading missing metadata", async () => {
        const { adapter, text } = createAdapter();

        const metadata = await adapter.spaceDefForSpace("Projects");

        expect(metadata.sort).toBeUndefined();
        expect(text.has("Projects/.space/def.json")).toBe(false);
    });

    it("writes only the changed sort fragment when creating def.json for a sort change", async () => {
        const { adapter, text } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, sort: { group: true } }));

        expect(JSON.parse(text.get("Projects/.space/def.json")).sort).toEqual({ group: true });
    });

    it("deletes def.json and empty .space folder after clearing the last folder sticker", async () => {
        const { adapter, text, files, folders } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, sticker: "ui//folder" }));
        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, sticker: "" }));

        expect(text.has("Projects/.space/def.json")).toBe(false);
        expect(files.has("Projects/.space/def.json")).toBe(false);
        expect(folders.has("Projects/.space")).toBe(false);
    });

    it("deletes only def.json when clearing the last setting but .space has other files", async () => {
        const { adapter, text, files, folders } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, color: "#ffaa00" }));
        files.set("Projects/.space/notes.md", { path: "Projects/.space/notes.md" });
        text.set("Projects/.space/notes.md", "keep");
        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, color: "" }));

        expect(text.has("Projects/.space/def.json")).toBe(false);
        expect(files.has("Projects/.space/def.json")).toBe(false);
        expect(folders.has("Projects/.space")).toBe(true);
        expect(files.has("Projects/.space/notes.md")).toBe(true);
    });

    it.each([
        ["defaultColor", "#112233"],
        ["defaultSticker", "ui//folder"],
        ["sort", { group: true }],
    ])("deletes def.json after clearing the last %s setting", async (key, value) => {
        const { adapter, text, files, folders } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, [key]: value }));
        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, [key]: undefined }));

        expect(text.has("Projects/.space/def.json")).toBe(false);
        expect(files.has("Projects/.space/def.json")).toBe(false);
        expect(folders.has("Projects/.space")).toBe(false);
    });

    it("keeps def.json when rank-order still carries a custom order", async () => {
        const { adapter, text, files } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({
            ...metadata,
            sort: { field: "rank", asc: true },
            "rank-order": ["Projects/Beta.md", "Projects/Alpha.md"],
        }));
        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, sort: undefined }));

        expect(files.has("Projects/.space/def.json")).toBe(true);
        expect(JSON.parse(text.get("Projects/.space/def.json"))["rank-order"]).toEqual(["Projects/Beta.md", "Projects/Alpha.md"]);
    });

    it("deletes def.json after clearing manual sort when rank-order is alphabetical", async () => {
        const { adapter, text, files, folders } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({
            ...metadata,
            sort: { field: "rank", asc: true },
            "rank-order": ["Projects/Alpha.md", "Projects/Beta.md"],
        }));
        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, sort: undefined }));

        expect(text.has("Projects/.space/def.json")).toBe(false);
        expect(files.has("Projects/.space/def.json")).toBe(false);
        expect(folders.has("Projects/.space")).toBe(false);
    });

    it("deletes def.json when file-colors only contains cleared colors", async () => {
        const { adapter, text, files, folders } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({
            ...metadata,
            "file-colors": {
                "Projects/Note.md": "",
            },
        }));

        expect(text.has("Projects/.space/def.json")).toBe(false);
        expect(files.has("Projects/.space/def.json")).toBe(false);
        expect(folders.has("Projects/.space")).toBe(false);
    });

    it("treats deleting def.json as a folder space metadata change", () => {
        const { adapter } = createAdapter();

        adapter.onDelete({ file: { path: "Projects/.space/def.json", extension: "json", isFolder: false } });

        expect(adapter.spaceManager.onPathPropertyChanged).toHaveBeenCalledWith("Projects");
        expect(adapter.spaceManager.onPathDeleted).not.toHaveBeenCalled();
        expect(adapter.spaceManager.onSpaceDeleted).not.toHaveBeenCalled();
    });

    it("treats raw def.json updates as a folder space metadata change", () => {
        const { adapter } = createAdapter();

        adapter.onSpaceUpdated({ path: "Projects", type: "def.json" });

        expect(adapter.spaceManager.onPathPropertyChanged).toHaveBeenCalledWith("Projects");
    });

    it("treats deleting a .space folder as parent folder space metadata change", () => {
        const { adapter } = createAdapter();

        adapter.onDelete({ file: { path: "Projects/.space", extension: "", isFolder: true } });

        expect(adapter.spaceManager.onPathPropertyChanged).toHaveBeenCalledWith("Projects");
        expect(adapter.spaceManager.onPathDeleted).not.toHaveBeenCalled();
        expect(adapter.spaceManager.onSpaceDeleted).not.toHaveBeenCalled();
    });
});
