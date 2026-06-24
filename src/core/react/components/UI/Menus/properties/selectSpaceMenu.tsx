import { SelectOption, Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { Rect } from "shared/types/Pos";
import { searchMenuAllowNew, SearchMenuNewOptions, searchMenuLimits, searchMenuSections, SearchMenuTab, SearchMenuTabs } from "./searchMenu";

const folderSortParts = (path: string) => {
    const parts = path.split("/").filter((part) => part.length > 0);
    return {
        depth: parts.length,
        parent: parts.slice(0, -1).join("/"),
        name: parts[parts.length - 1] ?? "",
        path,
    };
};

const defaultOpenTabs: SearchMenuTabs = { system: true, tags: true, folders: true, refs: true };
const defaultOpenAllowNew: SearchMenuNewOptions = { tags: true, refs: true };

const sectionForSpace = (space: { type: string; path: string }): SearchMenuTab | null => (space.type == "tag" ? "tags" : space.type == "folder" ? "folders" : space.path == "/" || space.type == "vault" || space.type == "default" ? "system" : null);

export const showSpacesMenu = (
    offset: Rect,
    win: Window,
    superstate: Superstate,
    saveLink: (link: string, isNew?: boolean, type?: string) => void,
    includeDefaults?: boolean,
    canAdd?: boolean,
    onlyTags?: boolean,
    hidden?: boolean,
    menuOptions?: { tabs?: SearchMenuTabs; allowNew?: SearchMenuNewOptions },
) => {
    const tabs = onlyTags ? { tags: true } : (menuOptions?.tabs ?? defaultOpenTabs);
    const allowNew = menuOptions?.allowNew ?? defaultOpenAllowNew;
    const options = [...superstate.allSpaces(true, hidden)]
        .filter(
            (f) => {
                const section = sectionForSpace(f);
                return (
                    // Navigator add-to-space menus should not expose internal spaces:// paths.
                    (!f.path.startsWith("spaces://") || section == "tags") &&
                    (includeDefaults || f.type != "default") &&
                    Boolean(section && tabs[section])
                );
            },
        )
        .map<SelectOption>((f) => ({
            name: f.name,
            value: f.path,
            icon: f.type == "tag" ? "lucide//hash" : superstate.pathsIndex.get(f.path)?.label?.sticker,
            section: sectionForSpace(f) ?? "",
            description: f.type == "tag" ? "" : f.type == "vault" ? "" : f.type == "folder" ? f.path.replace(/[^\/]+$/, "") : f.path,
        }))
        .sort((a, b) => {
            if (a.value == "/" || b.value == "/") return a.value == "/" ? -1 : 1;
            if (a.section == "folders" && b.section == "folders") {
                const aFolder = folderSortParts(a.value);
                const bFolder = folderSortParts(b.value);
                if (aFolder.depth != bFolder.depth) return aFolder.depth - bFolder.depth;
                const parentSort = aFolder.parent.localeCompare(bFolder.parent, undefined, { numeric: true, sensitivity: "base" });
                if (parentSort != 0) return parentSort;
                const nameSort = aFolder.name.localeCompare(bFolder.name, undefined, { numeric: true, sensitivity: "base" });
                return nameSort != 0 ? nameSort : aFolder.path.localeCompare(bFolder.path, undefined, { numeric: true, sensitivity: "base" });
            }
            const aSort = a.section == "folders" ? a.value : a.name;
            const bSort = b.section == "folders" ? b.value : b.name;
            return aSort.localeCompare(bSort, undefined, { numeric: true, sensitivity: "base" });
        });

    return superstate.ui.openMenu(
        offset,
        {
            ui: superstate.ui,
            multi: false,
            editable: Boolean(canAdd),
            allowNewBySection: searchMenuAllowNew(allowNew),
            addKeyword: "Create",
            value: [],
            options,
            sections: searchMenuSections(tabs, { system: true }),
            saveOptions: (_: string[], value: string[], isNew?: boolean, section?: string) => {
                saveLink(value[0], isNew, section);
            },
            placeholder: i18n.labels.spaceSelectPlaceholder,
            wrapperClass: "mk-search-menu",
            centered: true,
            detail: true,
            searchable: true,
            showSections: !onlyTags,
            showAll: true,
            optionLimitsBySection: searchMenuLimits(superstate.settings, tabs),
        },
        win,
        "bottom",
    );
};
