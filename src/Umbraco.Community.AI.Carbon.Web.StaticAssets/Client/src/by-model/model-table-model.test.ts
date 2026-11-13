import { describe, expect, it } from "vitest";
import type { EstimateModelRowModel } from "../api/types.gen.js";
import { buildModelColumns, buildModelRows, MODEL_ROW_KEY, type ModelRowViewModel } from "./model-table-model.js";

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
        it("keeps counts as numbers, formats CO2e, and shows matched-as and zone", () => {
            expect(buildModelRows([estimated])[0]).toMatchObject({
                matchedAs: "claude-sonnet-4-5",
                zone: "USA",
                requests: 1200,
                outputTokens: 45000,
                co2e: "≈ 4.8 g CO2e",
                co2eRange: "1.2–8.4 g CO2e",
                status: "Estimated",
            });
        });

        it("has the middle of the range as its sort value", () => {
            expect(buildModelRows([estimated])[0].co2eMid).toBeCloseTo(4.8);
        });
    });

    describe("Scenario: a model whose ends read the same", () => {
        it("has no range line", () => {
            const row = buildModelRows([{ ...estimated, co2eGrams: { min: 3, max: 3 } }])[0];
            expect([row.co2e, row.co2eRange]).toEqual(["3 g CO2e", ""]);
        });
    });

    describe("Scenario: an unknown model", () => {
        it("has no CO2e figure or sort value and keeps its status", () => {
            const row = buildModelRows([unknown])[0];
            expect(row).toMatchObject({ co2e: "—", co2eRange: "", status: "UnknownModel" });
            expect(row.co2eMid).toBeUndefined();
        });

        it("has no matched-as or zone value, so the table sorts it last (the cell shows the dash)", () => {
            const row = buildModelRows([unknown])[0];
            expect([row.matchedAs, row.zone]).toEqual([undefined, undefined]);
        });
    });

    describe("Scenario: an unsupported capability", () => {
        it("keeps its status and shows no CO2e", () => {
            expect(buildModelRows([unsupported])[0]).toMatchObject({ co2e: "—", co2eRange: "", status: "UnsupportedCapability" });
        });
    });

    describe("Scenario: row order and identity", () => {
        it("keeps the API order", () => {
            const rows = buildModelRows([unknown, estimated, unsupported]);
            expect(rows.map((r) => r.modelId)).toEqual(["mystery-1", "claude-sonnet-4-5-20250929", "embed-1"]);
        });

        const identity = (row: Record<string, unknown>) => MODEL_ROW_KEY.map((field) => row[field]).join("|");

        it("identifies a row by provider, model and usage", () => {
            expect(MODEL_ROW_KEY).toEqual(["providerId", "modelId", "usage"]);
        });

        it("gives an estimated and an unknown chat row for the same model the same identity", () => {
            const [a, b] = buildModelRows([estimated, { ...estimated, status: "UnknownModel", co2eGrams: null }]);
            expect(identity(a)).toBe(identity(b));
        });

        it("gives a chat row and an unsupported row for the same model different identities", () => {
            const [chat, other] = buildModelRows([unknown, { ...unknown, status: "UnsupportedCapability" }]);
            expect([chat.usage, other.usage]).toEqual(["chat", "other"]);
            expect(identity(chat)).not.toBe(identity(other));
        });
    });
});

describe("Feature: by-model columns", () => {
    const columns = buildModelColumns((_key, fallback) => fallback);

    it("has the model, matched-as, zone, requests, output tokens and CO2e columns, and no status column", () => {
        expect(columns.map((c) => [c.key, c.label])).toEqual([
            ["modelId", "Model"],
            ["matchedAs", "Matched As"],
            ["zone", "Zone"],
            ["requests", "Requests"],
            ["outputTokens", "Output Tokens"],
            ["co2eMid", "Estimated CO2e"],
        ]);
    });

    it("shows the provider as the model's second line", () => {
        expect(columns[0].meta?.secondaryKey).toBe("providerId");
    });

    it("draws the numbers with number cells and CO2e with our own cell", () => {
        expect(columns.map((c) => c.elementName)).toEqual([
            "uaui-text-cell",
            "aicarbon-missing-text-cell",
            "aicarbon-missing-text-cell",
            "uaui-number-cell",
            "uaui-number-cell",
            "aicarbon-co2e-cell",
        ]);
    });

    it("sorts every column, the numbers as numbers", () => {
        expect(columns.every((c) => c.sortable)).toBe(true);
        expect(columns.filter((c) => c.sortAs === "number").map((c) => c.key)).toEqual(["requests", "outputTokens", "co2eMid"]);
    });

    it("searches the text columns only", () => {
        expect(columns.filter((c) => c.searchable).map((c) => c.key)).toEqual(["modelId", "matchedAs", "zone"]);
    });

    it("reserves warning space in the CO2e column", () => {
        expect((columns[5] as { reserveWarningSpace?: boolean }).reserveWarningSpace).toBe(true);
    });

    it("uses the localized label when there is one", () => {
        const localized = buildModelColumns((key, fallback) => (key === "aiCarbon_byModel_model" ? "Modell" : fallback));
        expect(localized[0].label).toBe("Modell");
    });
});

describe("Feature: model rows matched across periods", () => {
    const api = (overrides: Partial<EstimateModelRowModel>): EstimateModelRowModel => ({
        providerId: "openai",
        modelId: "gpt-x",
        status: "Estimated",
        co2eGrams: { min: 1, max: 3 },
        requests: 1,
        outputTokens: 1,
        warnings: [],
        ...overrides,
    });
    const keyOf = (r: ModelRowViewModel) => MODEL_ROW_KEY.map((field) => r[field as keyof ModelRowViewModel]).join("|");

    it("keys a model the same in both periods when only its status changed (Estimated, then UnknownModel)", () => {
        const [now] = buildModelRows([api({})]);
        const [then] = buildModelRows([api({ status: "UnknownModel", co2eGrams: null })]);
        expect(keyOf(now)).toBe(keyOf(then));
    });

    it("gives a row with no estimate no midpoint, so a compare badge has nothing to measure", () => {
        const [then] = buildModelRows([api({ status: "UnknownModel", co2eGrams: null })]);
        expect(then.co2eMid).toBeUndefined();
    });

    it("keeps a chat row and a non-chat row of the same model apart", () => {
        const [chat, other] = buildModelRows([api({}), api({ status: "UnsupportedCapability", co2eGrams: null })]);
        expect(keyOf(chat)).not.toBe(keyOf(other));
    });

    it("keys a model only one period has by its own fields, so it matches nothing", () => {
        const keys = buildModelRows([api({ modelId: "new" })]).map(keyOf);
        const compareKeys = buildModelRows([api({ modelId: "old" })]).map(keyOf);
        expect(keys.filter((key) => compareKeys.includes(key))).toEqual([]);
    });
});
