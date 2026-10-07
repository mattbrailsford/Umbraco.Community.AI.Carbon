import { describe, expect, it } from "vitest";
import type { EstimateFeatureItemModel } from "../api/types.gen.js";
import { buildFeatureRows } from "./feature-table-model.js";

const item = (featureType: string, requests: number, min: number, max: number): EstimateFeatureItemModel => ({
    featureType,
    requests,
    co2eGrams: { min, max },
});

describe("Feature: by-feature rows", () => {
    it("builds rows for agent, prompt and other with localized-name keys and formatted ranges, in API order", () => {
        const rows = buildFeatureRows([item("agent", 1200, 1.2, 8.4), item("prompt", 3, 0.5, 2), item("other", 1, 1, 1)]);
        expect(rows.map((r) => [r.key, r.labelKey, r.requests, r.co2e, r.co2eRange])).toEqual([
            ["agent", "aiCarbon_feature_agent", "1,200", "≈ 4.8 g CO2e", "1.2–8.4 g CO2e"],
            ["prompt", "aiCarbon_feature_prompt", "3", "≈ 1.3 g CO2e", "0.5–2 g CO2e"],
            ["other", "aiCarbon_feature_other", "1", "1 g CO2e", ""],
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
});
