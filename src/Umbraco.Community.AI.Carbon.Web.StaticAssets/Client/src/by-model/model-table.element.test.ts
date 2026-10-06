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

    it("renders one row per model with its status, in order", async () => {
        const element = await render([
            row({ modelId: "a" }),
            row({ modelId: "b", status: "UnknownModel", co2eGrams: null }),
            row({ modelId: "c", status: "UnsupportedCapability", co2eGrams: null }),
        ]);
        const rows = [...element.shadowRoot!.querySelectorAll("uui-table-row")];
        expect(rows.map((r) => r.querySelector(".model-id")!.textContent)).toEqual(["a", "b", "c"]);
        expect(rows.map((r) => r.querySelector("uui-tag")!.textContent!.trim())).toEqual([
            "Estimated",
            "Not estimated (unknown model)",
            "Not estimated (not supported)",
        ]);
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
