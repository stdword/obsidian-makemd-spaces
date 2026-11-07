import { VersionedMap } from "utils/versionedMap";

describe("VersionedMap", () => {
    it("bumps the version on every structural change and not on reads", () => {
        const map = new VersionedMap<string, number>();
        expect(map.version).toBe(0);
        map.set("a", 1);
        map.set("a", 2);
        expect(map.version).toBe(2);
        map.get("a");
        map.has("b");
        expect(map.version).toBe(2);
        expect(map.delete("missing")).toBe(false);
        expect(map.version).toBe(2);
        map.delete("a");
        expect(map.version).toBe(3);
        map.clear();
        expect(map.version).toBe(3);
    });

    it("counts entries given to the constructor", () => {
        const map = new VersionedMap<string, number>([["a", 1], ["b", 2]]);
        expect(Number.isFinite(map.version)).toBe(true);
        expect(map.size).toBe(2);
    });
});
