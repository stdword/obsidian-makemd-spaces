import { Superstate } from "makemd-core";
import React, { useEffect, useState } from "react";
import i18n from "shared/i18n";
import { windowFromDocument } from "utils/dom";
import { excludePathsFromFocus, removeExcludedPathFromFocus } from "core/utils/superstate/focus";
import { showSearchMenu } from "../Menus/modals/searchMenu";
import { isTagSpacePath, tagSpaceNameFromPath } from "schemas/builtin";

export const excludedPathDisplayName = (path: string) =>
    isTagSpacePath(path) ? `#${tagSpaceNameFromPath(path)}` : path;

export const ExcludedFiles = (props: { superstate: Superstate; focusIndex: number }) => {
    const { superstate } = props;
    const [focus, setFocus] = useState(superstate.focuses[props.focusIndex]);

    useEffect(() => {
        const focusesChanged = () => setFocus(superstate.focuses[props.focusIndex]);
        superstate.eventsDispatcher.addListener("focusesChanged", focusesChanged);
        return () => superstate.eventsDispatcher.removeListener("focusesChanged", focusesChanged);
    }, [superstate, props.focusIndex]);

    const addMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        showSearchMenu({
            offset: (e.currentTarget as HTMLButtonElement).getBoundingClientRect(),
            win: windowFromDocument(e.view.document),
            superstate,
            tabs: ["folders", "files"],
            placeholder: i18n.labels.excludeItemInputPlaceholder,
            saveOptions: (_: string[], paths: string[]) => excludePathsFromFocus(superstate, props.focusIndex, paths),
        });
    };

    if (!focus) return null;

    return (
        <div className="mk-modal-contents">
            <div className="mk-modal-description">{i18n.labels.excludedPaths}</div>
            <div className="mk-modal-items">
                {(focus["excluded-paths"] ?? []).map((path) => (
                    <div key={path} className="mk-modal-item">
                        <span className="mk-modal-item-name">{excludedPathDisplayName(path)}</span>
                        <div
                            className="mk-modal-item-button"
                            aria-label={i18n.buttons.delete}
                            dangerouslySetInnerHTML={{ __html: superstate.ui.getSticker("ui//close") }}
                            onClick={() => removeExcludedPathFromFocus(superstate, props.focusIndex, path)}
                        ></div>
                    </div>
                ))}
            </div>
            <div className="mk-modal-item">
                <button onClick={addMenu}>+ {i18n.buttons.add}</button>
            </div>
        </div>
    );
};
