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

        it("leads with the central CO2e figure", () => expect(byKind("co2e").value).toBe("≈ 4.8"));
        it("gives the CO2e figure its unit separately", () => expect(byKind("co2e").unit).toBe("g CO2e"));
        it("shows the CO2e range as the secondary line", () => expect(byKind("co2e").range).toBe("1.2–8.4 g CO2e"));
        it("leads with the central energy figure", () => expect(byKind("energy").value).toBe("≈ 1.9"));
        it("gives the energy figure its unit separately", () => expect(byKind("energy").unit).toBe("kWh"));
        it("shows the energy range as the secondary line", () => expect(byKind("energy").range).toBe("1.4–2.4 kWh"));
        it("shows the request count", () => expect(byKind("requests").value).toBe("1,234"));
        it("gives counts no unit", () => expect([byKind("requests").unit, byKind("notEstimated").unit]).toEqual(["", ""]));
        it("gives counts no range line", () => expect([byKind("requests").range, byKind("notEstimated").range]).toEqual(["", ""]));
        it("shows the models not estimated count", () => expect(byKind("notEstimated").value).toBe("1"));
        it("uses the warning colour for models not estimated", () => expect(byKind("notEstimated").warning).toBe(true));
        it("leaves the other cards unwarned", () =>
            expect(cards.filter((c) => c.kind !== "notEstimated").some((c) => c.warning)).toBe(false));
    });

    describe("Scenario: a value that cannot be shown", () => {
        it("shows a dash with no unit", () => {
            const bad = estimate(0);
            bad.total.co2eGrams = { min: NaN, max: NaN };
            const card = buildSummaryCards(bad).find((c) => c.kind === "co2e")!;
            expect([card.value, card.unit, card.range]).toEqual(["—", "", ""]);
        });
    });

    describe("Scenario: no unknown models", () => {
        it("does not warn", () => {
            expect(buildSummaryCards(estimate(0)).find((c) => c.kind === "notEstimated")!.warning).toBe(false);
        });
    });
});
