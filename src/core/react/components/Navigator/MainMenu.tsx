import classNames from "classnames";

import { Superstate } from "makemd-core";
import React, { useRef } from "react";
import { DEFAULT_SYSTEM_NAME } from "shared/constants";

interface MainMenuComponentProps {
    superstate: Superstate;
}

export const MainMenu = (props: MainMenuComponentProps) => {
    const { superstate } = props;

    const ref = useRef<HTMLDivElement>();
    return (
        <div className="mk-main-menu-container">
            <div className="mk-main-menu-inner">
                <div className={classNames("mk-main-menu")}>
                    <div
                        aria-label={DEFAULT_SYSTEM_NAME}
                        className={`mk-main-menu-button mk-main-menu-button-primary`}
                        ref={ref}
                        onClick={() => {
                            props.superstate.ui.mainMenu(ref.current, superstate);
                        }}
                    >
                        <span>{DEFAULT_SYSTEM_NAME}</span>
                        <div
                            className="mk-icon-xsmall"
                            dangerouslySetInnerHTML={{
                                __html: props.superstate.ui.getSticker("ui//chevrons-up-down"),
                            }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
