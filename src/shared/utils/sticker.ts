import { saveSpaceMetadataValue } from "core/superstate/utils/spaces";
import { ISuperstate as Superstate } from "shared/types/superstate";

export const savePathSticker = async (
  superstate: Superstate,
  path: string,
  sticker: string
) => {
  const pathState = superstate.pathsIndex.get(path);
  if (!pathState) return;
  const isFolder = pathState.type == "space" || pathState.subtype == "folder" || pathState.metadata?.file?.isFolder;
  if (isFolder) {
    return saveSpaceMetadataValue(superstate as any, path, "defaultSticker", sticker);
  }
  superstate.pathsIndex.set(path, {
    ...pathState,
    label: {
      ...pathState.label,
      sticker,
    },
  });
  superstate.dispatchEvent("pathStateUpdated", { path });
};export const removeIconsForPaths = (superstate: Superstate, paths: string[]) => {
  paths.forEach((path) => {
    savePathSticker(superstate, path, "");
  });
};
