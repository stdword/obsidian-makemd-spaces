import classNames from "classnames";
import { NavigatorContext } from "core/react/context/SidebarContext";
import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React, { useContext, useEffect, useState } from "react";
import { Focus } from "shared/types/focus";
import { windowFromDocument } from "utils/dom";
import StickerModal from "../../StickerModal";
import { showOpenMenuInRect } from "./SpaceTreeVirtualized";

export const FocusEditor = (props: { superstate: Superstate; focus: Focus; saveFocus: (focus: Focus) => void }) => {
    const { saveActiveSpace, editFocus: editFocus, activeFocus: activeFocus, setFocuses: setFocuses, focuses: focuses, setEditFocus: setEditFocus } = useContext(NavigatorContext);
    const [focus, setFocus] = useState<Focus>(props.focus);
    useEffect(() => {
        setFocus(props.focus);
    }, [props.focus]);
    return focus && props.focus ? (
        props.focus.name?.length == 0 || editFocus != null ? (
            <div className="mk-path-tree-focus">
                <div
                    className={classNames("mk-focuses-item")}
                    dangerouslySetInnerHTML={{
                        __html: props.superstate.ui.getSticker(focus.sticker),
                    }}
                    onClick={(e) =>
                        props.superstate.ui.openPalette(
                            <StickerModal
                                ui={props.superstate.ui}
                                selectedSticker={(emoji) => {
                                    setFocus({ ...focus, sticker: emoji });
                                }}
                            />,
                            windowFromDocument(e.view.document),
                            "mk-no-transition",
                        )
                    }
                ></div>
                <input value={focus.name} onChange={(e) => setFocus({ ...focus, name: e.target.value })}></input>
                <div className="mk-button-group">
                    <button onClick={() => props.saveFocus(focus)}>{i18n.buttons.save}</button>
                    <button
                        onClick={() => {
                            if (props.focus.name.length == 0) {
                                setFocuses(focuses.filter((_f, i) => i != (editFocus ?? activeFocus)));
                                props.superstate.saveSettings();
                            } else {
                                setEditFocus(null);
                            }
                        }}
                    >
                        {i18n.buttons.cancel}
                    </button>
                </div>
            </div>
        ) : (
            <div className="mk-path-tree-empty">
                <div className="mk-empty-state-title">{i18n.labels.openASpace}</div>
                <div className="mk-empty-state-description">{i18n.labels.openASpaceDesc}</div>
                <button
                    onClick={(e) => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        showOpenMenuInRect(rect, e.view.document, props.superstate, saveActiveSpace, e.shiftKey);
                    }}
                >
                    {i18n.labels.openASpace}
                </button>
            </div>
        )
    ) : (
        <></>
    );
};
