import { describe, expect, it } from "vitest";
import type { EstimateModelRowModel } from "../api/types.gen.js";
import { buildModelRows } from "./model-table-model.js";

const estimated: EstimateModelRowModel = {
    providerId: "anthropic",
    modelId: "claude-sonnet-4-5-20250929",
    matchedAs: "claude-sonnet-4-5",
    electricityZone: "USA",
    status: "Estimated",
    co2eGrams: { min: 1.2, max: 8.4 },
    requests: 1200,
    outputTokens: 45000,
    warnings: [],
};
const unknown: EstimateModelRowModel = {
    providerId: "openai",
    modelId: "mystery-1",
    status: "UnknownModel",
    co2eGrams: null,
    requests: 3,
    outputTokens: 10,
    warnings: [],
};
const unsupported: EstimateModelRowModel = { ...unknown, modelId: "embed-1", status: "UnsupportedCapability" };

describe("Feature: by-model rows", () => {
    describe("Scenario: an estimated model", () => {
        it("formats requests, tokens and CO2e, and shows matched-as and zone", () => {
            expect(buildModelRows([estimated])[0]).toMatchObject({
                matchedAs: "claude-sonnet-4-5",
                zone: "USA",
                requests: "1,200",
                outputTokens: "45,000",
                co2e: "≈ 4.8 g CO2e",
                co2eRange: "1.2–8.4 g CO2e",
                status: "Estimated",
            });
        });
    });

    describe("Scenario: a model whose ends read the same", () => {
        it("has no range line", () => {
            const row = buildModelRows([{ ...estimated, co2eGrams: { min: 3, max: 3 } }])[0];
            expect([row.co2e, row.co2eRange]).toEqual(["3 g CO2e", ""]);
        });
    });

    describe("Scenario: an unknown model", () => {
        it("has no CO2e figure and keeps its status", () => {
            expect(buildModelRows([unknown])[0]).toMatchObject({ co2e: "—", co2eRange: "", matchedAs: "—", zone: "—", status: "UnknownModel" });
        });
    });

    describe("Scenario: an unsupported capability", () => {
        it("keeps its status and shows no CO2e", () => {
            expect(buildModelRows([unsupported])[0]).toMatchObject({ co2e: "—", co2eRange: "", status: "UnsupportedCapability" });
        });
    });

    describe("Scenario: row order and keys", () => {
        it("keeps the API order and keys rows by provider, model and status", () => {
            const rows = buildModelRows([unknown, estimated, unsupported]);
            expect(rows.map((r) => r.modelId)).toEqual(["mystery-1", "claude-sonnet-4-5-20250929", "embed-1"]);
            expect(rows[0].key).toBe("openai|mystery-1|UnknownModel");
        });

        it("gives the same model different keys for different statuses", () => {
            const keys = buildModelRows([unknown, { ...unknown, status: "UnsupportedCapability" }]).map((r) => r.key);
            expect(new Set(keys).size).toBe(2);
        });
    });
});
