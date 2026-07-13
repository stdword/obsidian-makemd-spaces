import { Superstate } from "makemd-core";
import React, { useEffect, useRef, useState } from "react";
import i18n from "shared/i18n";
import { windowFromDocument } from "utils/dom";
import { showSearchMenu } from "../Menus/modals/searchMenu";

export const HiddenPaths = (props: {
  superstate: Superstate;
  hide?: () => void;
}) => {
    const { superstate } = props;
    const ref = useRef(null);
    const [hiddenPaths, setHiddenPaths] = useState(superstate.settings.hiddenFiles);
    const [hiddenExtensions, setHiddenExtensions] = useState(superstate.settings.hiddenExtensions);

    const saveExtension = (value: string) => {
        superstate.settings.hiddenExtensions = [...superstate.settings.hiddenExtensions, value];
        superstate.saveSettings();
        superstate.initializePaths();
    };

    const saveFile = (_: string[], value: string[]) => {
        superstate.settings.hiddenFiles = [...superstate.settings.hiddenFiles, ...value];
        superstate.saveSettings();
        superstate.initializePaths();
    };

    const removeExtension = (index: number) => {
        superstate.settings.hiddenExtensions = superstate.settings.hiddenExtensions.filter((_f, i) => i != index);
        superstate.saveSettings();
        superstate.initializePaths();
    };

    const removeItem = (index: number) => {
        superstate.settings.hiddenFiles = superstate.settings.hiddenFiles.filter((_f, i) => i != index);
        superstate.saveSettings();
        superstate.initializePaths();
    };

    const addExtension = () => {
        if (ref?.current.value.length > 0) {
            saveExtension(ref.current.value);
            ref.current.innerHTML = "";
        }
    };

    const settingsChanged = () => {
        setHiddenPaths(superstate.settings.hiddenFiles);
        setHiddenExtensions(superstate.settings.hiddenExtensions);
    };

    useEffect(() => {
        props.superstate.eventsDispatcher.addListener("settingsChanged", settingsChanged);
        return () => {
            props.superstate.eventsDispatcher.removeListener("settingsChanged", settingsChanged);
        };
    }, []);

    const addMenu = (e: React.MouseEvent) => {
        e.stopPropagation();

        showSearchMenu({
            offset: (e.target as HTMLButtonElement).getBoundingClientRect(),
            win: windowFromDocument(e.view.document),
            superstate: props.superstate,
            tabs: [ 'folders', 'files' ],
            placeholder: i18n.labels.hideItemInputPlaceholder,
            saveOptions: saveFile,
        });
    };

    return (
        <div className="mk-modal-contents">
            <div className="mk-modal-description">{i18n.labels.hiddenPatterns}</div>
            <div className="mk-modal-items">
                {hiddenExtensions.map((f, index) => (
                    <div key={index} className="mk-modal-item">
                        <span>{f}</span>
                        <div
                            className="mk-modal-item-button"
                            aria-label={i18n.buttons.delete}
                            dangerouslySetInnerHTML={{
                                __html: props.superstate.ui.getSticker("ui//close"),
                            }}
                            onClick={() => removeExtension(index)}
                        ></div>
                    </div>
                ))}
            </div>
            <div className="mk-modal-item">
                <input placeholder={i18n.labels.addExtension} type="text" ref={ref}></input>
                <button onClick={() => addExtension()}>{i18n.buttons.add}</button>
            </div>

            <div className="mk-modal-description">{i18n.labels.hiddenPaths}</div>
            <div className="mk-modal-items">
                {hiddenPaths.map((f, index) => (
                    <div key={index} className="mk-modal-item">
                        <span className="mk-modal-item-name">{f}</span>
                        <div
                            className="mk-modal-item-button"
                            aria-label={i18n.buttons.delete}
                            dangerouslySetInnerHTML={{
                                __html: props.superstate.ui.getSticker("ui//close"),
                            }}
                            onClick={() => removeItem(index)}
                        ></div>
                    </div>
                ))}
            </div>
            <div className="mk-modal-item">
                <button onClick={(e) => addMenu(e)}>+ {i18n.buttons.addItem}</button>
            </div>
        </div>
    );
};
