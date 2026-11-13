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
    compareRows: Array<{ key: string; co2eMid?: number }>;
    sort: unknown;
};

async function render(
    byFeature: EstimateFeatureBreakdownModel | undefined,
    analyticsEnabled: boolean | undefined,
    compareByFeature?: EstimateFeatureBreakdownModel,
) {
    const element = new AICarbonFeatureTableElement();
    element.byFeature = byFeature;
    element.compareByFeature = compareByFeature;
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

    describe("Scenario: loading", () => {
        async function renderLoading(byFeature?: EstimateFeatureBreakdownModel, enabled?: boolean) {
            const element = new AICarbonFeatureTableElement();
            element.byFeature = byFeature;
            element.analyticsEnabled = enabled;
            element.loading = true;
            document.body.appendChild(element);
            await element.updateComplete;
            return element.shadowRoot!.querySelector("uaui-data-table") as (Element & { columns: unknown[]; rows: unknown[] }) | null;
        }

        it("first load: shows the table, with its columns and no rows, loading", async () => {
            const table = await renderLoading(undefined, undefined);
            expect(table!.hasAttribute("loading")).toBe(true);
            expect([table!.columns.length > 0, table!.rows]).toEqual([true, []]);
        });

        it("reload: keeps the rows and sets loading", async () => {
            const table = await renderLoading(available, true);
            expect([table!.hasAttribute("loading"), table!.rows.length > 0]).toEqual([true, true]);
        });

        it("is not loading by default", async () => {
            const { table } = await render(available, true);
            expect(table!.hasAttribute("loading")).toBe(false);
        });
    });
});

describe("Feature: aicarbon-feature-table compared with a previous period", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    const before: EstimateFeatureBreakdownModel = {
        available: true,
        items: [
            { featureType: "agent", requests: 20, co2eGrams: { min: 2, max: 4 } },
            { featureType: "inline-chat", requests: 3, co2eGrams: { min: 0.1, max: 0.3 } },
        ],
    };

    it("passes the compared rows keyed by feature type, the table's row-key", async () => {
        const { table } = await render(available, true, before);
        expect(table!.getAttribute("row-key")).toBe("key");
        expect(table!.compareRows).toEqual([
            { key: "agent", co2eMid: 3 },
            { key: "inline-chat", co2eMid: 0.2 },
        ]);
    });

    it("leaves a feature only one period has unmatched: prompt is not in the compared rows, inline-chat is not in the current ones", async () => {
        const { table } = await render(available, true, before);
        const current = table!.rows.map((r) => (r as unknown as { key: string }).key);
        const compared = table!.compareRows.map((r) => r.key);
        expect([current.filter((k) => !compared.includes(k)), compared.filter((k) => !current.includes(k))]).toEqual([
            ["prompt", "brand-new"],
            ["inline-chat"],
        ]);
    });

    it("passes no compared rows when the compared breakdown is unavailable", async () => {
        const { table } = await render(available, true, { available: false, items: [] });
        expect(table!.compareRows).toEqual([]);
    });

    it("passes no compared rows without a comparison", async () => {
        const { table } = await render(available, true);
        expect(table!.compareRows).toEqual([]);
    });
});
