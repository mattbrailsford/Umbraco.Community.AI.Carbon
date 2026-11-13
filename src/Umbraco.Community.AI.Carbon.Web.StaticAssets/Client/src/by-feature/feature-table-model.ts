import type { UauiTableColumn } from "@umbraco/analytics-ui";
import { UAUI_TABLE_CELL } from "@umbraco/analytics-ui";
import { CO2E_CELL } from "../co2e-cell/co2e-cell.name.js";
import type { EstimateFeatureItemModel } from "../api/types.gen.js";
import { formatCo2eFigure } from "../estimate/format-co2.js";
import { rangeMidpoint } from "../estimate/range-midpoint.js";
import type { LocalizeWithDefault } from "../estimate/warning-text.js";

/** One row of the by-feature table. It is also the row handed to `uaui-data-table`, so field names are column keys. */
export type FeatureRowViewModel = {
    /** The API's feature type, also the row's identity (the table's `row-key`). */
    key: string;
    /** Localization key for the friendly name, or undefined for a type the package doesn't know. */
    labelKey?: string;
    /** Shown when the localized name is missing: the English name, or the raw feature type if unknown. */
    fallbackLabel: string;
    /** The name shown in the Feature column: filled in by the element, which owns localization. */
    feature?: string;
    requests: number;
    /** The headline figure with its unit, e.g. "≈ 1.5 g CO2e". */
    co2e: string;
    /** The range as small text, e.g. "1–2 g CO2e"; empty when the ends read the same. */
    co2eRange: string;
    /** The middle of the range in grams, for sorting. */
    co2eMid?: number;
};

/** Feature types with a friendly name (and its English default); anything else shows its raw value. */
export const KNOWN_FEATURES: ReadonlyMap<string, string> = new Map([
    ["agent", "Agents"],
    ["prompt", "Prompts"],
    ["inline-chat", "Inline chat"],
    ["inline-agent", "Inline agents"],
    ["other", "Other"],
]);

/** The column the table starts sorted by: the estimate's midpoint, biggest first. */
export const FEATURE_TABLE_DEFAULT_SORT = { key: "co2eMid", direction: "desc" } as const;

/** Turns API items into table rows, in the API's order. Pure, so it can be tested without rendering. */
export function buildFeatureRows(items: readonly EstimateFeatureItemModel[]): FeatureRowViewModel[] {
    return items.map((item) => {
        const figure = formatCo2eFigure(item.co2eGrams);
        return {
            key: item.featureType,
            labelKey: KNOWN_FEATURES.has(item.featureType) ? `aiCarbon_feature_${item.featureType}` : undefined,
            fallbackLabel: KNOWN_FEATURES.get(item.featureType) ?? item.featureType,
            requests: item.requests,
            co2e: figure.centralText,
            co2eRange: figure.range,
            co2eMid: rangeMidpoint(item.co2eGrams),
        };
    });
}

/** The compared period's rows, cut down to the row's key and CO2e midpoint: the only column that gets a change badge (more requests is not "better" on a CO2 page). */
export function buildFeatureCompareRows(items: readonly EstimateFeatureItemModel[]): Array<Pick<FeatureRowViewModel, "key" | "co2eMid">> {
    return buildFeatureRows(items).map(({ key, co2eMid }) => ({ key, co2eMid }));
}

/** Adds each row's localized name as `feature`, the field the Feature column reads. */
export function withFeatureNames(rows: readonly FeatureRowViewModel[], t: LocalizeWithDefault): FeatureRowViewModel[] {
    return rows.map((row) => ({ ...row, feature: row.labelKey ? t(row.labelKey, row.fallbackLabel) : row.fallbackLabel }));
}

/**
 * The table's columns. Requests shows a share bar (requests are counted, not estimated). CO2e has no
 * share: a percentage of a range would imply precision the estimate doesn't have.
 */
export function buildFeatureColumns(t: LocalizeWithDefault): UauiTableColumn[] {
    return [
        {
            key: "feature",
            label: t("aiCarbon_byFeature_feature", "Feature"),
            elementName: UAUI_TABLE_CELL.text,
            sortable: true,
        },
        {
            key: "requests",
            label: t("aiCarbon_byFeature_requests", "Requests"),
            elementName: UAUI_TABLE_CELL.share,
            align: "end",
            sortable: true,
            sortAs: "number",
        },
        {
            key: FEATURE_TABLE_DEFAULT_SORT.key,
            label: t("aiCarbon_byFeature_co2e", "Estimated CO2e"),
            elementName: CO2E_CELL,
            align: "end",
            sortable: true,
            sortAs: "number",
            // Less CO2e than the compared period is the good direction, for the cell's compare badge.
            meta: { lowerIsBetter: true },
        },
    ];
}
