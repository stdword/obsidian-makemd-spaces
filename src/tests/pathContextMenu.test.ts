jest.mock(
  "makemd-core",
  () => ({
    SelectOptionType: {
      Submenu: "submenu",
      Separator: "separator",
    },
  }),
  { virtual: true },
);

import { triggerMultiPathMenu } from "core/react/components/UI/Menus/navigator/pathContextMenu";

describe("triggerMultiPathMenu", () => {
  it("opens every selected path in a new tab from the multi-path open action", async () => {
    let resolveFirst: () => void;
    let resolveSecond: () => void;
    const firstOpen = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const secondOpen = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });
    const openPath = jest.fn()
      .mockReturnValueOnce(firstOpen)
      .mockReturnValueOnce(secondOpen);
    const openMenu = jest.fn();
    const superstate = {
      ui: {
        openPath,
        openMenu,
      },
    };
    const selectedPaths = [
      { item: { path: "Alpha.md", type: "file" }, path: "Alpha.md" },
      { item: { path: "Beta.md", type: "file" }, path: "Beta.md" },
    ];
    const event = {
      target: {
        getBoundingClientRect: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
      },
      view: {
        document: { defaultView: {} } as Document,
      },
    };

    triggerMultiPathMenu(superstate as any, selectedPaths as any, event as any);

    const menuProps = openMenu.mock.calls[0][1];
    const openAll = menuProps.options[0].onClick(event);

    expect(openPath).toHaveBeenCalledTimes(1);
    expect(openPath).toHaveBeenNthCalledWith(1, "Alpha.md", "tab");

    resolveFirst();
    await firstOpen;
    await Promise.resolve();

    expect(openPath).toHaveBeenCalledTimes(2);
    expect(openPath).toHaveBeenNthCalledWith(2, "Beta.md", "tab");

    resolveSecond();
    await openAll;
  });
});
