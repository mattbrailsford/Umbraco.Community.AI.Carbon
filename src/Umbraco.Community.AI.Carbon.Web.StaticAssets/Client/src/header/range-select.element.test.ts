import { describe, expect, it } from "vitest";
import type { EstimateRange } from "../estimate/index.js";
import { AICarbonHeaderElement } from "./range-select.element.js";

// happy-dom has no ElementInternals, which uui-select's form mixin needs on construction.
if (!("attachInternals" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "attachInternals", {
        value: () => ({ setFormValue() {}, setValidity() {}, labels: [], form: null }),
        configurable: true,
    });
}

async function render() {
    const element = new AICarbonHeaderElement();
    document.body.appendChild(element);
    await element.updateComplete;
    const events: EstimateRange[] = [];
    element.addEventListener("range-change", (e) => events.push((e as CustomEvent<EstimateRange>).detail));
    return { element, events };
}

function choose(element: AICarbonHeaderElement, value: string) {
    const select = element.shadowRoot!.querySelector("uui-select") as HTMLElement & { value: string };
    Object.defineProperty(select, "value", { value, configurable: true });
    select.dispatchEvent(new Event("change"));
}

describe("Feature: aicarbon-header range select", () => {
    it("fires range-change with the chosen range", async () => {
        const { element, events } = await render();
        choose(element, "last30d");
        expect(events).toEqual(["last30d"]);
        element.remove();
    });

    it("ignores values that are not a known range", async () => {
        const { element, events } = await render();
        choose(element, "last-year");
        expect(events).toEqual([]);
        element.remove();
    });
});
