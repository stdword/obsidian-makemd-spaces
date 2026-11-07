import { useInTreeCreateRoot } from "core/react/hooks/useInTreeCreateRoot";
import React, { useEffect } from "react";
import { ObsidianUI } from "./ui";

// Hosts the React roots (menus, modals) the UI adapter creates and announces when it is ready.
export const WindowManager = (props: { ui: ObsidianUI }) => {
    const { createRoot, portals, getRoot } = useInTreeCreateRoot();
    useEffect(() => {
        props.ui.createRoot = createRoot;
        props.ui.getRoot = getRoot;
        props.ui.manager.eventsDispatch.dispatchEvent("windowReady", null);
    }, [createRoot]);

    return <>{portals}</>;
};
