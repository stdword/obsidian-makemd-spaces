import { savePathLabel } from "core/superstate/utils/label";
import { ISuperstate as Superstate } from "shared/types/superstate";

export const savePathSticker = async (
  superstate: Superstate,
  path: string,
  sticker: string
) => {
  return savePathLabel(superstate, path, "sticker", sticker);
};export const removeIconsForPaths = (superstate: Superstate, paths: string[]) => {
  paths.forEach((path) => {
    savePathSticker(superstate, path, "");
  });
};
