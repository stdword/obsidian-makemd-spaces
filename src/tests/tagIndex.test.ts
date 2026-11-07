import { TagIndex } from "adapters/obsidian/filesystem/tagIndex";

describe("TagIndex", () => {
    it("answers tag lookups case-insensitively from the tags set per path", () => {
        const index = new TagIndex();
        index.setTags("Work/Plan.md", ["#Work", "#work/q4"]);
        index.setTags("Home/List.md", ["#home"]);

        expect(index.pathsFor("#work")).toEqual(["Work/Plan.md"]);
        expect(index.pathsFor("#WORK/Q4")).toEqual(["Work/Plan.md"]);
        expect(index.pathsFor("#missing")).toEqual([]);
    });

    it("replaces a path's tags on update and drops tags nobody uses any more", () => {
        const index = new TagIndex();
        index.setTags("Work/Plan.md", ["#work"]);
        index.setTags("Work/Plan.md", ["#archive"]);

        expect(index.pathsFor("#work")).toEqual([]);
        expect(index.pathsFor("#archive")).toEqual(["Work/Plan.md"]);
    });

    it("follows renames and forgets deleted paths", () => {
        const index = new TagIndex();
        index.setTags("Work/Plan.md", ["#work"]);
        index.rename("Work/Plan.md", "Archive/Plan.md");
        expect(index.pathsFor("#work")).toEqual(["Archive/Plan.md"]);

        index.remove("Archive/Plan.md");
        expect(index.pathsFor("#work")).toEqual([]);
    });
});
