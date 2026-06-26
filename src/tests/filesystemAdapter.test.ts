import { fileSystemSpaceInfoFromFolder, fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { FilesystemSpaceAdapter } from "core/spaceManager/filesystemAdapter/filesystemAdapter";
import { SPACE_DEF_DEFAULT_CONTENT } from "shared/constants";

describe("FilesystemSpaceAdapter", () => {
    const createAdapter = () => {
        const files = new Map<string, any>();
        const text = new Map<string, string>();
        const folders = new Set<string>();
        const fileSystem = {
            eventDispatch: {
                addListener: jest.fn(),
            },
            getFile: jest.fn(async (path: string) => files.get(path) ?? null),
            readTextFromFile: jest.fn(async (path: string) => text.get(path) ?? null),
            fileExists: jest.fn(async (path: string) => files.has(path) || folders.has(path)),
            createFolder: jest.fn(async (path: string) => {
                folders.add(path);
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
            superstate: {
                settings: {
                    defaultFoldersAtTop: true,
                    defaultSpaceSort: {
                        field: "name",
                        asc: true,
                    },
                },
            },
        };
        return { adapter, text };
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

    it("does not write default sort when creating def.json while reading missing metadata", async () => {
        const { adapter, text } = createAdapter();

        const metadata = await adapter.spaceDefForSpace("Projects");

        expect(metadata.sort).toBeUndefined();
        expect(JSON.parse(text.get("Projects/.space/def.json"))).toEqual({
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

    it("writes only the changed sort fragment when creating def.json for a sort change", async () => {
        const { adapter, text } = createAdapter();

        await adapter.saveSpace("Projects", (metadata: any) => ({ ...metadata, sort: { group: true } }));

        expect(JSON.parse(text.get("Projects/.space/def.json")).sort).toEqual({ group: true });
    });
});
