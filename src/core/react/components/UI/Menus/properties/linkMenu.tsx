import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { SelectMenuProps } from "shared/types/menu";
import { Rect } from "shared/types/Pos";
import { SearchMenuTab, searchMenuLimits, searchMenuSections, SearchMenuTabs } from "./searchMenu";

const defaultLinkTabs: SearchMenuTabs = { files: true, folders: true };
const sectionForPath = (pathState: { type?: string; subtype?: string; path: string }): SearchMenuTab | null => (pathState.type == "file" ? "files" : pathState.subtype == "folder" ? "folders" : null);

export const showLinkMenu = (offset: Rect, win: Window, superstate: Superstate, saveLink: (link: string | string[]) => void, options?: Partial<SelectMenuProps> & { tabs?: SearchMenuTabs }) => {
    const { tabs: optionTabs, ...selectOptions } = options ?? {};
    const tabs = optionTabs ?? defaultLinkTabs;
    const suggestions = [...superstate.pathsIndex.values()]
        .filter((f) => {
            const section = sectionForPath(f);
            return !f.hidden && Boolean(section && tabs[section]);
        })
        .map((f) => ({
            name: f.name,
            value: f.path,
            description: f.path,
            icon: f.label?.sticker,
            section: sectionForPath(f),
        }));
    return superstate.ui.openMenu(
        offset,
        {
            ui: superstate.ui,
            multi: options?.multi,
            value: options?.value ?? [],
            options: suggestions,
            saveOptions: (_: string[], value: string[]) => {
                options?.multi ? saveLink(value) : saveLink(value[0]);
            },
            placeholder: i18n.labels.linkItemSelectPlaceholder,
            wrapperClass: "mk-search-menu",
            centered: true,
            detail: true,
            searchable: true,
            showAll: true,
            optionLimitsBySection: searchMenuLimits(superstate.settings, tabs),
            sections: searchMenuSections(tabs),
            showSections: true,
            ...selectOptions,
            editable: false,
            allowNewBySection: {},
        },
        win,
    );
};
