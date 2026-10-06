import { describe, expect, it } from "vitest";
import type { EstimateResponseModel } from "../api/types.gen.js";
import { AICarbonSummaryCardsElement } from "./summary-cards.element.js";

describe("Feature: aicarbon-summary-cards element", () => {
    it("renders four cards from the estimate property, warning on models not estimated", async () => {
        const element = new AICarbonSummaryCardsElement();
        element.estimate = {
            total: { co2eGrams: { min: 1.2, max: 8.4 }, energyWh: { min: 1.4, max: 2.4 }, requests: 5, outputTokens: 0 },
            notEstimated: { requests: 0, outputTokens: 0, models: 2 },
        } as EstimateResponseModel;
        document.body.appendChild(element);
        await element.updateComplete;

        const cards = [...element.shadowRoot!.querySelectorAll("aicarbon-summary-card")];
        expect(cards.map((c) => c.getAttribute("value"))).toEqual(["1.2–8.4", "1.4–2.4", "5", "2"]);
        expect(cards.map((c) => c.getAttribute("unit"))).toEqual(["g CO2e", "Wh", "", ""]);
        expect(cards.map((c) => c.hasAttribute("warning"))).toEqual([false, false, false, true]);
        element.remove();
    });
});
