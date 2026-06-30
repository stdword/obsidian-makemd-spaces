export const eventTypes = {
    revealPath: "mkmd-reveal-file",
};

export type VaultChange = "create" | "delete" | "rename" | "modify" | "collapse";

export class CustomVaultChangeEvent extends Event {
    detail: {
        type: VaultChange;
        path: string;
        oldPath?: string;
    };
}
