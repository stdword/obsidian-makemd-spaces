// Tree rows are keyed by position: a section's id is its path, a nested row's id is its
// parent's id + "/" + its path. Moving a subtree to another place in the tree is therefore
// a prefix swap on the ids of everything under it.
export type ExpandedIdMapping = { from: string; to: string };

const isUnder = (id: string, root: string) => id == root || id.startsWith(`${root}/`);

/** Keeps only the ids under a mapping's `from` root, re-rooted at its `to`. */
export const translateExpandedIds = (expanded: string[], mappings: ExpandedIdMapping[]): string[] =>
    Array.from(
        new Set(
            mappings.flatMap(({ from, to }) => expanded.filter((id) => isUnder(id, from)).map((id) => to + id.slice(from.length))),
        ),
    );

/** Replaces the state under every mapping's `to` root in `settingsExpanded` with the state under its `from` root in `tempExpanded`. */
export const writeBackExpandedIds = (settingsExpanded: string[], tempExpanded: string[], mappings: ExpandedIdMapping[]): string[] =>
    Array.from(
        new Set([
            ...settingsExpanded.filter((id) => !mappings.some(({ to }) => isUnder(id, to))),
            ...translateExpandedIds(tempExpanded, mappings),
        ]),
    );
