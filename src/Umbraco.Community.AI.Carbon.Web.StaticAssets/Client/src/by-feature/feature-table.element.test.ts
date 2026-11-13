import { afterEach, describe, expect, it, vi } from "vitest";
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

type TableProps = Element & {
    columns: Array<{ label: string }>;
    rows: Array<{ feature: string; co2e: string; co2eRange: string }>;
    sort: unknown;
};

async function render(byFeature: EstimateFeatureBreakdownModel | undefined, analyticsEnabled: boolean | undefined) {
    const element = new AICarbonFeatureTableElement();
    element.byFeature = byFeature;
    element.analyticsEnabled = analyticsEnabled;
    document.body.appendChild(element);
    await element.updateComplete;
    // `uaui-data-table` is not registered in tests, so its properties are read straight off the element.
    const table = element.shadowRoot!.querySelector("uaui-data-table") as TableProps | null;
    return { element, table };
}

describe("Feature: aicarbon-feature-table element", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("passes one row per feature with friendly names and the raw value for an unknown type, in order", async () => {
        const { table } = await render(available, true);
        expect(table!.rows.map((r) => r.feature)).toEqual(["Agents", "Prompts", "brand-new"]);
        expect(table!.rows[0]).toMatchObject({ co2e: "≈ 1.5 g CO2e", co2eRange: "1–2 g CO2e" });
        expect(table!.getAttribute("row-key")).toBe("key");
    });

    it("passes the columns and starts sorted by the CO2e midpoint, biggest first", async () => {
        const { table } = await render(available, true);
        expect(table!.columns.map((c) => c.label)).toEqual(["Feature", "Requests", "Estimated CO2e"]);
        expect(table!.sort).toEqual({ key: "co2eMid", direction: "desc" });
    });

    it("has no search field", async () => {
        const { table } = await render(available, true);
        expect(table!.querySelector("uaui-search-field")).toBeNull();
    });

    it("keeps the By Feature heading", async () => {
        const { element } = await render(available, true);
        expect(element.shadowRoot!.querySelector("uui-box")!.getAttribute("headline")).toBe("By Feature");
    });

    it("shows the switched-off wording as the table's empty state when the breakdown is unavailable and analytics are on", async () => {
        const { table } = await render({ available: false, items: [] }, true);
        expect(table!.rows).toEqual([]);
        expect(table!.getAttribute("empty-headline")).toBe(
            "Feature breakdown is switched off in Umbraco.AI analytics settings.",
        );
        expect(table!.getAttribute("empty-description")).toBe(
            "Turn on the feature type breakdown in the Umbraco.AI analytics settings to see this.",
        );
    });

    it("ignores any items when the breakdown is unavailable", async () => {
        const { table } = await render({ available: false, items: available.items }, true);
        expect(table!.rows).toEqual([]);
    });

    it.each<[string, EstimateFeatureBreakdownModel | undefined, boolean | undefined]>([
        ["analytics are disabled", { available: false, items: [] }, false],
        ["analytics state is unknown", { available: false, items: [] }, undefined],
        ["there is no breakdown yet", undefined, undefined],
        ["analytics are on but there is no breakdown", undefined, true],
        ["the breakdown is available but has no items (all usage is from models that are not estimated)", { available: true, items: [] }, true],
    ])("renders nothing when %s", async (_name, byFeature, enabled) => {
        const { element } = await render(byFeature, enabled);
        expect(element.shadowRoot!.querySelector("uui-box, uaui-data-table")).toBeNull();
    });

    it("shows new header labels and feature names when the language changes, without a new row array", async () => {
        const { element, table } = await render(available, true);
        const rows = table!.rows;
        vi.spyOn(element.localize, "termOrDefault").mockImplementation(((key: string, fallback?: string) =>
            key === "aiCarbon_byFeature_feature" ? "Funktion" : key === "aiCarbon_feature_agent" ? "Agenter" : (fallback ?? key)) as never);
        element.requestUpdate();
        await element.updateComplete;
        const after = element.shadowRoot!.querySelector("uaui-data-table") as TableProps;
        expect(after.columns[0].label).toBe("Funktion");
        expect(after.rows[0].feature).toBe("Agenter");
        expect(after.rows).not.toBe(rows);
    });

    it("keeps the same row and column arrays when nothing changed", async () => {
        const { element, table } = await render({ available: false, items: [] }, true);
        const { rows, columns } = table!;
        element.requestUpdate();
        await element.updateComplete;
        const after = element.shadowRoot!.querySelector("uaui-data-table") as TableProps;
        expect([after.rows, after.columns]).toEqual([rows, columns]);
        expect(after.rows).toBe(rows);
        expect(after.columns).toBe(columns);
    });

    it("keeps the same row and column arrays when nothing changed, for a breakdown with items", async () => {
        const { element, table } = await render(available, true);
        const { rows, columns } = table!;
        element.requestUpdate();
        await element.updateComplete;
        const after = element.shadowRoot!.querySelector("uaui-data-table") as TableProps;
        expect(after.rows).toBe(rows);
        expect(after.columns).toBe(columns);
    });
});
