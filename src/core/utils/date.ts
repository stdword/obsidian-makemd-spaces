import { format, parseISO } from "date-fns";
import { isDate, isFinite, isString } from "lodash";

const defaultDateFormat = "MMM dd yyyy"
const defaultTimeFormat = "h:mm a"

export const formatDate = (date: Date, dateFormat?: string) => {
    let dateString;

    try {
        const hasTime = date.getHours() > 0 || date.getMinutes() > 0 || date.getSeconds() > 0;
        dateString = format(date, dateFormat?.length > 0 ? dateFormat : hasTime ? `${defaultDateFormat} ${defaultTimeFormat}` : defaultDateFormat);
    } catch (e) {
        dateString = "";
    }
    return dateString;
};

export const parseDate = (str: any) => {
    if (!str) return null;
    if (isFinite(str)) {
        return new Date(str);
    }
    if (isString(str)) {
        // Handle date-only strings (yyyy-MM-dd) as local dates to avoid timezone shift
        // parseISO treats these as UTC which can cause off-by-one day issues
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [year, month, day] = str.split("-").map(Number);
            return new Date(year, month - 1, day);
        }
        return parseISO(str);
    }
    if (isDate(str)) return str;
    return null;
};
