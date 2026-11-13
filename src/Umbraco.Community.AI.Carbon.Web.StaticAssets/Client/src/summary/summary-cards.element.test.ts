import { afterEach, describe, expect, it } from "vitest";
import type { EstimateResponseModel } from "../api/types.gen.js";
import { AICarbonSummaryCardsElement } from "./summary-cards.element.js";

function estimate(notEstimatedModels: number, co2eGrams = { min: 1.2, max: 8.4 }): EstimateResponseModel {
    return {
        total: { co2eGrams, energyWh: { min: 1.4, max: 2.4 }, requests: 5, outputTokens: 0 },
        notEstimated: { requests: 0, outputTokens: 0, models: notEstimatedModels },
    } as EstimateResponseModel;
}

async function render(value: EstimateResponseModel, compare?: EstimateResponseModel) {
    const element = new AICarbonSummaryCardsElement();
    element.estimate = value;
    element.compare = compare;
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

        it("is not selectable or openable, as the old card did nothing when pressed", async () => {
            const tiles = await render(estimate(2));
            expect(tiles.some((t) => t.selectable || t.openable || t.href)).toBe(false);
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

    describe("Scenario: load states", () => {
        async function renderState(props: Partial<Pick<AICarbonSummaryCardsElement, "loading" | "error" | "noData">>, value?: EstimateResponseModel) {
            const element = new AICarbonSummaryCardsElement();
            Object.assign(element, props);
            element.estimate = value;
            document.body.appendChild(element);
            await element.updateComplete;
            return [...element.shadowRoot!.querySelectorAll("uaui-kpi-tile")] as unknown as Array<Element & Record<string, unknown>>;
        }
        const flags = (tiles: Array<Element>, name: string) => tiles.map((t) => t.hasAttribute(name));

        it("first load: four tiles, loading, with no value", async () => {
            const tiles = await renderState({ loading: true });
            expect([flags(tiles, "loading"), tiles.map((t) => t.value)]).toEqual([Array(4).fill(true), Array(4).fill(undefined)]);
        });

        it("keeps the labels while loading, so the tiles do not change size", async () => {
            const tiles = await renderState({ loading: true });
            expect(tiles.map((t) => t.getAttribute("label"))).toEqual([
                "Estimated CO2e",
                "Estimated Energy",
                "Requests Estimated",
                "Not Estimated",
            ]);
        });

        it("reload: keeps the figures and sets loading", async () => {
            const tiles = await renderState({ loading: true }, estimate(2));
            expect([flags(tiles, "loading"), tiles[2].value]).toEqual([Array(4).fill(true), "5"]);
        });

        it("failed: every tile shows its error dash", async () => {
            const tiles = await renderState({ error: true });
            expect(flags(tiles, "error")).toEqual(Array(4).fill(true));
        });

        it("no usage: every tile is no-data", async () => {
            const tiles = await renderState({ noData: true }, estimate(0));
            expect(flags(tiles, "no-data")).toEqual(Array(4).fill(true));
        });

        it("a figure that cannot be computed is no-data on its own tile only", async () => {
            const tiles = await renderState({}, estimate(0, { min: NaN, max: NaN }));
            expect(flags(tiles, "no-data")).toEqual([true, false, false, false]);
        });

        it("a loaded estimate sets none of loading, error or no-data", async () => {
            const tiles = await renderState({}, estimate(0));
            expect(tiles.some((t) => t.hasAttribute("loading") || t.hasAttribute("error") || t.hasAttribute("no-data"))).toBe(false);
        });
    });
});

describe("Feature: aicarbon-summary-cards compared with a previous period", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });
    const previous = estimate(0, { min: 2, max: 4 });

    it("passes previous to the CO2e and energy tiles only: counts show no change badge", async () => {
        const tiles = await render(estimate(1), previous);
        expect(tiles.map((t) => t.previous)).toEqual([3, 1.9, undefined, undefined]);
    });

    it("treats a fall as good for the CO2e and energy tiles", async () => {
        const tiles = await render(estimate(1), previous);
        expect(tiles.map((t) => t.lowerIsBetter)).toEqual([true, true, false, false]);
    });
});
