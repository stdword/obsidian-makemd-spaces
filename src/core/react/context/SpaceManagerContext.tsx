import { Superstate } from "makemd-core";
import React, { createContext, useContext, useMemo } from "react";
import { PathState } from "shared/types/PathState";
import { SpaceManagerInterface } from "shared/types/spaceManager";
import { ContextState } from "shared/types/superstate";

type NavigatorSpaceManager = SpaceManagerInterface & {
  isPreviewMode: boolean;
  isMKitPath: (path: string) => boolean;
  convertMKitPath: (path: string) => string;
  getPathState: (path: string) => PathState | null;
  getPathsIndexMap: () => Map<string, PathState>;
  getContextsIndexMap: () => Map<string, ContextState>;
};

const SpaceManagerContext = createContext<NavigatorSpaceManager | null>(null);

export const SpaceManagerProvider: React.FC<
  React.PropsWithChildren<{ superstate: Superstate }>
> = ({ superstate, children }) => {
  const contextValue = useMemo<NavigatorSpaceManager>(() => {
    const manager = superstate.spaceManager as NavigatorSpaceManager;

    manager.isPreviewMode = false;
    manager.isMKitPath = () => false;
    manager.convertMKitPath = (path: string) => path;
    manager.getPathState = (path: string) =>
      superstate.pathsIndex.get(path) ?? null;
    manager.getPathsIndexMap = () => superstate.pathsIndex;
    manager.getContextsIndexMap = () => superstate.contextsIndex;

    return manager;
  }, [superstate]);

  return (
    <SpaceManagerContext.Provider value={contextValue}>
      {children}
    </SpaceManagerContext.Provider>
  );
};

export const useSpaceManager = (): NavigatorSpaceManager | null => {
  return useContext(SpaceManagerContext);
};

export const MKitSpaceManagerProvider = SpaceManagerProvider;
