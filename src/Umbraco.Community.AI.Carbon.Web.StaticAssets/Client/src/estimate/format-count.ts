/** One shared English number style (thousands separators) for counts and figures. */
export const ENGLISH_NUMBER_FORMAT = new Intl.NumberFormat("en", { maximumFractionDigits: 20 });

const NOT_A_NUMBER = "–";

/** Formats a whole count such as requests or tokens, e.g. 12,345. Non-finite input gives "–". */
export function formatCount(value: number): string {
    return Number.isFinite(value) ? ENGLISH_NUMBER_FORMAT.format(value) : NOT_A_NUMBER;
}
