import { afterEach, describe, expect, it } from "vitest";
import type { EstimateResponseModel } from "../api/types.gen.js";
import { AICarbonSummaryCardsElement } from "./summary-cards.element.js";

function estimate(notEstimatedModels: number, co2eGrams = { min: 1.2, max: 8.4 }): EstimateResponseModel {
    return {
        total: { co2eGrams, energyWh: { min: 1.4, max: 2.4 }, requests: 5, outputTokens: 0 },
        notEstimated: { requests: 0, outputTokens: 0, models: notEstimatedModels },
    } as EstimateResponseModel;
}

async function render(value: EstimateResponseModel) {
    const element = new AICarbonSummaryCardsElement();
    element.estimate = value;
    document.body.appendChild(element);
    await element.updateComplete;
    // Properties are read off the tile elements (unregistered in tests, so plain HTMLElements).
    return [...element.shadowRoot!.querySelectorAll("uaui-kpi-tile")] as unknown as Array<Record<string, unknown> & Element>;
}

describe("Feature: aicarbon-summary-cards element", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    describe("Scenario: an estimate with unknown models", () => {
        it("renders one uaui-kpi-tile per figure, labelled as estimates", async () => {
            const tiles = await render(estimate(2));
            expect(tiles.map((t) => t.getAttribute("label"))).toEqual([
                "Estimated CO2e",
                "Estimated Energy",
                "Requests Estimated",
                "Not Estimated",
            ]);
        });

        it("passes the figure as text with its unit and the estimate marker", async () => {
            const tiles = await render(estimate(2));
            expect(tiles.map((t) => t.value)).toEqual(["≈ 4.8 g CO2e", "≈ 1.9 Wh", "5", "2"]);
        });

        it("puts the likely range on the detail line, and a short note on the counts", async () => {
            const tiles = await render(estimate(2));
            expect(tiles.map((t) => t.detail)).toEqual([
                "Likely 1.2–8.4",
                "Likely 1.4–2.4",
                "Successful chat requests",
                "Models not in the totals",
            ]);
        });

        it("tints only models not estimated, with the warning colour", async () => {
            const tiles = await render(estimate(2));
            expect(tiles.map((t) => t.color)).toEqual([undefined, undefined, undefined, "warning"]);
        });

        it("does not set previous, so no comparison shows yet", async () => {
            const tiles = await render(estimate(2));
            expect(tiles.map((t) => t.previous)).toEqual([undefined, undefined, undefined, undefined]);
        });

        it("is not openable, as the old card did nothing when pressed", async () => {
            const tiles = await render(estimate(2));
            expect(tiles.some((t) => t.openable || t.href)).toBe(false);
        });
    });

    describe("Scenario: no unknown models", () => {
        it("uses the neutral colour for models not estimated", async () => {
            const tiles = await render(estimate(0));
            expect(tiles[3].color).toBe("default");
        });
    });

    describe("Scenario: ends of the range read the same", () => {
        it("has no range line, so the tile shows no detail", async () => {
            const tiles = await render(estimate(0, { min: 5, max: 5 }));
            expect(tiles[0].detail).toBeUndefined();
        });
    });
});
