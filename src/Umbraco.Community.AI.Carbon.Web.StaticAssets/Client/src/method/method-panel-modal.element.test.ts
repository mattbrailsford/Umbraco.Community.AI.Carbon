import { describe, expect, it } from "vitest";
import type { EstimateMethodModel } from "../api/types.gen.js";
import { AICarbonMethodPanelModalElement } from "./method-panel-modal.element.js";

// happy-dom has no ElementInternals, which uui-button's form mixin needs on construction.
if (!("attachInternals" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "attachInternals", {
        value: () => ({ setFormValue() {}, setValidity() {}, labels: [], form: null }),
        configurable: true,
    });
}

const method: EstimateMethodModel = {
    source: "ecologits",
    dataVersion: "0.9.2",
    electricityZone: "SWE",
    electricityZones: ["SWE"],
    zoneIsOverride: true,
    analyticsEnabled: true,
};

async function render(data: EstimateMethodModel = method) {
    const element = new AICarbonMethodPanelModalElement();
    element.data = { method: data };
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

describe("Feature: aicarbon-method-panel element", () => {
    it("shows the EcoLogits data version in the credit", async () => {
        const element = await render();
        expect(element.shadowRoot!.textContent).toContain("data version 0.9.2");
        element.remove();
    });

    it("opens both EcoLogits links in a new tab without opener access", async () => {
        const element = await render();
        const links = [...element.shadowRoot!.querySelectorAll("a")];
        expect(links.map((a) => [a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")])).toEqual([
            ["https://ecologits.ai", "_blank", "noopener noreferrer"],
            ["https://github.com/mlco2/ecologits", "_blank", "noopener noreferrer"],
        ]);
        element.remove();
    });

    it("states that the package is unofficial and not endorsed by Umbraco HQ", async () => {
        const element = await render();
        expect(element.shadowRoot!.querySelector(".notice")!.textContent).toContain("not made or endorsed by Umbraco HQ");
        element.remove();
    });

    it("shows the zone and that it is an override", async () => {
        const element = await render();
        expect(element.shadowRoot!.textContent).toContain("Zone used: SWE. This is set in AICarbon:ElectricityZone");
        element.remove();
    });

    it("hides the zone hint when an override is active and shows it otherwise", async () => {
        const overridden = await render();
        expect(overridden.shadowRoot!.textContent).not.toContain("Only set it to where the models really run");
        overridden.remove();
        const shared = await render({ ...method, zoneIsOverride: false });
        expect(shared.shadowRoot!.textContent).toContain("Only set it to where the models really run");
        shared.remove();
    });

    it("lists the zones when they are mixed", async () => {
        const element = await render({ ...method, electricityZone: null, zoneIsOverride: false, electricityZones: ["SWE", "USA"] });
        expect([...element.shadowRoot!.querySelectorAll(".zones li")].map((li) => li.textContent)).toEqual(["SWE", "USA"]);
        element.remove();
    });
});
