import { fileSystemSpaceInfoFromFolder, fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { defaultSpaceDefContent } from "core/spaceManager/filesystemAdapter/filesystemAdapter";

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

    const tagSpace = fileSystemSpaceInfoFromTag(manager as any, "#book/types/psy");

    expect(tagSpace.name).toBe("book/types/psy");
    expect(tagSpace.path).toBe("spaces://#book/types/psy");
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
    expect(JSON.parse(defaultSpaceDefContent())).toEqual({
      label: {
        color: "",
        sticker: "",
      },
    });
  });
});
