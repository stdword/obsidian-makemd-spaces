export const eventTypes = {
    revealPath: "mkmd-reveal-file",
};

export type VaultChange = "create" | "delete" | "rename" | "modify" | "collapse";

export class CustomVaultChangeEvent extends Event {
    detail: {
        path: string;
        type?: VaultChange;
        oldPath?: string;
        onResult?: (found: boolean) => void;
    };
}
