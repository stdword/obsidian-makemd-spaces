import { SelectMenuProps, SelectOption, SelectSection } from "shared/types/menu";
import { MakeMDSettings } from "shared/types/settings";
import i18n from "shared/i18n";
import { Superstate } from "makemd-core";
import { Rect } from "shared/types/Pos";

export type SearchMenuTab = "folders" | "files" | "tags" | "refs";
export function getSearchMenuTabs(settings: MakeMDSettings, tabs: SearchMenuTab[]) {
    const desc = {
        folders: {
            label: i18n.labels.folders,
            limit: settings?.searchMenuFoldersLimit,
            allowCreation: false,
        },
        files: {
            label: i18n.labels.files,
            limit: settings?.searchMenuFilesLimit,
            allowCreation: false,
        },
        tags: {
            label: i18n.labels.tags,
            limit: settings?.searchMenuTagsLimit,
            allowCreation: true,
        },
        refs: {
            label: i18n.labels.refs,
            limit: settings?.searchMenuRefsLimit,
            allowCreation: true,
        },
    }
    return tabs.map(t => ({id: t, ...desc[t]}))
}


const folderSortParts = (path: string) => {
    const parts = path.split("/").filter((part) => part.length > 0);
    return {
        depth: parts.length,
        parent: parts.slice(0, -1).join("/"),
        name: parts[parts.length - 1] ?? "",
        path,
    };
};
export const searchMenuOptionSort = (a: SelectOption, b: SelectOption) => {
    if (a.value == "/" || b.value == "/")
        return a.value == "/" ? -1 : 1;

    if (a.section == "folders" && b.section == "folders") {
        const aFolder = folderSortParts(a.value);
        const bFolder = folderSortParts(b.value);
        if (aFolder.depth != bFolder.depth)
            return aFolder.depth - bFolder.depth;
        const parentSort = aFolder.parent.localeCompare(bFolder.parent, undefined, { numeric: true, sensitivity: "base" });
        if (parentSort != 0)
            return parentSort;
        const nameSort = aFolder.name.localeCompare(bFolder.name, undefined, { numeric: true, sensitivity: "base" });
        return nameSort != 0 ? nameSort : aFolder.path.localeCompare(bFolder.path, undefined, { numeric: true, sensitivity: "base" });
    }

    const aSort = a.section == "folders" ? a.value : a.name;
    const bSort = b.section == "folders" ? b.value : b.name;
    return aSort.localeCompare(bSort, undefined, { numeric: true, sensitivity: "base" });
};

export const showSearchMenu = ({
    offset,
    win,
    superstate,
    tabs,
    placeholder,
    saveOptions,
    selectProps,
    hidden,
}: {
    offset: Rect;
    win: Window;
    superstate: Superstate;
    tabs: SearchMenuTab[];
    placeholder?: string;
    saveOptions: SelectMenuProps["saveOptions"];
    selectProps?: Partial<SelectMenuProps>;
    hidden?: boolean;
}) => {
    offset; // offset var is not used

    const tabsDesc = getSearchMenuTabs(superstate.settings, tabs)
    const suggestions: SelectOption[] = []

    if (tabs.includes('files'))
        suggestions.push(...
            [...superstate.pathsIndex.values()]
            .filter((f) => f.type == "file" && (hidden ? true : !f.hidden))
            .map<SelectOption>((f) => ({
                section: 'files',
                icon: f.label?.sticker,
                name: f.name,
                description: f.path.replace(/[^\/]+$/, ""),
                value: f.path,
            }))
        )

    if (tabs.includes('folders') || tabs.includes('tags')) {
        const spaces = [...superstate.allSpaces(true, hidden)]

        if (tabs.includes('folders'))
            suggestions.push(...spaces
                .filter((s) => s.type == 'vault')
                .map<SelectOption>((s) => ({
                    section: '',
                    icon: superstate.pathsIndex.get(s.path)?.label?.sticker,
                    name: s.name,
                    description: '',
                    value: s.path,
                }))
            )
            suggestions.push(...spaces
                .filter((s) => s.type == 'folder')
                .map<SelectOption>((s) => ({
                    section: 'folders',
                    icon: superstate.pathsIndex.get(s.path)?.label?.sticker,
                    name: s.name,
                    description: s.path.replace(/[^\/]+$/, ""),
                    value: s.path,
                }))
            )

        if (tabs.includes('tags'))
            suggestions.push(...spaces
                .filter((s) => s.type == 'tag')
                .map<SelectOption>((s) => ({
                    section: 'tags',
                    icon: 'lucide//hash',
                    name: s.name,
                    description: '',
                    value: s.path,
                }))
            )
    }

    superstate.ui.openMenu(
        null, // modal opens in the center of the screen
        {
            ui: superstate.ui,
            multi: false,
            value: [],
            options: suggestions.slice().sort(searchMenuOptionSort),
            saveOptions,
            placeholder,
            wrapperClass: "mk-search-menu",
            centered: true,
            detail: true,
            searchable: true,
            showAll: true,
            sections: tabsDesc.map(d => ({name: d.id, value: d.id} as SelectSection)),
            optionLimitsBySection: Object.fromEntries(tabsDesc.map(d => [d.id,  d.limit])),
            allowNewBySection: Object.fromEntries(tabsDesc.filter(d => d.allowCreation).map(d => [d.id,  true]) ),
            showSections: true,
            editable: false,
            ...selectProps,
        },
        win,
        "bottom",
    );
}
