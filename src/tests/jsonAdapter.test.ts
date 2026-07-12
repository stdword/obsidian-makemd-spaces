import { JSONFiletypeAdapter } from "adapters/obsidian/filetypes/jsonAdapter";

describe("JSONFiletypeAdapter", () => {
    const createAdapter = () => {
        const text = new Map<string, string>();
        const adapter = new JSONFiletypeAdapter({} as any);
        const middleware = {
            readTextFromFile: jest.fn(async (path: string) => text.get(path) ?? ""),
            writeTextToFile: jest.fn(async (path: string, content: string) => {
                text.set(path, content);
            }),
        };

        adapter.initiate(middleware as any);

        return { adapter, middleware, text };
    };

    it("reads complete JSON file content", async () => {
        const { adapter, text } = createAdapter();
        text.set("Projects/.space/context.json", JSON.stringify({ sticker: "lucide//folder-closed" }));

        await expect(adapter.readContent({ path: "Projects/.space/context.json" } as any)).resolves.toEqual({ sticker: "lucide//folder-closed" });
    });

    it("saves complete JSON file content", async () => {
        const { adapter, middleware, text } = createAdapter();

        await adapter.saveContent({ path: "Projects/.space/context.json" } as any, { color: "#ffaa00" });

        expect(middleware.writeTextToFile).toHaveBeenCalledWith(
            "Projects/.space/context.json",
            JSON.stringify({ color: "#ffaa00" }, null, 2),
        );
        expect(text.get("Projects/.space/context.json")).toBe(JSON.stringify({ color: "#ffaa00" }, null, 2));
    });
});
