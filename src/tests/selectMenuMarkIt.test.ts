import { markIt } from "core/react/components/UI/Menus/menu/SelectMenuSuggestions";

describe("markIt", () => {
    it("wraps the matched part of the name", () => {
        expect(markIt("Quarterly Plan", "arte")).toBe("Qu<mark>arte</mark>rly Plan");
    });

    it("matches case-insensitively and repeatedly", () => {
        expect(markIt("Notes on notes", "notes")).toBe("<mark>Notes</mark> on <mark>notes</mark>");
    });

    it("leaves the string untouched for an empty query", () => {
        expect(markIt("Journal/2019/drafts", "")).toBe("Journal/2019/drafts");
        expect(markIt("Journal/2019/drafts", undefined as unknown as string)).toBe("Journal/2019/drafts");
    });

    it("escapes regex metacharacters in the query", () => {
        expect(markIt("cost (net)", "(net)")).toBe("cost <mark>(net)</mark>");
    });

    it("escapes markup in the text so names and descriptions cannot inject HTML", () => {
        expect(markIt("<img src=x onerror=alert(1)>", "")).toBe("&lt;img src=x onerror=alert(1)&gt;");
        expect(markIt("a <b> & c", "b")).toBe("a &lt;<mark>b</mark>&gt; &amp; c");
        expect(markIt("tag <script>", "<script>")).toBe("tag <mark>&lt;script&gt;</mark>");
    });
});
