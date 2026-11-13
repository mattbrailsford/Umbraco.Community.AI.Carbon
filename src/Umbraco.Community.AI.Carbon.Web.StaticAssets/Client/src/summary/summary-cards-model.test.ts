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

        it("leads with the central CO2e figure", () => expect(byKind("co2e").value).toBe("≈ 4.8 g CO2e"));
        it("shows the CO2e range as the secondary line", () => expect(byKind("co2e").range).toBe("1.2–8.4"));
        it("leads with the central energy figure", () => expect(byKind("energy").value).toBe("≈ 1.9 kWh"));
        it("shows the energy range as the secondary line", () => expect(byKind("energy").range).toBe("1.4–2.4"));
        it("shows the request count", () => expect(byKind("requests").value).toBe("1,234"));
        it("gives the range midpoint as the number to compare", () => expect(byKind("co2e").current).toBe(4.8));
        it("gives the energy midpoint in Wh", () => expect(byKind("energy").current).toBe(1900));
        it("gives counts as their own number", () => expect([byKind("requests").current, byKind("notEstimated").current]).toEqual([1234, 1]));
        it("gives counts no range line", () => expect([byKind("requests").range, byKind("notEstimated").range]).toEqual(["", ""]));
        it("shows the models not estimated count", () => expect(byKind("notEstimated").value).toBe("1"));
        it("uses the warning status for models not estimated", () => expect(byKind("notEstimated").status).toBe("warning"));
        it("leaves the other cards without a status", () =>
            expect(cards.filter((c) => c.kind !== "notEstimated").map((c) => c.status)).toEqual([undefined, undefined, undefined]));
    });

    describe("Scenario: a value that cannot be shown", () => {
        it("shows a dash with no unit", () => {
            const bad = estimate(0);
            bad.total.co2eGrams = { min: NaN, max: NaN };
            const card = buildSummaryCards(bad).find((c) => c.kind === "co2e")!;
            expect([card.value, card.range, card.current]).toEqual(["—", "", undefined]);
        });
    });

    describe("Scenario: no unknown models", () => {
        it("uses the neutral status", () => {
            expect(buildSummaryCards(estimate(0)).find((c) => c.kind === "notEstimated")!.status).toBe("default");
        });
    });
});
