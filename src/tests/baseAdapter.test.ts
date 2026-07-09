jest.mock(
    "obsidian",
    () => ({
        TFolder: class TFolder {},
    }),
    { virtual: true },
);

import { ObsidianBaseFiletypeAdapter } from "adapters/obsidian/filetypes/baseAdapter";

describe("ObsidianBaseFiletypeAdapter", () => {
    const createAdapter = () => {
        const plugin = {
            app: {
                vault: {
                    getAbstractFileByPath: jest.fn(() => ({
                        children: [] as any[],
                    })),
                },
            },
        };
        const adapter = new ObsidianBaseFiletypeAdapter(plugin as any);
        const middleware = {
            getFileCache: jest.fn((): any => null),
            updateFileCache: jest.fn(),
            writeTextToFile: jest.fn(),
            getFile: jest.fn((path: string) => Promise.resolve({ path })),
        };

        adapter.initiate(middleware as any);

        return { adapter, middleware };
    };

    it("supports empty Obsidian base files", async () => {
        const { adapter, middleware } = createAdapter();

        expect(adapter.supportedFileTypes).toEqual(["base"]);

        const file = await adapter.newFile("Projects", null, "base");

        expect(middleware.writeTextToFile).toHaveBeenCalledWith("Projects/Untitled.base", "");
        expect(file).toEqual({ path: "Projects/Untitled.base" });
    });

    it("does not write display metadata into base file cache", async () => {
        const { adapter, middleware } = createAdapter();

        await adapter.parseCache({ path: "Database.base", name: "Database.base" } as any, false);

        expect(middleware.updateFileCache).not.toHaveBeenCalled();
    });
});
