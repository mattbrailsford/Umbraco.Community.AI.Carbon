import { describe, expect, it } from "vitest";
import type { EstimateResponseModel } from "../api/types.gen.js";
import { buildSummaryCards } from "./summary-cards-model.js";

function estimate(notEstimatedModels: number): EstimateResponseModel {
    return {
        total: { co2eGrams: { min: 1.2, max: 8.4 }, energyWh: { min: 1400, max: 2400 }, requests: 1234, outputTokens: 0 },
        notEstimated: { requests: 0, outputTokens: 0, models: notEstimatedModels },
    } as EstimateResponseModel;
}

describe("Feature: summary cards", () => {
    describe("Scenario: an estimate with one unknown model", () => {
        const cards = buildSummaryCards(estimate(1));
        const byKind = (kind: string) => cards.find((c) => c.kind === kind)!;

        it("shows the CO2e range with its unit", () => expect(byKind("co2e").value).toBe("1.2–8.4 g CO2e"));
        it("shows the energy range with its unit", () => expect(byKind("energy").value).toBe("1.4–2.4 kWh"));
        it("shows the request count", () => expect(byKind("requests").value).toBe("1,234"));
        it("shows the models not estimated count", () => expect(byKind("notEstimated").value).toBe("1"));
        it("uses the warning colour for models not estimated", () => expect(byKind("notEstimated").warning).toBe(true));
        it("leaves the other cards unwarned", () =>
            expect(cards.filter((c) => c.kind !== "notEstimated").some((c) => c.warning)).toBe(false));
    });

    describe("Scenario: no unknown models", () => {
        it("does not warn", () => {
            expect(buildSummaryCards(estimate(0)).find((c) => c.kind === "notEstimated")!.warning).toBe(false);
        });
    });
});
