/**
 * Reverse index tag -> paths for Obsidian's metadata cache, which only offers path -> tags.
 * Built once from all markdown files, then kept current from metadata/rename/delete events,
 * so looking up the files of a tag no longer scans the whole vault on every render.
 */
export class TagIndex {
    private pathTags = new Map<string, Set<string>>();
    private tagPaths = new Map<string, Set<string>>();
    public built = false;

    public setTags(path: string, tags: string[]) {
        this.remove(path);
        const normalized = new Set(tags.filter((tag) => tag).map((tag) => tag.toLowerCase()));
        if (normalized.size == 0) return;
        this.pathTags.set(path, normalized);
        for (const tag of normalized) {
            if (!this.tagPaths.has(tag)) this.tagPaths.set(tag, new Set());
            this.tagPaths.get(tag).add(path);
        }
    }

    public remove(path: string) {
        const tags = this.pathTags.get(path);
        if (!tags) return;
        this.pathTags.delete(path);
        for (const tag of tags) {
            const paths = this.tagPaths.get(tag);
            paths?.delete(path);
            if (paths && paths.size == 0) this.tagPaths.delete(tag);
        }
    }

    public rename(oldPath: string, newPath: string) {
        const tags = this.pathTags.get(oldPath);
        if (!tags) return;
        this.remove(oldPath);
        this.setTags(newPath, [...tags]);
    }

    public pathsFor(tag: string): string[] {
        return [...(this.tagPaths.get(tag.toLowerCase()) ?? [])];
    }

    public clear() {
        this.pathTags.clear();
        this.tagPaths.clear();
        this.built = false;
    }
}
