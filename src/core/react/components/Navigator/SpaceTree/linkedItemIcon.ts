import { TreeNode } from "core/superstate/utils/spaces";
import { isTagSpacePath } from "schemas/builtin";
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
    return data.depth > 0 && data.item?.parent != null && data.item.parent != "" && data.item.parent != data.space && !isTagSpacePath(data.space);
}

export const shouldShowPinnedItemIcon = (data: Pick<TreeNode, "pinned">) => {
    return data.pinned;
}
