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
        new: "New",
        noColor: "No Color",
        thisElementWillHaveNoColorApplied: "This Element Will Have No Color Applied",
        yes: "Yes",
        no: "No",

        closeSpace: "Remove from Focus",
        openSpace: "Open",

        applyItems: "Apply to Items in Folder",
        rename: "Rename",
        moveFile: "Move to...",
        pinToTop: "Pin to Top",
        unpin: "Unpin",
        duplicate: "Duplicate",

        delete: "Delete",
        collapseAllSections: "Collapse All Spaces",
        expandAllSections: "Expand All Spaces",
        settings: "Settings",

        sortBy: "Sort",

        hide: "Hide",
        unhide: "Unhide",

        removeFromSpace: 'Unlink from "${1}"',

        customSort: "Custom Sort",
        groupSpaces: "Folders at the Top",
        recursiveSort: "Apply to Subfolders",
        fileNameSortAlphaAsc: "File Name (A to Z)",
        fileNameSortAlphaDesc: "File Name (Z to A)",
        createdTimeSortAsc: "Created Time (new to old)",
        createdTimeSortDesc: "Created Time (old to new)",
        modifiedTimeSortAsc: "Modified Time (new to old)",
        modifiedTimeSortDesc: "Modified Time (old to new)",
        clearSort: "Reset to Default",

        changeColor: "Color",

        openFilePane: "Open File Pane",
        openNativeMenu: "More options",
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
        createCanvas: "New Canvas",
        createDrawing: "New Drawing",
        createBase: "New Base",
        addIntoSpace: "Link Item",

        delete: "Delete",
        addToSpace: "Link to...",

        addFile: "Add File",

        save: "Save",
    },

    labels: {
        all: "all",
        folders: "folders",
        files: "files",
        tags: "tags",
        refs: "refs",

        filesCount: "{$1} Files",
        filesAndFolders: "Files and Folders",
        waypoint: "Waypoint",
        home: "Home",

        rename: "Rename",
        createFolder: "New Folder",
        createNote: "New Note",

        findStickers: "Enter sticker keyword",
        findStickersButton: "Find",

        hiddenFiles: "Hidden Files",
        manageHiddenFiles: "Manage Hidden Files",
        hiddenFilePattern: "Name, Suffixes and Extension",
        hiddenFileSpecific: "Exclude specific files and folders",
        hideItemInputPlaceholder: "Enter search text here…",
        addExtension: "Add Rule",

        openItemInputPlaceholder: "Enter search text here…",
        linkItemInputPlaceholder: "Enter search text here…",
        optionItemSelectPlaceholder: "Select Option",

        saveView: "Save View",
        reorderIn: "Reorder in",

        closeFocus: "Close \"${1}\" Focus?",

        deleteFolder: "Delete Folder",
        deleteFiles: "Delete Files",
        deleteFile: "Delete File/Folder",
        moveTo: "Move to",
        linkTo: "Link to",
        copyTo: "Copy to",

        openASpace: "Open a Space",
        openASpaceDesc: "Open existing folders and tags as a Space or create a new one",
    },

    descriptions: {
        deleteFolder: "Deleting the folder will also delete its contents.",
        deleteFiles: "Delete ${1} files/folders and their contents?",
        deleteFile: "Delete file/folder and its contents?",

        hiddenFileOptions: "Hidden File Options",
    },

    notice: {
        fileExists: "File Already Exists",
        copyError: "Copy Error",
        reload: "Reload",

        emptyfolderName: "Folder name must be non-empty",
        duplicateFolderName: "This folder already exist",
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
        pinnedSeparatorLine: {
            name: "Show Pin Separator Line",
            desc: "Turn on to show a dashed line after pinned items",
        },
        defaultSpaceSort: {
            name: "Sort Order (by default)",
            desc: "Sort order used when a space does not define its own sort",
        },
        defaultFoldersAtTop: {
            name: "Show Folders at the Top (by default)",
            desc: "Place folders before files when a space does not define its own setting",
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
