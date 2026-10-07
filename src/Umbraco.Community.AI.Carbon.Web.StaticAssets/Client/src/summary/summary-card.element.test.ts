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
            const element = await render({ value: "≈ 60", unit: "g CO2e", label: "Estimated CO2e" });
            expect(element.shadowRoot!.querySelector(".card-unit")!.textContent!.trim()).toBe("g CO2e");
        });
    });

    describe("Scenario: a figure with a range", () => {
        it("shows the range as a secondary line", async () => {
            const element = await render({ value: "≈ 60", unit: "g CO2e", range: "48–77 g CO2e", label: "Estimated CO2e" });
            expect(element.shadowRoot!.querySelector(".card-range")!.textContent).toBe("48–77 g CO2e");
        });

        it("shows no range line without a range", async () => {
            const element = await render({ value: "5", label: "Requests" });
            expect(element.shadowRoot!.querySelector(".card-range")).toBeNull();
        });
    });
});
