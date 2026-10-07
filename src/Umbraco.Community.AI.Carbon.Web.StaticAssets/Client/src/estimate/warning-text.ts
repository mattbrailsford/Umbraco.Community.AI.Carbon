/**
 * Plain-English text for the warning codes a by-model row can carry: the EcoLogits codes found in
 * the embedded data (models.json, electricity_mixes.json) plus the package's own codes (see
 * `ModelFactorLookup` in Core).
 */
const WARNING_TEXT: Readonly<Record<string, string>> = {
    // models.json
    "model-arch-not-released":
        "This model's size isn't published, so its size is estimated and the range is wide.",
    "model-arch-multimodal":
        "This is a multimodal model, so the estimate is less precise (it is based on text output only).",
    // electricity_mixes.json
    "electricity-mix-wue-world":
        "No water-use data for this electricity zone, so a world average was used for water.",
    "electricity-mix-adpe-world":
        "No resource-depletion data for this electricity zone, so a world average was used.",
    "electricity-mix-pe-world":
        "No primary-energy data for this electricity zone, so a world average was used.",
    // this package
    "invalid-model-data": "The reference data for this model is invalid, so it could not be estimated.",
    "missing-provider-data": "There is no reference data for this provider, so it could not be estimated.",
};

/** Looks up a localized term, returning the fallback on a miss (`termOrDefault`-shaped). */
export type LocalizeWithDefault = (key: string, fallback: string) => string;

const keepFallback: LocalizeWithDefault = (_key, fallback) => fallback;

/** Localization key for a warning code, as `aiCarbon_warning_<code>`. */
export function warningKey(code: string): string {
    return `aiCarbon_warning_${code}`;
}

/**
 * Plain-English text for a warning code. Pure, with English text built in. Pass `localize` (the
 * element's `termOrDefault`) to use translations, with the English as the fallback. An unknown
 * code comes back as the raw code, so a warning is never hidden.
 */
export function describeWarning(code: string, localize: LocalizeWithDefault = keepFallback): string {
    const english = WARNING_TEXT[code];
    return english === undefined ? code : localize(warningKey(code), english);
}

/** Every code with built-in text; used to keep the language file and tests in step. */
export const KNOWN_WARNING_CODES: readonly string[] = Object.keys(WARNING_TEXT);
