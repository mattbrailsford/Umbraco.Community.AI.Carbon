import { describe, expect, it } from "vitest";
import type { EstimateModelRowModel } from "../api/types.gen.js";
import { AICarbonModelTableElement } from "./model-table.element.js";

const row = (overrides: Partial<EstimateModelRowModel>): EstimateModelRowModel => ({
    providerId: "openai",
    modelId: "gpt-x",
    status: "Estimated",
    co2eGrams: { min: 1, max: 2 },
    requests: 1,
    outputTokens: 1,
    warnings: [],
    ...overrides,
});

async function render(rows?: EstimateModelRowModel[]) {
    const element = new AICarbonModelTableElement();
    element.rows = rows;
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

describe("Feature: aicarbon-model-table element", () => {
    it("renders nothing without rows", async () => {
        const element = await render([]);
        expect(element.shadowRoot!.querySelector("uui-table")).toBeNull();
        element.remove();
    });

    it("renders one row per model, in order", async () => {
        const element = await render([
            row({ modelId: "a" }),
            row({ modelId: "b", status: "UnknownModel", co2eGrams: null }),
            row({ modelId: "c", status: "UnsupportedCapability", co2eGrams: null }),
        ]);
        const rows = [...element.shadowRoot!.querySelectorAll("uui-table-row")];
        expect(rows.map((r) => r.querySelector(".model-id")!.textContent)).toEqual(["a", "b", "c"]);
        element.remove();
    });

    it("has no Status column", async () => {
        const element = await render([row({})]);
        const heads = [...element.shadowRoot!.querySelectorAll("uui-table-head-cell")].map((h) => h.textContent!.trim());
        expect(heads).toEqual(["Model", "Matched As", "Zone", "Requests", "Output Tokens", "Estimated CO2e"]);
        expect(element.shadowRoot!.querySelector("uui-tag")).toBeNull();
        element.remove();
    });

    it("shows an estimated row's central figure with its range on a second line", async () => {
        const element = await render([row({ co2eGrams: { min: 48, max: 72 } })]);
        const cell = element.shadowRoot!.querySelector(".co2e")!;
        expect([cell.querySelector(".central")!.textContent, cell.querySelector(".range")!.textContent]).toEqual([
            "≈ 60 g CO2e",
            "48–72 g CO2e",
        ]);
        element.remove();
    });

    it.each([
        ["UnknownModel", "Unknown model \u2014 EcoLogits doesn't know this model."],
        ["UnsupportedCapability", "Not supported \u2014 only chat (text generation) is estimated."],
    ] as const)("shows %s rows as Not estimated with the reason as tooltip and assistive text", async (status, reason) => {
        const element = await render([row({ status, co2eGrams: null })]);
        const cell = element.shadowRoot!.querySelector(".co2e")!;
        const label = cell.querySelector(".not-estimated")!;
        expect(label.textContent!.trim()).toBe("Not estimated");
        expect(label.getAttribute("title")).toBe(reason);
        expect(cell.querySelector(".sr-only")!.textContent).toBe(reason);
        element.remove();
    });

    it("puts the warning icon in the CO2e cell", async () => {
        const element = await render([row({ warnings: ["model-arch-not-released"] })]);
        expect(element.shadowRoot!.querySelector(".co2e .warnings")).not.toBeNull();
        element.remove();
    });

    it("shows a warning icon only for rows with warnings, with plain-English text", async () => {
        const element = await render([row({ modelId: "a" }), row({ modelId: "b", warnings: ["model-arch-not-released"] })]);
        const icons = element.shadowRoot!.querySelectorAll(".warnings");
        expect(icons).toHaveLength(1);
        expect(icons[0].getAttribute("title")).toMatch(/size isn.t published.*wide/i);
        expect(icons[0].closest("uui-table-row")!.querySelector(".model-id")!.textContent).toBe("b");
        element.remove();
    });

    it("renders model ids as text, not markup", async () => {
        const element = await render([row({ modelId: "<img src=x onerror=alert(1)>" })]);
        expect(element.shadowRoot!.querySelector("img")).toBeNull();
        element.remove();
    });
});
