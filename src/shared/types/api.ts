import { SpaceProperty } from "./mdb";
import { TargetLocation } from "./path";

export interface IAPI {
    properties: {
        color: (property: SpaceProperty, value: string) => string;
        sticker: (property: SpaceProperty) => string;
        value: (type: string, value: string) => string;
    };
    path: {
        open: (path: string, target?: TargetLocation) => void;
        create: (name: string, space: string, type: string, content?: Promise<string> | string) => void;
        setProperty: (path: string, property: string, value: Promise<string> | string) => void;
        contextMenu: (e: React.MouseEvent, path: string) => void;
    };
}
