export const sanitizeSQLStatement = (name: string) => {
    try {
        return name?.replace(/'/g, `''`);
    } catch (e) {
        return "";
    }
};

const folderReservedRe = /^[+$#^]+/;
const illegalRe = /[/\\?<>:*|"]/g;
// eslint-disable-next-line no-control-regex
const controlRe = /[\x00-\x1f\x80-\x9f]/g;
// Windows refuses names that end in a dot or a space; this also turns "..." into "".
const trailingRe = /[. ]+$/;
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

export const UNNAMED_FILE = "Untitled";

const sanitizeName = (name: string, folder: boolean) => {
    let result = (name ?? "").replace(illegalRe, "").replace(controlRe, "").replace(trailingRe, "").trim();
    if (folder) result = result.replace(folderReservedRe, "");
    // Keep the user's word but make it a legal name instead of dropping it.
    if (windowsReservedRe.test(result)) result = `_${result}`;
    return result.length > 0 ? result : UNNAMED_FILE;
};

export const sanitizeFolderName = (name: string) => sanitizeName(name, true);
export const sanitizeFileName = (name: string) => sanitizeName(name, false);
