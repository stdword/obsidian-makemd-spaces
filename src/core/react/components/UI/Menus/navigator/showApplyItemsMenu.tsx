import { saveSpaceCache } from "core/superstate/utils/spaces";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React from "react";
import { SpaceState } from "shared/types/PathState";
import { Rect } from "shared/types/Pos";
import { openStickerPalette } from "../../../../../../shared/components/PathSticker";
import { defaultMenu } from "../menu/SelectionMenu";
import { showColorPickerMenu } from "../properties/colorPickerMenu";

export const showApplyItemsMenu = (offset: Rect, superstate: Superstate, space: SpaceState, win: Window, onHide?: () => void) => {
    const options: SelectOption[] = [
        {
            name: i18n.menu.setDefaultSticker,
            icon: "ui//sticker",
            value: "apply-all-sticker",
            showChevron: true,
            onClick: () => {
                setTimeout(
                    () =>
                        openStickerPalette(superstate, win, (emoji) =>
                            saveSpaceCache(superstate, space.space, {
                                ...space.metadata,
                                defaultSticker: emoji,
                            }),
                        ),
                    60,
                );
            },
        },
        {
            name: i18n.menu.setDefaultColor,
            icon: "ui//palette",
            value: "apply-all-color",
            type: SelectOptionType.Submenu,
            closeParentOnOpen: true,
            onSubmenu: (rect) =>
                showColorPickerMenu(
                    superstate,
                    rect,
                    win,
                    space.metadata?.defaultColor ?? "",
                    (color) =>
                        saveSpaceCache(superstate, space.space, {
                            ...space.metadata,
                            defaultColor: color,
                        }),
                    false,
                    true,
                ),
        },
    ];
    return superstate.ui.openMenu(offset, defaultMenu(superstate.ui, options), win, "right", onHide);
};
