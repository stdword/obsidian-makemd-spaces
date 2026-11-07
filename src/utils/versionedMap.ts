/**
 * A Map that counts its structural changes. Consumers that keep a copy elsewhere (the
 * indexer worker mirrors spacesIndex) compare `version` instead of diffing contents.
 * Values are expected to be replaced, not mutated in place; the plugin follows that rule.
 */
export class VersionedMap<K, V> extends Map<K, V> {
    version = 0;

    set(key: K, value: V): this {
        // Map's constructor calls set() before class fields are initialised.
        this.version = (this.version ?? 0) + 1;
        return super.set(key, value);
    }

    delete(key: K): boolean {
        const removed = super.delete(key);
        if (removed) this.version++;
        return removed;
    }

    clear(): void {
        if (this.size > 0) this.version++;
        super.clear();
    }
}
