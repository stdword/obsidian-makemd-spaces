jest.mock(
    "obsidian",
    () => ({
        TFile: class TFile {},
        TFolder: class TFolder {},
        getAllTags: jest.fn((metadata) => [
            ...(metadata?.tags ?? []).map((tagCache: any) => tagCache.tag),
            ...(metadata?.frontmatter?.tags ? [`#${metadata.frontmatter.tags}`] : []),
        ]),
    }),
    { virtual: true },
);

import { ObsidianMarkdownFiletypeAdapter } from "adapters/obsidian/filetypes/markdownAdapter";

describe("ObsidianMarkdownFiletypeAdapter", () => {
    const createAdapter = () => {
        const plugin = {
            app: {
                metadataCache: {
                    getCache: jest.fn(() => ({
                        frontmatter: {
                            tags: "frontmatter-tag",
                            sticker: "frontmatter-sticker",
                            color: "frontmatter-color",
                        },
                        links: [] as any[],
                        tags: [{ tag: "#inline-tag" }],
                    })),
                    resolvedLinks: {},
                    getFirstLinkpathDest: jest.fn(),
                },
            },
            superstate: {
                settings: {
                    fmKeyBanner: "banner",
                    fmKeyColor: "color",
                    fmKeySticker: "sticker",
                },
            },
        };
        const adapter = new ObsidianMarkdownFiletypeAdapter(plugin as any);
        const middleware = {
            getFileCache: jest.fn((): any => null),
            updateFileCache: jest.fn(),
        };

        adapter.initiate(middleware as any);

        return { adapter, middleware };
    };

    it("only exposes tags as markdown content", () => {
        const { adapter } = createAdapter();

        expect(adapter.contentTypes({ extension: "md" } as any)).toEqual(["tags"]);
        expect(adapter.cacheTypes({ extension: "md" } as any)).toEqual(["tags"]);
    });

    it("writes only markdown tags into file cache", async () => {
        const { adapter, middleware } = createAdapter();

        await adapter.parseCache({ path: "Note.md", name: "Note.md" } as any, false);

        expect(middleware.updateFileCache).toHaveBeenCalledWith(
            "Note.md",
            expect.objectContaining({
                tags: ["#inline-tag", "#frontmatter-tag"],
            }),
            false,
        );
    });
});
