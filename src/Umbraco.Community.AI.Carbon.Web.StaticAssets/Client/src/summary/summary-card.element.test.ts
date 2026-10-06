import { afterEach, describe, expect, it } from "vitest";
import { AICarbonSummaryCardElement } from "./summary-card.element.js";

async function render(props: Partial<AICarbonSummaryCardElement>) {
    const element = new AICarbonSummaryCardElement();
    Object.assign(element, props);
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

describe("Feature: aicarbon-summary-card element", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    describe("Scenario: a card with a description", () => {
        it("keeps the description in the shadow DOM for assistive technology", async () => {
            const element = await render({ value: "5", label: "Requests", description: "Successful chat requests." });
            expect(element.shadowRoot!.querySelector(".sr-only")!.textContent).toBe("Successful chat requests.");
        });

        it("also offers the description as a hover tooltip", async () => {
            const element = await render({ value: "5", label: "Requests", description: "Successful chat requests." });
            expect(element.shadowRoot!.querySelector("uui-card")!.getAttribute("title")).toBe("Successful chat requests.");
        });
    });

    describe("Scenario: a figure with a unit", () => {
        it("renders the unit apart from the number", async () => {
            const element = await render({ value: "48–77", unit: "g CO2e", label: "Estimated CO2e" });
            expect(element.shadowRoot!.querySelector(".card-unit")!.textContent!.trim()).toBe("g CO2e");
        });
    });
});
