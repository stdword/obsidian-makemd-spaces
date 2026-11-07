import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { defaultMenu } from "../menu/SelectionMenu";

const copyText = (superstate: Superstate, win: Window, text: string) => {
    const clipboard = win?.navigator?.clipboard ?? navigator.clipboard;
    return Promise.resolve(clipboard.writeText(text))
        .then(() => superstate.ui.notify(i18n.notice.pathCopied))
        .catch((error: unknown) => console.error("Spaces :: failed to copy path", error));
};

// "Copy path" submenu entries: the same path in the three forms a user may paste somewhere.
export const copyPathMenuOptions = (superstate: Superstate, path: string, win: Window): SelectOption[] => [
    {
        name: i18n.menu.copyPathAsUrl,
        icon: "ui//link",
        onClick: () => copyText(superstate, win, superstate.ui.appUrlForPath(path)),
    },
    {
        name: i18n.menu.copyPathFromVault,
        icon: "ui//vault",
        onClick: () => copyText(superstate, win, path),
    },
    {
        name: i18n.menu.copyPathFromRoot,
        icon: "lucide//hard-drive",
        onClick: () => copyText(superstate, win, superstate.ui.systemPathForPath(path)),
    },
];

export const copyPathMenuOption = (superstate: Superstate, path: string, win: Window): SelectOption => ({
    name: i18n.menu.copyPath,
    icon: "lucide//clipboard",
    type: SelectOptionType.Submenu,
    onSubmenu: (offset, onHide) => superstate.ui.openMenu(offset, defaultMenu(superstate.ui, copyPathMenuOptions(superstate, path, win)), win, "right", onHide),
});
