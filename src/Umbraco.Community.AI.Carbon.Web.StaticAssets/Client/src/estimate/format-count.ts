import { NO_VALUE } from "./no-value.js";

/** One shared English number style (thousands separators) for counts and figures. */
export const ENGLISH_NUMBER_FORMAT = new Intl.NumberFormat("en", { maximumFractionDigits: 20 });


/** Formats a whole count such as requests or tokens, e.g. 12,345. Non-finite input gives "—". */
export function formatCount(value: number): string {
    return Number.isFinite(value) ? ENGLISH_NUMBER_FORMAT.format(value) : NO_VALUE;
}
