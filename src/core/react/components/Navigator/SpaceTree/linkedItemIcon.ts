import { TreeNode } from "core/superstate/utils/spaces";
import { isTagSpacePath, tagsSpacePath } from "schemas/builtin";
import { PathState } from "shared/types/PathState";

export const linkedItemIconPathState: PathState = {
    path: "",
    name: "linked",
    type: "file",
    label: { sticker: "lucide//link-2", color: "" },
};

export const pinnedItemIconPathState: PathState = {
    path: "",
    name: "pinned",
    type: "file",
    label: { sticker: "lucide//pin", color: "" },
};

export const shouldShowLinkedItemIcon = (data: Pick<TreeNode, "space" | "item" | "depth">) => {
    if (data.depth <= 0 || isTagSpacePath(data.space)) return false;
    if (data.item?.linkedSpaces?.includes(data.space)) return true;
    if (data.item?.parent != null && data.item.parent != "" && data.item.parent != data.space) return true;
    return isTagSpacePath(data.item?.path) && data.space != data.item?.path && data.space != tagsSpacePath;
}

export const shouldShowPinnedItemIcon = (data: Pick<TreeNode, "pinned">) => {
    return data.pinned;
}
