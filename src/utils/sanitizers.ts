export const sanitizeSQLStatement = (name: string) => {
    try {
        return name?.replace(/'/g, `''`);
    } catch (e) {
        return "";
    }
};

const folderReservedRe = /^[+\$#^]+/;
const illegalRe = /[\/\?<>\\:\*\|":]/g;
const controlRe = /[\x00-\x1f\x80-\x9f]/g;
const reservedRe = /^\.+$/;
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

export const sanitizeFolderName = (name: string) => {
    return name
        .replace(folderReservedRe, "")
        .replace(illegalRe, "")
        .replace(controlRe, "")
        .replace(reservedRe, "")
        .replace(windowsReservedRe, "");
};
export const sanitizeFileName = (name: string) => {
    return name
        .replace(illegalRe, "")
        .replace(controlRe, "")
        .replace(reservedRe, "")
        .replace(windowsReservedRe, "");
};
