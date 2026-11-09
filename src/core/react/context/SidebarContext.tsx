import { DropModifiers } from "core/react/components/Navigator/SpaceTree/SpaceTreeItem";
import { TreeNode } from "core/utils/superstate/spaces";
import _ from "lodash";
import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { Focus } from "shared/types/focus";
import { PathState, SpaceState } from "shared/types/PathState";
import { iconForSpace } from "core/utils/pathDisplay";
import { isSpaceSeparatorPath, tagSpaceParentPath } from "schemas/builtin";
import { FOCUS_MODE_INDEX, currentFocus as currentFocusOf, currentFocusIndex, updateCurrentFocus } from "core/utils/superstate/focusMode";

type NavigatorContextProps = {
    dragPaths: string[];
    setDragPaths: React.Dispatch<React.SetStateAction<string[]>>;
    selectedPaths: TreeNode[];
    setSelectedPaths: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    activePath: string;
    setActivePath: React.Dispatch<React.SetStateAction<string>>;
    activeViewSpaces: PathState[];
    /** Index of the focus on screen; FOCUS_MODE_INDEX while Focus Mode is on. */
    activeFocus: number;
    setActiveFocus: React.Dispatch<React.SetStateAction<number>>;
    /** The focus on screen: a regular one or the temporary Focus Mode one. */
    currentFocus: Focus | undefined;
    /** Changes the focus on screen; a temporary focus changes in memory only. */
    updateCurrentFocus: (update: (focus: Focus) => Focus) => void;
    /** Row ids of the tree in display order, kept current by the tree. */
    treeOrderRef: React.MutableRefObject<string[]>;
    focuses: Focus[];
    setFocuses: (paths: Focus[]) => void;
    saveActiveSpace: (path: string) => void;
    closeActiveSpace: (path: string) => void;
    modifier: DropModifiers;
    setModifier: React.Dispatch<React.SetStateAction<DropModifiers>>;
    editFocus: number | null;
    setEditFocus: React.Dispatch<React.SetStateAction<number | null>>;
};

export const NavigatorContext = createContext<NavigatorContextProps>({
    dragPaths: [],
    setDragPaths: _.noop,
    selectedPaths: [],
    setSelectedPaths: _.noop,
    activePath: null,
    setActivePath: _.noop,
    activeFocus: 0,
    setActiveFocus: _.noop,
    activeViewSpaces: [],
    currentFocus: undefined,
    updateCurrentFocus: _.noop,
    treeOrderRef: { current: [] },
    focuses: [],
    setFocuses: _.noop,
    saveActiveSpace: _.noop,
    closeActiveSpace: _.noop,
    modifier: null,
    setModifier: _.noop,
    editFocus: null,
    setEditFocus: _.noop,
});

export const SidebarProvider: React.FC<React.PropsWithChildren<{ superstate: Superstate }>> = (props) => {
    const [modifier, setModifier] = useState<DropModifiers>(null);
    const [dragPaths, setDragPaths] = useState<string[]>([]);
    const [selectedPaths, setSelectedPaths] = useState<TreeNode[]>([]);
    const [activePath, setActivePath] = useState<string>(null);
    const [editFocus, setEditFocus] = useState<number | null>(null);
    const [focuses, setFocuses] = useState<Focus[]>(props.superstate.focuses);

    const [activeFocus, setActiveFocus] = useState<number>(currentFocusIndex(props.superstate));
    const [focusModeFocus, setFocusModeFocus] = useState<Focus | null>(props.superstate.focusMode?.focus ?? null);
    const treeOrderRef = useRef<string[]>([]);

    const pathStateForFocusPath = (path: string) => {
        if (isSpaceSeparatorPath(path)) {
            return {
                path,
                name: "",
                parent: "",
                type: "file",
                subtype: "separator",
                sticker: "",
                metadata: {},
                tags: [],
                hidden: true,
                spaces: [],
                linkedSpaces: [],
                pinnedSpaces: [],
            } as PathState;
        }
        const pathState = props.superstate.pathStateForPath(path);
        if (pathState) return pathState;

        const uri = props.superstate.spaceManager.uriByString(path);
        const subtype = props.superstate.spaceManager.spaceTypeByString(uri);
        if (!["folder", "tag", "vault"].includes(subtype)) return null;

        const spaceInfo = props.superstate.spaceManager.spaceInfoForPath(path);
        if (!spaceInfo) return null;

        const fallbackPath: PathState = {
            path: spaceInfo.path,
            name: spaceInfo.name,
            parent: subtype == "tag" ? tagSpaceParentPath(spaceInfo.path) : "",
            type: "space",
            subtype,
            sticker: iconForSpace(subtype),
            color: "",
            metadata: {},
            tags: [],
            spaces: [],
            linkedSpaces: [],
            pinnedSpaces: [],
            hidden: true,
        };
        const fallbackSpace: SpaceState = {
            path: spaceInfo.path,
            name: spaceInfo.name,
            type: subtype as any,
            metadata: {},
            space: spaceInfo.space,
        };
        props.superstate.pathsIndex.set(spaceInfo.path, fallbackPath);
        props.superstate.spacesIndex.set(spaceInfo.path, fallbackSpace);

        return fallbackPath;
    };

    const [activeViewSpaces, setActiveViewSpaces] = useState<PathState[]>((currentFocusOf(props.superstate)?.paths ?? []).map(pathStateForFocusPath).filter((f) => f));

    const updateActiveFocus = (update: (focus: Focus) => Focus) => {
        updateCurrentFocus(props.superstate, update);
    };

    const setActiveViewSpaceByPath = (path: string) => {
        updateActiveFocus((focus) => ({ ...focus, paths: [...focus.paths.filter((f) => f != path), path] }));
    };

    const closeActiveViewSpace = (path: string) => {
        updateActiveFocus((focus) => ({ ...focus, paths: focus.paths.filter((f) => f != path) }));
    };

    const saveFocuses = (paths: Focus[]) => {
        props.superstate.spaceManager.saveFocuses(paths.filter((f) => f));
    };

    const refreshSpaces = (payload: { path: string }) => {
        if (props.superstate.spaceManager.isRenaming) return;
        if (currentFocusOf(props.superstate)?.paths?.includes(payload.path)) {
            setActiveViewSpaces((currentFocusOf(props.superstate)?.paths ?? []).map(pathStateForFocusPath).filter((f) => f));
        }
    };
    const reloadPaths = () => {
        if (props.superstate.spaceManager.isRenaming) return;
        setFocuses(props.superstate.focuses);
        setActiveFocus(currentFocusIndex(props.superstate));
        setFocusModeFocus(props.superstate.focusMode?.focus ?? null);
        setActiveViewSpaces((currentFocusOf(props.superstate)?.paths ?? []).map(pathStateForFocusPath).filter((f) => f));
    };

    useEffect(() => {
        props.superstate.eventsDispatcher.addListener("spaceStateUpdated", refreshSpaces);
        props.superstate.eventsDispatcher.addListener("settingsChanged", reloadPaths);
        props.superstate.eventsDispatcher.addListener("focusesChanged", reloadPaths);
        props.superstate.eventsDispatcher.addListener("superstateUpdated", reloadPaths);
        return () => {
            props.superstate.eventsDispatcher.removeListener("spaceStateUpdated", refreshSpaces);
            props.superstate.eventsDispatcher.removeListener("settingsChanged", reloadPaths);
            props.superstate.eventsDispatcher.removeListener("focusesChanged", reloadPaths);
            props.superstate.eventsDispatcher.removeListener("superstateUpdated", reloadPaths);
        };
    }, []);
    // The handlers above close over the latest state, so they get a new identity every
    // render; expose stable wrappers so the context value only changes with its data and
    // memoized consumers (tree rows) are not re-rendered for nothing.
    const latestHandlers = useRef({ saveFocuses, setActiveViewSpaceByPath, closeActiveViewSpace, updateActiveFocus });
    latestHandlers.current = { saveFocuses, setActiveViewSpaceByPath, closeActiveViewSpace, updateActiveFocus };
    const stableHandlers = useMemo(
        () => ({
            setFocuses: (paths: Focus[]) => latestHandlers.current.saveFocuses(paths),
            saveActiveSpace: (path: string) => latestHandlers.current.setActiveViewSpaceByPath(path),
            closeActiveSpace: (path: string) => latestHandlers.current.closeActiveViewSpace(path),
            updateCurrentFocus: (update: (focus: Focus) => Focus) => latestHandlers.current.updateActiveFocus(update),
        }),
        [],
    );
    const value = useMemo(
        () => ({
            dragPaths,
            setDragPaths,
            activeFocus,
            selectedPaths,
            setSelectedPaths,
            activePath,
            setActiveFocus,
            setActivePath,
            activeViewSpaces,
            currentFocus: activeFocus == FOCUS_MODE_INDEX ? focusModeFocus ?? undefined : focuses[activeFocus],
            updateCurrentFocus: stableHandlers.updateCurrentFocus,
            treeOrderRef,
            focuses,
            setFocuses: stableHandlers.setFocuses,
            saveActiveSpace: stableHandlers.saveActiveSpace,
            closeActiveSpace: stableHandlers.closeActiveSpace,
            modifier,
            setModifier,
            editFocus,
            setEditFocus,
        }),
        [dragPaths, activeFocus, focusModeFocus, selectedPaths, activePath, activeViewSpaces, focuses, modifier, editFocus, stableHandlers],
    );
    return <NavigatorContext.Provider value={value}>{props.children}</NavigatorContext.Provider>;
};
