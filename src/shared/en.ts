export const en = {
    hintText: {
        dragDropCopyModifierKey: "Hold Alt/Opt to copy",
        dragDropLinkModifierKey: "Hold Shift to link",
    },

    defaults: {
        spaceNote: "Current Note",
        spaceContext: "Current Space",
    },

    commandPalette: {
        openSpaces: "Open Spaces",
        revealFile: "Reveal File in Spaces",
        linkActiveFileToSpace: "Link Active File to Space",
    },

    menu: {
        up: "Up",
        down: "Down",
        selectmenu: "Selectmenu",
        toggle: "Toggle",
        setDefaultColor: "Color",
        setDefaultSticker: "Sticker",
        new: "New...",
        noColor: "No Color",
        thisElementWillHaveNoColorApplied: "This Element Will Have No Color Applied",
        yes: "Yes",
        no: "No",

        closeSpace: "Remove from Focus",
        openSpace: "Open",

        applyItems: "Apply to Sub-items",
        rename: "Rename",
        moveFile: "Move to...",
        wrapToFolder: "Wrap to Folder",
        pinToTop: "Pin to Top",
        unpin: "Unpin",
        visible: "Visible",
        duplicate: "Duplicate",
        archive: "Archive",

        delete: "Delete",
        collapseAllSections: "Collapse All Spaces",
        expandAllSections: "Expand All Spaces",
        settings: "Settings",

        sortBy: "Sort",

        hide: "Hide",
        excludeFromFocus: "Exclude from Focus",
        unhide: "Unhide",

        removeFromSpace: 'Unlink',

        customSort: "Custom Sort",
        groupSpaces: "Folders at the Top",
        groupSubtags: "Group by Sub-tags",
        recursiveSort: "Apply to Sub-folders",
        recursiveTagSort: "Apply to Sub-tags",
        fileNameSortAlphaAsc: "File Name (A to Z)",
        fileNameSortAlphaDesc: "File Name (Z to A)",
        createdTimeSortAsc: "Created Time (new to old)",
        createdTimeSortDesc: "Created Time (old to new)",
        modifiedTimeSortAsc: "Modified Time (new to old)",
        modifiedTimeSortDesc: "Modified Time (old to new)",
        clearSort: "Reset to Default",

        changeColor: "Color",

        openInATab: "Open in Tabs",
        openNativeMenu: "More options",
        revealInSpaces: "Reveal in Spaces",
        revealInDefault: "Reveal in Finder",
        revealInExplorer: "Reveal in Explorer",
    },

    buttons: {
        close: "Close",
        add: "Add",
        cancel: "Cancel",

        changeIcon: "Sticker",

        rename: "Change Name",
        createFolder: "Create Folder",
        createSeparator: "New Separator",
        createCanvas: "New Canvas",
        createDrawing: "New Drawing",
        createBase: "New Base",
        addIntoSpace: "Link Item",

        delete: "Delete",
        merge: "Merge",
        mergeInto: "Merge into...",
        addToSpace: "Link to...",
        wrap: "Wrap",

        addItem: "Add Item",

        save: "Save",
    },

    labels: {
        separator: "Separator",
        all: "all",
        folders: "folders",
        files: "files",
        tags: "tags",
        refs: "refs",

        filesCount: "{$1} Files",
        focus: "Focus",
        home: "Home",

        rename: "Rename",
        createFolder: "New Folder",
        createNote: "New Note",

        findStickers: "Enter sticker keyword",
        findStickersButton: "Find",

        manageHiddenFiles: "Manage Hidden Items",
        hiddenItems: "Hidden Items",
        hiddenPatterns: "Hide specific names, suffixes and extensions",
        hiddenPaths: "Hide specific paths",
        hideItemInputPlaceholder: "Enter search text here…",
        excludeItemInputPlaceholder: "Select files and folders to exclude…",
        addExtension: "Add Rule",

        manageExcludedFiles: "Manage Excluded Items",
        excludedItems: "Excluded from \"${1}\" Focus",
        excludedPaths: "Exclude specific paths",

        openItemInputPlaceholder: "Enter search text here…",
        linkItemInputPlaceholder: "Enter search text here…",
        optionItemSelectPlaceholder: "Select Option",

        saveView: "Save View",
        reorderIn: "Reorder in",

        archiveFocus: "Archive \"${1}\" Focus?",

        deleteFolder: "Delete Folder",
        deleteTag: "Delete Tag",
        mergeTag: "Merge Tag",
        deleteFiles: "Delete ${1} Files/Folders/Tags",
        deleteFile: "Delete File",
        addTo: "Add to",
        moveTo: "Move to",
        linkTo: "Link to",
        copyTo: "Copy to",

        openASpace: "Open a Space",
        openASpaceDesc: "Open existing folders and tags as a Space or create a new one",
    },

    descriptions: {
        deleteFolder: "Deleting the folder ${1} will also delete its contents.",
        deleteTag: "Deleting the tag ${1} will also delete its metadata (color, sorting options, etc.). It won’t remove any Obsidian tags from files.",
        mergeTag: "Merging ${1} into ${2} will combine their metadata, with ${1} taking precedence, and then delete the ${1} tag-space. It won’t remove any Obsidian tags from files.",
        deleteFiles: "Deleting the folders will also delete their contents.",
        deleteTags: "Deleting the tags will also delete their metadata (color, sorting options, etc.). It won’t remove any Obsidian tags from files.",
        deleteFile: "Delete the file ${1} from the vault?",
    },

    notice: {
        notFound: "Not found",
        fileExists: "File Already Exists",
        copyError: "Copy Error",
        reload: "Reload",

        emptyfolderName: "Folder name must be non-empty",
        duplicateFolderName: "This folder already exist",
        cannotLinkToOwnFolder: "Item is already in this folder",
        noPropertyName: "No Property Name",

        somethingWentWrong: "Something Went Wrong",
        itemJustHidden: "Item is now hidden. You can manage hidden items in the Spaces menu",
    },

    settings: {
        sections: {
            appearance: "Appearance",
            system: "System",
        },

        spaceRowHeight: {
            name: "Row Height",
            desc: "The height for each row (in pixels), default is 29",
        },
        searchMenuTagsLimit: {
            name: "Search Menu Tag Limit",
            desc: "Maximum tag suggestions in search menus. Leave empty to show all tags",
        },
        searchMenuFoldersLimit: {
            name: "Search Menu Folder Limit",
            desc: "Maximum folder suggestions in search menus. Leave empty to show all folders",
        },
        searchMenuFilesLimit: {
            name: "Search Menu File Limit",
            desc: "Maximum file suggestions in search menus. Leave empty to show all files",
        },
        searchMenuRefsLimit: {
            name: "Search Menu Ref Limit",
            desc: "Maximum ref suggestions in search menus. Leave empty to show all refs",
        },
        folderIndentationLines: {
            name: "Show Folder Indentation Lines",
            desc: "Turn on to show a line on the left of folders to indicate indentation",
        },
        defaultSpaceSort: {
            name: "Sort Order (by default)",
            desc: "Sort order used when a space does not define its own sort",
        },
        defaultFoldersAtTop: {
            name: "Show Folders at the Top (by default)",
            desc: "Place folders before files when a space does not define its own setting",
        },
        defaultGroupBySubtags: {
            name: "Group Tag-Spaces by Subtags (by default)",
            desc: "Show hierarchical tags as nested tag spaces unless a tag space overrides this setting",
        },
        openSpacesOnLaunch: {
            name: "Open Spaces as Default Tab",
            desc: "Open the Spaces tab when Obsidian launches",
        },
        overrideNativeMenu: {
            name: "Use Obsidian Context Menu",
            desc: "Show the Obsidian context menu instead of Spaces",
        },
        expandFolderOnClick: {
            name: "Auto Expand Folder",
            desc: "Auto expand folders on click",
        },
        revealActiveFile: {
            name: "Reveal Active File",
            desc: "Automatically reveal the active file in Spaces",
        },
        deleteFileOption: {
            name: "Delete File Option",
            desc: "Select how you want files to be deleted",
        },

        spacesDeleteOptions: {
            permanent: "Permanent",
            trash: "Trash",
            "system-trash": "System Trash",
        },
    },

    colors: {
        base0: "Base0",
        base10: "Base10",
        base20: "Base20",
        base30: "Base30",
        base40: "Base40",
        base50: "Base50",
        base60: "Base60",
        base70: "Base70",
        base80: "Base80",
        base90: "Base90",
        base100: "Base100",

        red: "Red",
        pink: "Pink",
        orange: "Orange",
        yellow: "Yellow",
        green: "Green",
        turquoise: "Turquoise",
        teal: "Teal",
        blue: "Blue",
        purple: "Purple",
        brown: "Brown",
        charcoal: "Charcoal",
        gray: "Gray",

        lightPink: "Light Pink",
        gold: "Gold",
        paleGreen: "Pale Green",
        skyBlue: "Sky Blue",
        plum: "Plum",
        khaki: "Khaki",
        lightSalmon: "Light Salmon",
        powderBlue: "Powder Blue",
        moccasin: "Moccasin",
        lavender: "Lavender",
    },
};
