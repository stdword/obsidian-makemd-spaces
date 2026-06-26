import { Superstate } from "makemd-core";
import { PathPropertyName, PathPropertyPinned } from "shared/types/context";
import { DBRow, SpaceTable } from "shared/types/mdb";
import { PathState } from "shared/types/PathState";
import { SpaceInfo } from "shared/types/spaceInfo";
import { insert } from "shared/utils/array";
import { defaultMDBTableForContext } from "../../../schemas/mdb";

export const pathStateToContextRow = (pathState: PathState): DBRow => {
    const file = pathState.metadata?.file ?? {};
    const isFolder = file.isFolder == true || pathState.type == "space" || pathState.subtype == "folder";
    const path = isFolder && pathState.path != "/" && !pathState.path.endsWith("/") ? `${pathState.path}/` : pathState.path;
    return {
        [PathPropertyName]: path,
        color: isFolder ? "" : (pathState.effectiveLabel?.color ?? pathState.label?.color ?? ""),
        [PathPropertyPinned]: "false",
    };
};

export const defaultTableDataForContext = (superstate: Superstate, space: SpaceInfo): SpaceTable => {
    const paths = [...superstate.getSpaceItems(space.path)];
    return {
        ...defaultMDBTableForContext(space),
        rows: paths.map(pathStateToContextRow),
    };
};

export const createNewRow = (mdb: SpaceTable, row: DBRow, index?: number) => {
    if (index) {
        return {
            ...mdb,
            rows: insert(mdb.rows, index, row),
        };
    }
    return {
        ...mdb,
        rows: [...mdb.rows, row],
    };
};

export const renameTagSpacePath = async (superstate: Superstate, tag: string, newTag: string) => {
    superstate.onTagRenamed(tag, newTag);
};
