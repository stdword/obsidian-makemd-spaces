jest.mock("main", () => jest.fn());
jest.mock("obsidian", () => ({ MarkdownView: class MarkdownView {} }), { virtual: true });

import { dedupeTabHeaderIconEl, markTabStickerIcon } from "adapters/obsidian/utils/modifyTabSticker";

const createChild = (outerHTML: string) => ({
    outerHTML,
    attributes: {} as Record<string, string>,
    removed: false,
    remove() {
        this.removed = true;
    },
    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    },
});

const createElement = (children: ReturnType<typeof createChild>[]) => {
    return {
        get children() {
            return children.filter((child) => !child.removed);
        },
    } as unknown as HTMLElement;
};

describe("modifyTabSticker helpers", () => {
    it("removes duplicate tab icon children without removing distinct icons", () => {
        const firstIcon = createChild(`<svg class="excalidraw-icon"><path d="M1 1"></path></svg>`);
        const duplicateIcon = createChild(`<svg class="excalidraw-icon"><path d="M1 1"></path></svg>`);
        const otherIcon = createChild(`<svg class="other-icon"><path d="M2 2"></path></svg>`);
        const tabIconEl = createElement([firstIcon, duplicateIcon, otherIcon]);

        dedupeTabHeaderIconEl(tabIconEl);

        expect(Array.from(tabIconEl.children)).toHaveLength(2);
        expect(firstIcon.removed).toBe(false);
        expect(duplicateIcon.removed).toBe(true);
        expect(otherIcon.removed).toBe(false);
    });

    it("marks all inserted tab sticker icon roots", () => {
        const svg = createChild(`<svg></svg>`);
        const image = createChild(`<img src="icon.png">`);
        const tabIconEl = createElement([svg, image]);

        markTabStickerIcon(tabIconEl);

        expect(svg.attributes["data-mk-tab-sticker"]).toBe("true");
        expect(image.attributes["data-mk-tab-sticker"]).toBe("true");
    });
});
