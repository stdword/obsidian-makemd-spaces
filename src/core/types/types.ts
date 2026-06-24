export const eventTypes = {
    refreshView: "mkmd-refresh-view",
    revealPath: "mkmd-reveal-file",
    collapseFolders: "mkmd-collapse-folders",
    toggleBacklinks: "mkmd-toggle-backlinks",
    metadataChange: "mkmd-tags-change",
    vaultChange: "mkmd-vault-change",
    mdbChange: "mkmd-mdb-change",
    spacesChange: "mkmd-spaces-change",
    updateSections: "mkmd-update-sections",
    settingsChanged: "mkmd-settings-changed",
};

export type VaultChange = "create" | "delete" | "rename" | "modify" | "collapse";

export class CustomVaultChangeEvent extends Event {
    detail: {
        type: VaultChange;
        path: string;
        oldPath?: string;
    };
}
