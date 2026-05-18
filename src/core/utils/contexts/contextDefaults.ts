import { deletePath } from "core/superstate/utils/path";
import { folderForTagSpace } from "core/utils/spaces/space";
import { pathToParentPath } from "core/utils/strings";
import { Superstate } from "makemd-core";
import { PathPropertyName } from "shared/types/context";
import { DBRow, SpaceTable } from "shared/types/mdb";
import { SpaceInfo } from "shared/types/spaceInfo";
import { insert } from "shared/utils/array";
import { defaultMDBTableForContext } from "../../../schemas/mdb";
import { formatDate, parseDate } from "../date";

export const defaultTableDataForContext = (superstate: Superstate, space: SpaceInfo): SpaceTable => {
    const paths = [...superstate.getSpaceItems(space.path)];
    return {
        ...defaultMDBTableForContext(space),
        rows: paths.map((f) => ({ [PathPropertyName]: f.path, Created: formatDate(parseDate(f.metadata?.ctime), "yyyy-MM-dd") })),
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
    const spacePath = folderForTagSpace(tag, superstate.settings);

    if (await superstate.spaceManager.pathExists(spacePath)) {
        superstate.spaceManager.renamePath(spacePath, pathToParentPath(spacePath) + "/" + newTag);
    } else {
        deletePath(superstate, spacePath);
    }
    superstate.onTagRenamed(tag, newTag);
};
