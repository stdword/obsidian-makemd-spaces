import { TargetLocation } from "shared/types/path";

type ModifierEvent = { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; button?: number };

// Cmd/Ctrl (or middle click) opens in a new tab, with Alt in a split; otherwise the current tab.
export const targetLocationForEvent = (e?: ModifierEvent | null): TargetLocation => {
    if (!e) return false;
    const newTab = e.ctrlKey || e.metaKey || e.button == 1;
    if (!newTab) return false;
    return e.altKey ? "split" : "tab";
};
