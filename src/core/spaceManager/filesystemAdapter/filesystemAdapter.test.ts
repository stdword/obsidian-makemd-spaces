import { FilesystemSpaceAdapter } from "./filesystemAdapter";

describe("FilesystemSpaceAdapter", () => {
  it("keeps nested Obsidian tag names intact when building tag spaces", () => {
    const fileSystem = {
      eventDispatch: { addListener: jest.fn() },
      allTags: () => ["#book/types/psy"],
    };
    const adapter = new FilesystemSpaceAdapter(fileSystem as any, "Spaces");
    const manager = {
      superstate: {
        settings: {
          enableDefaultSpaces: true,
          spacesFolder: "Spaces",
        },
      },
      spaceInfoForPath: (path: string) => ({ path, name: path }),
      uriByString: jest.fn(),
      spaceTypeByString: jest.fn(),
    };

    adapter.initiateAdapter(manager as any);
    jest.spyOn(adapter, "allPaths").mockReturnValue([]);

    const tagSpace = adapter
      .allSpaces()
      .find((space) => space.path == "spaces://#book/types/psy");

    expect(tagSpace?.name).toBe("#book/types/psy");
  });
});
