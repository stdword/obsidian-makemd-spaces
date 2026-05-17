import { parseMetadata } from "core/superstate/cacheParsers";
import { SpaceState } from "shared/types/PathState";

describe("parseMetadata", () => {
  const settings = {
    fmKeyAlias: "aliases",
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
        ctime: 0,
        label: {
          name: "Child.md",
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

    expect(cache.label.color).toBe("#00aaee");
  });

  it("uses file extension stickers instead of cached file stickers", () => {
    const cases = [
      ["Image.png", "png", "ui//image"],
      ["Photo.jpg", "jpg", "ui//image"],
      ["Photo.jpeg", "jpeg", "ui//image"],
      ["Image.webp", "webp", "ui//image"],
      ["Animation.gif", "gif", "ui//image"],
      ["Board.canvas", "canvas", "ui//canvas"],
      ["Database.base", "base", "ui//table"],
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
          label: {
            name,
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

      expect(cache.label.sticker).toBe(sticker);
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
        label: {
          name: "Projects",
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
