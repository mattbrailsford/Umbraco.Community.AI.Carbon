import { describe, expect, it } from "vitest";
import type { EstimateFeatureItemModel } from "../api/types.gen.js";
import { buildFeatureColumns, buildFeatureRows, withFeatureNames } from "./feature-table-model.js";

const item = (featureType: string, requests: number, min: number, max: number): EstimateFeatureItemModel => ({
    featureType,
    requests,
    co2eGrams: { min, max },
});

describe("Feature: by-feature rows", () => {
    it("builds rows for agent, prompt and other with localized-name keys and formatted ranges, in API order", () => {
        const rows = buildFeatureRows([item("agent", 1200, 1.2, 8.4), item("prompt", 3, 0.5, 2), item("other", 1, 1, 1)]);
        expect(rows.map((r) => [r.key, r.labelKey, r.requests, r.co2e, r.co2eRange])).toEqual([
            ["agent", "aiCarbon_feature_agent", 1200, "≈ 4.8 g CO2e", "1.2–8.4 g CO2e"],
            ["prompt", "aiCarbon_feature_prompt", 3, "≈ 1.3 g CO2e", "0.5–2 g CO2e"],
            ["other", "aiCarbon_feature_other", 1, "1 g CO2e", ""],
        ]);
    });

    it("gives inline types their own name keys", () => {
        const rows = buildFeatureRows([item("inline-chat", 1, 1, 2), item("inline-agent", 1, 1, 2)]);
        expect(rows.map((r) => r.labelKey)).toEqual(["aiCarbon_feature_inline-chat", "aiCarbon_feature_inline-agent"]);
    });

    it("falls back to the raw value for an unknown future type", () => {
        const [row] = buildFeatureRows([item("brand-new", 1, 1, 2)]);
        expect(row.labelKey).toBeUndefined();
        expect(row.fallbackLabel).toBe("brand-new");
    });

    it("has the middle of the range as its sort value", () => {
        expect(buildFeatureRows([item("agent", 1, 2, 10)])[0].co2eMid).toBe(6);
    });

    it("names rows with the localized name, or the English default, or the raw value for an unknown type", () => {
        const rows = withFeatureNames(buildFeatureRows([item("agent", 1, 1, 2), item("brand-new", 1, 1, 2)]), (key, fallback) =>
            key === "aiCarbon_feature_agent" ? "Agenter" : fallback,
        );
        expect(rows.map((r) => r.feature)).toEqual(["Agenter", "brand-new"]);
    });
});

describe("Feature: by-feature columns", () => {
    const columns = buildFeatureColumns((_key, fallback) => fallback);

    it("has the feature, requests (with share bars) and CO2e columns", () => {
        expect(columns.map((c) => [c.key, c.label, c.elementName])).toEqual([
            ["feature", "Feature", "uaui-text-cell"],
            ["requests", "Requests", "uaui-share-cell"],
            ["co2eMid", "Estimated CO2e", "aicarbon-co2e-cell"],
        ]);
    });

    it("sorts every column, and marks none searchable (there is no search field)", () => {
        expect(columns.every((c) => c.sortable)).toBe(true);
        expect(columns.some((c) => c.searchable)).toBe(false);
    });

    it("does not reserve warning space in the CO2e column", () => {
        expect((columns[2] as { reserveWarningSpace?: boolean }).reserveWarningSpace).toBeUndefined();
    });
});
