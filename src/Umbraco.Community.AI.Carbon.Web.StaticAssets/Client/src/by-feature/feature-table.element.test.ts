import { describe, expect, it } from "vitest";
import type { EstimateFeatureBreakdownModel } from "../api/types.gen.js";
import { AICarbonFeatureTableElement } from "./feature-table.element.js";

const available: EstimateFeatureBreakdownModel = {
    available: true,
    items: [
        { featureType: "agent", requests: 10, co2eGrams: { min: 1, max: 2 } },
        { featureType: "prompt", requests: 5, co2eGrams: { min: 0.5, max: 1 } },
        { featureType: "brand-new", requests: 1, co2eGrams: { min: 0.1, max: 0.2 } },
    ],
};

async function render(byFeature: EstimateFeatureBreakdownModel | undefined, analyticsEnabled: boolean | undefined) {
    const element = new AICarbonFeatureTableElement();
    element.byFeature = byFeature;
    element.analyticsEnabled = analyticsEnabled;
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

describe("Feature: aicarbon-feature-table element", () => {
    it("renders one row per feature with friendly names and the raw value for an unknown type, in order", async () => {
        const element = await render(available, true);
        const rows = [...element.shadowRoot!.querySelectorAll("uui-table-row")];
        expect(rows.map((r) => r.querySelector(".feature")!.textContent!.trim())).toEqual(["Agents", "Prompts", "brand-new"]);
        expect(rows[0].querySelector(".central")!.textContent).toBe("≈ 1.5 g CO2e");
        expect(rows[0].querySelector(".range")!.textContent).toBe("1–2 g CO2e");
        element.remove();
    });

    it("shows the switched-off note instead of the table when the breakdown is unavailable and analytics are on", async () => {
        const element = await render({ available: false, items: [] }, true);
        expect(element.shadowRoot!.querySelector("uui-table")).toBeNull();
        expect(element.shadowRoot!.querySelector(".note")!.textContent).toContain(
            "Feature breakdown is switched off in Umbraco.AI analytics settings.",
        );
        element.remove();
    });

    it("renders nothing when analytics are disabled, even if the breakdown is unavailable", async () => {
        const element = await render({ available: false, items: [] }, false);
        expect(element.shadowRoot!.querySelector("uui-box, .note, uui-table")).toBeNull();
        element.remove();
    });

    it("renders nothing when the breakdown is unavailable and analytics state is unknown", async () => {
        const element = await render({ available: false, items: [] }, undefined);
        expect(element.shadowRoot!.querySelector("uui-box, .note, uui-table")).toBeNull();
        element.remove();
    });

    it("renders nothing when available but there are no items", async () => {
        const element = await render({ available: true, items: [] }, true);
        expect(element.shadowRoot!.querySelector("uui-box, .note, uui-table")).toBeNull();
        element.remove();
    });

    it("renders nothing before the estimate has loaded (both properties undefined)", async () => {
        const element = await render(undefined, undefined);
        expect(element.shadowRoot!.querySelector("uui-box, .note, uui-table")).toBeNull();
        element.remove();
    });

    it("renders nothing when analytics are on but there is no breakdown", async () => {
        const element = await render(undefined, true);
        expect(element.shadowRoot!.querySelector("uui-box, .note, uui-table")).toBeNull();
        element.remove();
    });

    it("renders feature names as text, not markup", async () => {
        const element = await render({
            available: true,
            items: [{ featureType: "<img src=x onerror=alert(1)>", requests: 1, co2eGrams: { min: 1, max: 2 } }],
        }, true);
        expect(element.shadowRoot!.querySelector("img")).toBeNull();
        element.remove();
    });
});
