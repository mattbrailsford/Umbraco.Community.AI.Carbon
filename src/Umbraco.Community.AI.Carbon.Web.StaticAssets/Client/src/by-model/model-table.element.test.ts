import { afterEach, describe, expect, it, vi } from "vitest";
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
    // `uaui-data-table` is not registered in tests, so its properties are read straight off the element.
    const table = element.shadowRoot!.querySelector("uaui-data-table") as
        | (Element & { columns: Array<{ label: string }>; rows: Array<{ modelId: string }>; sort: unknown })
        | null;
    return { element, table };
}

describe("Feature: aicarbon-model-table element", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("renders nothing without rows", async () => {
        const { element, table } = await render([]);
        expect(table).toBeNull();
        expect(element.shadowRoot!.querySelector("uui-box")).toBeNull();
    });

    it("passes one row per model, in order, keyed by row-key", async () => {
        const { table } = await render([
            row({ modelId: "a" }),
            row({ modelId: "b", status: "UnknownModel", co2eGrams: null }),
            row({ modelId: "c", status: "UnsupportedCapability", co2eGrams: null }),
        ]);
        expect(table!.rows.map((r) => r.modelId)).toEqual(["a", "b", "c"]);
        expect((table as unknown as { rowKey: string[] }).rowKey).toEqual(["providerId", "modelId", "usage"]);
    });

    it("passes the columns, with no Status column", async () => {
        const { table } = await render([row({})]);
        expect(table!.columns.map((c) => c.label)).toEqual([
            "Model",
            "Matched As",
            "Zone",
            "Requests",
            "Output Tokens",
            "Estimated CO2e",
        ]);
    });

    it("starts sorted by the CO2e midpoint, biggest first", async () => {
        const { table } = await render([row({})]);
        expect(table!.sort).toEqual({ key: "co2eMid", direction: "desc" });
    });

    it("puts a search field in the toolbar", async () => {
        const { table } = await render([row({})]);
        expect(table!.querySelector('[slot="toolbar"] uaui-search-field')).not.toBeNull();
    });

    it("keeps the By Model heading", async () => {
        const { element } = await render([row({})]);
        expect(element.shadowRoot!.querySelector("uui-box")!.getAttribute("headline")).toBe("By Model");
    });

    it("keeps the same row array when it re-renders without new rows", async () => {
        const { element, table } = await render([row({})]);
        const first = table!.rows;
        element.requestUpdate();
        await element.updateComplete;
        expect(element.shadowRoot!.querySelector<Element & { rows: unknown }>("uaui-data-table")!.rows).toBe(first);
    });

    it("shows new header labels when the language or translations change, without a new row array", async () => {
        const { element, table } = await render([row({})]);
        const rows = table!.rows;
        const columns = table!.columns;
        vi.spyOn(element.localize, "termOrDefault").mockImplementation(((key: string, fallback?: string) =>
            key === "aiCarbon_byModel_model" ? "Modell" : (fallback ?? key)) as never);
        element.requestUpdate();
        await element.updateComplete;
        const after = element.shadowRoot!.querySelector("uaui-data-table") as typeof table;
        expect(after!.columns[0].label).toBe("Modell");
        expect(after!.columns).not.toBe(columns);
        expect(after!.rows).toBe(rows);
    });

    it("keeps the same column array when the labels have not changed", async () => {
        const { element, table } = await render([row({})]);
        const columns = table!.columns;
        element.requestUpdate();
        await element.updateComplete;
        expect(element.shadowRoot!.querySelector<Element & { columns: unknown }>("uaui-data-table")!.columns).toBe(columns);
    });

    describe("Scenario: loading", () => {
        async function renderLoading(rows?: EstimateModelRowModel[]) {
            const element = new AICarbonModelTableElement();
            element.rows = rows;
            element.loading = true;
            document.body.appendChild(element);
            await element.updateComplete;
            return element.shadowRoot!.querySelector("uaui-data-table") as (Element & { columns: unknown[]; rows: unknown[] }) | null;
        }

        it("first load: shows the table, with its columns and no rows, loading", async () => {
            const table = await renderLoading(undefined);
            expect(table!.hasAttribute("loading")).toBe(true);
            expect([table!.columns.length, table!.rows]).toEqual([6, []]);
        });

        it("keeps the heading while loading, so the box does not jump", async () => {
            const table = await renderLoading(undefined);
            expect(table!.closest("uui-box")!.getAttribute("headline")).toBe("By Model");
        });

        it("reload: keeps the rows and sets loading", async () => {
            const table = await renderLoading([row({})]);
            expect([table!.hasAttribute("loading"), table!.rows.length]).toEqual([true, 1]);
        });

        it("is not loading by default", async () => {
            const { table } = await render([row({})]);
            expect(table!.hasAttribute("loading")).toBe(false);
        });
    });
});
