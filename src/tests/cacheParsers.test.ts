import { parseMetadata } from "core/superstate/cacheParsers";
import { SpaceState } from "shared/types/PathState";

describe("parseMetadata", () => {
    const settings = {
        hiddenExtensions: [],
        hiddenFiles: [],
    } as any;

    it("uses parent defaultColor when path color is empty", () => {
        const spacesCache = new Map<string, SpaceState>([
            [
                "Parent",
                {
                    name: "Parent",
                    path: "Parent",
                    type: "folder",
                    metadata: {
                        defaultColor: "#00aaee",
                    },
                },
            ],
        ]);

        const { cache } = parseMetadata(
            "Parent/Child.md",
            settings,
            spacesCache,
            {
                metadata: {},
                name: "Child.md",
                ctime: 0,
                label: {
                    sticker: "",
                    color: "",
                },
                contentTypes: [],
                tags: [],
                type: "file",
                subtype: "md",
                parent: "Parent",
                readOnly: false,
            },
            "Child.md",
            "file",
            "md",
            "Parent",
            null,
        );

        expect(cache.label.color).toBe("");
        expect(cache.effectiveLabel.color).toBe("#00aaee");
    });

    it("derives display name from file metadata without label name", () => {
        const { cache } = parseMetadata(
            "Parent/Child.md",
            settings,
            new Map(),
            {
                metadata: {},
                ctime: 0,
                name: "Child.md",
                label: {
                    sticker: "",
                    color: "",
                },
                contentTypes: [],
                tags: [],
                type: "file",
                subtype: "md",
                parent: "Parent",
                readOnly: false,
                file: {
                    name: "Child",
                    filename: "Child.md",
                    path: "Parent/Child.md",
                    extension: "md",
                },
            },
            "Child.md",
            "file",
            "md",
            "Parent",
            null,
        );

        expect(cache.name).toBe("Child");
    });

    it("uses file extension stickers instead of cached file stickers", () => {
        const cases = [
            ["Image.png", "png", "ui//image"],
            ["Photo.jpg", "jpg", "ui//image"],
            ["Photo.jpeg", "jpeg", "ui//image"],
            ["Image.webp", "webp", "ui//image"],
            ["Animation.gif", "gif", "ui//image"],
            ["Board.canvas", "canvas", "ui//layout-dashboard"],
            ["Database.base", "base", "ui//table"],
            ["Sketch.excalidraw.md", "excalidraw", "ui//excalidraw"],
            ["Note.md", "md", "ui//file-text"],
        ];

        cases.forEach(([name, extension, sticker]) => {
            const { cache } = parseMetadata(
                name,
                settings,
                new Map(),
                {
                    metadata: {},
                    ctime: 0,
                    name,
                    label: {
                        sticker: "ui//cached",
                        color: "",
                    },
                    contentTypes: [],
                    tags: [],
                    type: "file",
                    subtype: extension,
                    parent: "",
                    readOnly: false,
                    file: {
                        extension,
                    },
                },
                name,
                "file",
                extension,
                "",
                null,
            );

            expect(cache.label.sticker).toBe("ui//cached");
            expect(cache.effectiveLabel.sticker).toBe(sticker);
        });
    });

    it("uses cached sticker for folders", () => {
        const { cache } = parseMetadata(
            "Projects",
            settings,
            new Map(),
            {
                metadata: {},
                ctime: 0,
                name: "Projects",
                label: {
                    sticker: "emoji//1f4c1",
                    color: "",
                },
                contentTypes: [],
                tags: [],
                type: "space",
                subtype: "folder",
                parent: "",
                readOnly: false,
            },
            "Projects",
            "space",
            "folder",
            "",
            null,
        );

        expect(cache.label.sticker).toBe("emoji//1f4c1");
    });
});
