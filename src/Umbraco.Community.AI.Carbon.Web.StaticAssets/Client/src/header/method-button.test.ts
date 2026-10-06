import { describe, expect, it } from "vitest";
import type { EstimateMethodModel } from "../api/types.gen.js";
import { AICarbonHeaderElement } from "./range-select.element.js";

// happy-dom has no ElementInternals, which uui-select's form mixin needs on construction.
if (!("attachInternals" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "attachInternals", {
        value: () => ({ setFormValue() {}, setValidity() {}, labels: [], form: null }),
        configurable: true,
    });
}

const method: EstimateMethodModel = {
    source: "ecologits",
    dataVersion: "0.9.2",
    electricityZone: null,
    electricityZones: [],
    zoneIsOverride: false,
    analyticsEnabled: true,
};

async function render(withMethod: boolean) {
    const element = new AICarbonHeaderElement();
    if (withMethod) element.method = method;
    document.body.appendChild(element);
    await element.updateComplete;
    let opened = 0;
    element.addEventListener("method-open", () => opened++);
    const button = element.shadowRoot!.querySelector("uui-button") as HTMLElement & { disabled: boolean };
    return { element, button, opened: () => opened };
}

describe("Feature: aicarbon-header method button", () => {
    it("is disabled until an estimate has loaded", async () => {
        const { element, button } = await render(false);
        expect(button.hasAttribute("disabled")).toBe(true);
        element.remove();
    });

    it("is enabled once the method is known", async () => {
        const { element, button } = await render(true);
        expect(button.hasAttribute("disabled")).toBe(false);
        element.remove();
    });

    it("fires method-open when clicked", async () => {
        const { element, button, opened } = await render(true);
        button.dispatchEvent(new Event("click"));
        expect(opened()).toBe(1);
        element.remove();
    });
});
