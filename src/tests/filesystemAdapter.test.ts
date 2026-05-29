import { fileSystemSpaceInfoFromFolder, fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { SPACE_DEF_DEFAULT_CONTENT } from "shared/constants";

describe("FilesystemSpaceAdapter", () => {
  it("keeps nested Obsidian tag names intact when building tag spaces", () => {
    const manager = {
      superstate: {
        settings: {
          enableDefaultSpaces: true,
        },
      },
      spaceInfoForPath: (path: string) => ({ path, name: path }),
      uriByString: jest.fn(),
      spaceTypeByString: jest.fn(),
    };

    const tagSpace = fileSystemSpaceInfoFromTag(manager as any, "#books/psy");

    expect(tagSpace.name).toBe("books/psy");
    expect(tagSpace.path).toBe("spaces://#books/psy");
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

  it("creates def.json content with an empty label color and sticker", () => {
    expect(JSON.parse(SPACE_DEF_DEFAULT_CONTENT())).toEqual({
      label: {
        color: "",
        sticker: "",
      },
    });
  });
});
