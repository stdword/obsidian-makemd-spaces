import { fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";

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
});
