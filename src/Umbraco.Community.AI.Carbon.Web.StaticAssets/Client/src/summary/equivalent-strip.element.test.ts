import { afterEach, describe, expect, it } from "vitest";
import type { EstimateEquivalentModel } from "../api/types.gen.js";
import { AICarbonEquivalentStripElement } from "./equivalent-strip.element.js";

async function render(equivalent: EstimateEquivalentModel | null | undefined) {
    const element = new AICarbonEquivalentStripElement();
    element.equivalent = equivalent;
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

describe("Feature: aicarbon-equivalent-strip element", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("shows the comparison text when an equivalent is present", async () => {
        const element = await render({ kind: "PhoneCharges", amount: 6.21, basisCo2eGrams: 77, source: "S", sourceYear: 2024 });
        expect(element.shadowRoot!.querySelector(".text")!.textContent).toBe("Up to about the same as charging a phone 6.3 times");
    });

    it("has a visually hidden prefix that tells screen readers what the figure is", async () => {
        const element = await render({ kind: "PhoneCharges", amount: 6.21, basisCo2eGrams: 77, source: "S", sourceYear: 2024 });
        expect(element.shadowRoot!.querySelector(".sr-only")!.textContent).toBe("Estimated CO2e is ");
    });

    it("renders nothing when there is no equivalent", async () => {
        const element = await render(null);
        expect(element.shadowRoot!.querySelector(".strip")).toBeNull();
    });
});
