import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { rankForDropPositionInSpace } from "core/utils/dnd/dropPath";
import { DragProjection } from "core/utils/dnd/dragPath";
import { TreeNode, effectiveSpaceSort, saveSpaceMetadataValue, uniqueRankOrder } from "core/utils/superstate/spaces";
import { ensureArray } from "core/utils/schema";


export const splitDroppedFileName = (filename: string) => {
    if (filename.endsWith(".excalidraw.md")) {
        return { name: filename.slice(0, -".excalidraw.md".length), suffix: ".excalidraw.md" };
    }
    const suffixStart = filename.lastIndexOf(".");
    // A leading dot is part of the name (`.gitignore`), not a suffix.
    if (suffixStart <= 0) return { name: filename, suffix: "" };
    return { name: filename.slice(0, suffixStart), suffix: filename.slice(suffixStart) };
};

export const uniqueDroppedFileName = (filename: string, existingNames: string[]) => {
    if (!existingNames.includes(filename)) return filename;
    const { name, suffix } = splitDroppedFileName(filename);
    let append = 1;
    let candidate = `${name} ${append}${suffix}`;
    while (existingNames.includes(candidate)) {
        append += 1;
        candidate = `${name} ${append}${suffix}`;
    }
    return candidate;
};

export const isExternalFileDrag = (e?: { dataTransfer?: { types?: any } }): boolean => {
    const types = e?.dataTransfer?.types;
    if (!types) return false;
    // `DataTransfer.types` is a DOMStringList in some engines, not an Array.
    if (typeof types.contains == "function") return types.contains("Files");
    return Array.prototype.some.call(types, (type: string) => type == "Files");
};

export const EXTERNAL_DRAG_NODE: TreeNode = {
    id: "$external-drag$",
    parentId: "$external-drag-parent$",
    depth: 1,
    index: 0,
    space: "$external-drag-parent$",
    path: "$external-drag$",
    item: { path: "$external-drag$", parent: "$external-drag-parent$" } as TreeNode["item"],
    type: "file",
    childrenCount: 0,
    collapsed: false,
    rank: 0,
    sortable: true,
};

export interface ExternalDropFile {
    name: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
}

export const dropExternalFilesInSpace = async (superstate: Superstate, files: ExternalDropFile[], spacePath: string, rankTarget?: { node: TreeNode; position: "top" | "bottom" } | null) => {
    if (!spacePath || files.length == 0) return;

    const space = superstate.spacesIndex.get(spacePath);
    if (!space || (space.type != "folder" && space.type != "vault")) {
        superstate.ui.notify(i18n.notice.cannotCopyToVirtualSpace);
        return;
    }

    const existingNames: string[] = ((await superstate.spaceManager.childrenForPath(spacePath).catch((): string[] => [])) ?? []).map((path) => path.split("/").pop());
    const writtenPaths: string[] = [];

    for (const file of files) {
        const name = uniqueDroppedFileName(file.name, existingNames);
        const newPath = `${spacePath}/${name}`;
        try {
            const buffer = await file.arrayBuffer();
            await superstate.spaceManager.writeToPath(newPath, buffer, true);
            existingNames.push(name);
            writtenPaths.push(newPath);
        } catch (e) {
            superstate.ui.notify(`${i18n.notice.copyFileFailed}: ${file.name}`);
            superstate.ui.error(e);
        }
    }

    if (!rankTarget || writtenPaths.length == 0) return;
    if (effectiveSpaceSort(space.metadata?.sort, superstate.settings).field != "rank") return;
    const insertionRank = rankForDropPositionInSpace(superstate, writtenPaths[0], spacePath, rankTarget.node, rankTarget.position);
    if (insertionRank == null) return;

    const storedOrder = ensureArray(space.metadata?.["rank-order"]);
    const displayedPaths = superstate.getSpaceItems?.(spacePath)?.map((item) => item.path) ?? [];
    const currentOrder = uniqueRankOrder([...storedOrder, ...displayedPaths.filter((path) => !storedOrder.includes(path))]);

    const nextOrder = currentOrder.filter((path) => !writtenPaths.includes(path));
    nextOrder.splice(Math.max(0, Math.min(insertionRank, nextOrder.length)), 0, ...writtenPaths);
    await saveSpaceMetadataValue(superstate, spacePath, "rank-order", uniqueRankOrder(nextOrder));
};


const nodeIsAncestorOf = (ancestor: TreeNode, node: TreeNode) => node.id == ancestor.id || String(node.id).startsWith(`${ancestor.id}/`);

export const dropExternalFilesAtProjection = async (superstate: Superstate, files: ExternalDropFile[], projection: DragProjection | null, flattenedTree: TreeNode[]) => {
    if (!projection || files.length == 0) return false;
    const parentId = projection.insert ? projection.overId : projection.parentId;
    const parentNode = flattenedTree.find((node) => node.id == parentId);
    const spacePath = parentNode?.item?.path;
    if (!spacePath) return false;
    const overNode = projection.linePosition ? flattenedTree.find((node) => node.id == projection.overId) : null;

    const rankNode = overNode && overNode.parentId != parentId ? flattenedTree.find((node) => node.depth == projection.depth && nodeIsAncestorOf(node, overNode)) ?? overNode : overNode;
    const rankTarget = rankNode ? { node: rankNode, position: projection.linePosition } : null;
    await dropExternalFilesInSpace(superstate, files, spacePath, rankTarget);
    return true;
};
