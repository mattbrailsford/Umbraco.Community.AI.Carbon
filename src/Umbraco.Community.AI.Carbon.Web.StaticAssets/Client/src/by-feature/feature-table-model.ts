import type { EstimateFeatureItemModel } from "../api/types.gen.js";
import { formatCo2eRange } from "../estimate/format-co2.js";
import { formatCount } from "../estimate/format-count.js";

export interface FeatureRowViewModel {
    /** The API's feature type, also the row's identity. */
    key: string;
    /** Localization key for the friendly name, or undefined for a type the package doesn't know. */
    labelKey?: string;
    /** Shown when the localized name is missing: the English name, or the raw feature type if unknown. */
    fallbackLabel: string;
    requests: string;
    co2e: string;
}

/** Feature types with a friendly name (and its English default); anything else shows its raw value. */
export const KNOWN_FEATURES: ReadonlyMap<string, string> = new Map([
    ["agent", "Agents"],
    ["prompt", "Prompts"],
    ["inline-chat", "Inline chat"],
    ["inline-agent", "Inline agents"],
    ["other", "Other"],
]);

/** Turns API items into display rows, in the API's order. Pure, so it can be tested without rendering. */
export function buildFeatureRows(items: readonly EstimateFeatureItemModel[]): FeatureRowViewModel[] {
    return items.map((item) => ({
        key: item.featureType,
        labelKey: KNOWN_FEATURES.has(item.featureType) ? `aiCarbon_feature_${item.featureType}` : undefined,
        fallbackLabel: KNOWN_FEATURES.get(item.featureType) ?? item.featureType,
        requests: formatCount(item.requests),
        co2e: formatCo2eRange(item.co2eGrams),
    }));
}
