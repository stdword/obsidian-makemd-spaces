import { PathLabel } from "./caches";
import { DBRow, SpaceProperty } from "./mdb";
import { TargetLocation } from "./path";

export interface IAPI {
    properties: {
        color: (property: SpaceProperty, value: string) => string;
        sticker: (property: SpaceProperty) => string;
        value: (type: string, value: string) => string;
    };
    path: {
        label: (path: string) => PathLabel | undefined;
        open: (path: string, target?: TargetLocation) => void;
        create: (name: string, space: string, type: string, content?: Promise<string> | string) => void;
        setProperty: (path: string, property: string, value: Promise<string> | string) => void;
        contextMenu: (e: React.MouseEvent, path: string) => void;
    };
    table: {
        select: (path: string, table: string) => Promise<DBRow[] | undefined>;
        update: (path: string, table: string, index: number, row: DBRow) => void;
        insert: (path: string, schema: string, row: DBRow) => Promise<void>;
        create: (path: string, table: string, properties: SpaceProperty[]) => void;
        open: (space: string, table: string, index: number, target?: TargetLocation) => Promise<void>;
        contextMenu: (e: React.MouseEvent, space: string, table: string, index: number) => Promise<void>;
    };
    context: {
        select: (path: string, table: string) => Promise<DBRow[] | undefined>;
        update: (path: string, file: string, field: string, value: string) => void;
        insert: (path: string, schema: string, name: string, row: DBRow) => Promise<void>;
    };
}
