import React from "react";
import StickerModal from "core/react/components/StickerModal";
import { savePathColor } from "core/utils/superstate/label";
import { ISuperstate as Superstate } from "shared/types/superstate";
import { PathState } from "shared/types/PathState";
import { savePathSticker } from "utils/sticker";
import { windowFromDocument } from "utils/dom";
import { showColorPickerMenu } from "./UI/Menus/modals/colorPickerMenu";

export const openStickerPalette = (superstate: Superstate, win: Window, selectedSticker: (emoji: string) => void) =>
    superstate.ui.openPalette(<StickerModal ui={superstate.ui} selectedSticker={selectedSticker} />, win, "mk-no-transition");

export const PathStickerView = (props: {
    superstate: Superstate;
    pathState: Pick<PathState, 'name' | 'path' | 'sticker'>;
    space: string;
    editable?: boolean;
    color?: string;
    ariaLabel?: string;
    useColorMenu?: boolean;
    keepBackgoundColor?: boolean;
}) => {
    const { superstate, pathState } = props;
    const sticker = pathState.sticker;
    const ariaLabel = props.ariaLabel ?? pathState.name;
    const editable = props.editable ?? false;
    const keepBackgoundColor = props.keepBackgoundColor ?? true;

    const triggerMenu = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!props.editable)
            return

        const window = windowFromDocument(e.view.document)

        if (props.useColorMenu) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const shiftedRect = new DOMRect(rect.x + 200, rect.y, rect.width, rect.height);
            showColorPickerMenu(
                superstate, shiftedRect, window, props.color ?? "",
                (value) => savePathColor(superstate, pathState.path, value, props.space),
                false, false, false, "right"
            );
            return
        }

        openStickerPalette(superstate, window, (emoji) => savePathSticker(superstate, pathState.path, emoji))
    };

    const innerHTML = {
        __html: superstate.ui.getSticker(sticker),
    }
    const color = props.color ?? "var(--mk-ui-text-secondary)"
    const defaultStyle = ({ "--icon-color": color } as React.CSSProperties)
    const backgroundColorStyle = ({
        "--label-color": color,
        "--icon-color": "#ffffff",
    } as React.CSSProperties)

    return (
        <div className={`mk-path-icon ${sticker ? "" : "mk-path-icon-placeholder"}`}>
            {editable ? (
                <button
                    onClick={triggerMenu}
                    style={ !props.keepBackgoundColor && props.color
                            ? backgroundColorStyle
                            : defaultStyle
                    }
                    aria-label={ariaLabel}
                    dangerouslySetInnerHTML={innerHTML}
                ></button>
            ) : (
                <span className=""
                    style={defaultStyle}
                    aria-label={ariaLabel}
                    dangerouslySetInnerHTML={innerHTML}
                ></span>
            )}
        </div>
    );
};
