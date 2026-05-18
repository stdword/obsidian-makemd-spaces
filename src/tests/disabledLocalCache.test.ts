import { DisabledLocalCache } from "adapters/mdb/localCache/localCache";

describe("DisabledLocalCache", () => {
  it("does not persist or return file cache entries", async () => {
    const cache = new DisabledLocalCache();

    await cache.initialize();
    await cache.store("Note.md", JSON.stringify({ path: "Note.md" }), "file");

    expect(cache.isInitialized()).toBe(false);
    expect(await cache.loadAll("file")).toEqual([]);

    await expect(cache.remove("Note.md", "file")).resolves.toBeUndefined();
    expect(() => cache.cleanType("file")).not.toThrow();
    expect(() => cache.reset()).not.toThrow();
    expect(() => cache.unload()).not.toThrow();
  });
});
