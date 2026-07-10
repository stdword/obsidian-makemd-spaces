export type PathRefTypes = "context" | "action" | "vis" | "block" | "heading" | "unknown";

export type URI = {
    basePath: string;
    scheme: string;
    path: string;
    authority: string;

    fullPath: string;
    alias?: string;
    ref?: string;
    refStr?: string;
    refType?: PathRefTypes;
    query?: { [key: string]: string };
    isRemote?: boolean;
    trailSlash: boolean;
};
export type TargetLocation = "split" | "window" | "tab" | "left" | "right" | "system" | "hover" | boolean;
