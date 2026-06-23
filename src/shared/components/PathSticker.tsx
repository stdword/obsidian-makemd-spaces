import React, { useEffect, useState } from "react";
import StickerModal from "shared/components/StickerModal";
import { ISuperstate as Superstate } from "shared/types/superstate";
import { savePathSticker } from "shared/utils/sticker";
import { PathState } from "../types/PathState";
import { windowFromDocument } from "../utils/dom";

export const openStickerPalette = (superstate: Superstate, win: Window, selectedSticker: (emoji: string) => void) =>
    superstate.ui.openPalette(<StickerModal ui={superstate.ui} selectedSticker={selectedSticker} />, win, "mk-no-transition");

export const PathStickerView = (props: { superstate: Superstate; pathState: PathState; editable?: boolean }) => {
    const { pathState } = props;
    const sticker = pathState?.label?.sticker;
    const color = pathState?.label?.color;

    const triggerStickerMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (pathState?.type == "space")
            openStickerPalette(props.superstate, windowFromDocument(e.view.document), (emoji) => savePathSticker(props.superstate, pathState.path, emoji));
    };

    return (
        <div className={`mk-path-icon ${sticker ? "" : "mk-path-icon-placeholder"}`}>
            {pathState?.type == "space" ? (
                <button
                    aria-label={pathState.name}
                    style={
                        color?.length > 0
                            ? ({
                                  "--label-color": `${color}`,
                                  "--icon-color": `#ffffff`,
                              } as React.CSSProperties)
                            : ({
                                  "--icon-color": `var(--mk-ui-text-secondary)`,
                              } as React.CSSProperties)
                    }
                    dangerouslySetInnerHTML={{
                        __html: props.superstate.ui.getSticker(sticker),
                    }}
                    onClick={(e) => props.editable && triggerStickerMenu(e)}
                ></button>
            ) : (
                <div className=""
                    aria-label={pathState.name}
                    dangerouslySetInnerHTML={{
                        __html: props.superstate.ui.getSticker(sticker),
                    }}
                ></div>
            )}
        </div>
    );
};

export const PathStickerContainer = (props: { superstate: Superstate; path: string }) => {
    const [cache, setCache] = useState<PathState>(null);
    const reloadCache = () => {
        setCache(props.superstate.pathsIndex.get(props.path));
    };
    const reloadIcon = (payload: { path: string }) => {
        if (payload.path == props.path) {
            reloadCache();
        }
    };

    useEffect(() => {
        reloadCache();
        props.superstate.eventsDispatcher.addListener("pathStateUpdated", reloadIcon);

        return () => {
            props.superstate.eventsDispatcher.removeListener("pathStateUpdated", reloadIcon);
        };
    }, [props.path]);

    return cache ? <PathStickerView superstate={props.superstate} pathState={cache} editable={true} /> : <></>;
};
