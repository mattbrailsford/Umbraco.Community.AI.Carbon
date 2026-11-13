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

    describe("Scenario: a figure that cannot be computed", () => {
        it("flags only that card as having no data", () => {
            const bad = estimate(0);
            bad.total.co2eGrams = { min: NaN, max: NaN };
            expect(buildSummaryCards(bad).map((c) => c.noData)).toEqual([true, false, false, false]);
        });

        it("flags a count that is not a number", () => {
            const bad = estimate(0);
            bad.total.requests = NaN;
            expect(buildSummaryCards(bad).find((c) => c.kind === "requests")!.noData).toBe(true);
        });

        it("flags nothing for a healthy estimate", () => {
            expect(buildSummaryCards(estimate(0)).some((c) => c.noData)).toBe(false);
        });
    });

    describe("Scenario: no estimate yet", () => {
        const cards = buildSummaryCards(undefined);

        it("still lists the four tiles, so a loading or failed view can draw them", () => {
            expect(cards.map((c) => c.kind)).toEqual(["co2e", "energy", "requests", "notEstimated"]);
        });

        it("has no figures, and does not call that no data", () => {
            expect(cards.map((c) => [c.value, c.current, c.noData])).toEqual(Array(4).fill([undefined, undefined, false]));
        });
    });
});

describe("Feature: summary cards compared with a previous period", () => {
    const previous = {
        total: { co2eGrams: { min: 2, max: 4 }, energyWh: { min: 1000, max: 1200 }, requests: 1000, outputTokens: 0 },
        notEstimated: { requests: 0, outputTokens: 0, models: 5 },
    } as EstimateResponseModel;
    const cards = buildSummaryCards(estimate(1), previous);
    const byKind = (kind: string) => cards.find((c) => c.kind === kind)!;

    it("gives CO2e and energy the previous midpoint, on the scale of their current number", () => {
        expect([byKind("co2e").previous, byKind("energy").previous]).toEqual([3, 1100]);
    });

    it("gives requests and models not estimated no previous, so those tiles have no badge (more requests is not better)", () =>
        expect([byKind("requests").previous, byKind("notEstimated").previous]).toEqual([undefined, undefined]));

    it("treats a fall as good for CO2e and energy only", () =>
        expect(cards.map((c) => [c.kind, c.lowerIsBetter])).toEqual([
            ["co2e", true],
            ["energy", true],
            ["requests", false],
            ["notEstimated", false],
        ]));

    it("gives no previous without a comparison", () =>
        expect(buildSummaryCards(estimate(1)).map((c) => c.previous)).toEqual([undefined, undefined, undefined, undefined]));

    it("gives no previous for a figure the compared estimate can't compute", () => {
        const broken = { ...previous, total: { ...previous.total, co2eGrams: { min: Number.NaN, max: 1 } } } as EstimateResponseModel;
        expect(buildSummaryCards(estimate(1), broken).find((c) => c.kind === "co2e")!.previous).toBeUndefined();
    });
});
