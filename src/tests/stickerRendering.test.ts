jest.mock("main", () => jest.fn());
jest.mock("obsidian", () => ({ getIcon: (): null => null }), { virtual: true });

import { stickerFromString } from "adapters/obsidian/ui/sticker";

describe("stickerFromString", () => {
    it("renders a unified emoji code as the emoji", () => {
        expect(stickerFromString("emoji//1f600", {} as any)).toContain("\u{1f600}");
    });

    it("shows an unparsable sticker value as text instead of markup", () => {
        const html = stickerFromString("<img src=x onerror=alert(1)>", {} as any);
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });

    it("ignores ui icon names that are not in the icon set, including object prototype keys", () => {
        expect(stickerFromString("ui//constructor", {} as any)).toBe("");
        expect(stickerFromString("ui//no-such-icon", {} as any)).toBe("");
        expect(stickerFromString("ui//home", {} as any)).toContain("<svg");
    });
});
