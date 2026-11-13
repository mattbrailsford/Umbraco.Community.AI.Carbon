// The tooltip lays out what the chart hands it: rows, labels, the change badge and the comparison's date.
// Positions are the chart's job and are not tested here (no layout in happy-dom).
import { describe, expect, it } from "vitest";
import type { TrendTooltipModel } from "./trend-chart-config.js";
import { AICarbonTrendTooltipElement } from "./trend-tooltip.element.js";

const model: TrendTooltipModel = {
    heading: "13 Nov 2026 (incomplete)",
    middle: { text: "≈ 23 g CO2e", range: "18–28 g CO2e" },
    compare: { text: "≈ 133 g CO2e", range: "103–163 g CO2e", date: "6 Nov 2026", current: 23, previous: 133 },
    x: 0,
    y: 0,
};

async function render(value: TrendTooltipModel) {
    const element = new AICarbonTrendTooltipElement();
    element.model = value;
    document.body.appendChild(element);
    await element.updateComplete;
    const text = (selector: string) => [...element.shadowRoot!.querySelectorAll(selector)].map((e) => e.textContent!.trim());
    return { element, text, badge: element.shadowRoot!.querySelector("uaui-delta-badge") as unknown as { current: number; previous: number; lowerIsBetter: boolean; getAttribute(n: string): string | null } | null };
}

describe("Feature: trend tooltip", () => {
    it("titles the tooltip with the date, incomplete wording included", async () => {
        const { text, element } = await render(model);
        expect(text(".tooltip-date")).toEqual(["13 Nov 2026 (incomplete)"]);
        element.remove();
    });

    it("shows the middle estimate as a bold value with its label", async () => {
        const { text, element } = await render(model);
        expect([text(".tooltip-value")[0], text(".tooltip-label")[0]]).toEqual(["≈ 23 g CO2e", "Middle estimate"]);
        element.remove();
    });

    it("shows the likely range on its own muted line", async () => {
        const { text, element } = await render(model);
        expect(text(".tooltip-sub")[0]).toBe("Likely 18–28 g CO2e");
        element.remove();
    });

    it("leaves the range line out when the range collapses to the figure", async () => {
        const { text, element } = await render({ ...model, middle: { text: "3 g CO2e" }, compare: undefined });
        expect(text(".tooltip-sub")).toEqual([]);
        element.remove();
    });

    it("shows the comparison with its value, its own date and its range under a divider", async () => {
        const { text, element } = await render(model);
        expect([text(".tooltip-compare .tooltip-value"), text(".tooltip-compare .tooltip-sub")]).toEqual([["≈ 133 g CO2e"], ["6 Nov 2026", "Likely 103–163 g CO2e"]]);
        element.remove();
    });

    it("gives the change badge both middles, with lower as better", async () => {
        const { badge, element } = await render(model);
        expect([badge!.current, badge!.previous, badge!.lowerIsBetter, badge!.getAttribute("size")]).toEqual([23, 133, true, "sm"]);
        element.remove();
    });

    it("shows no comparison block or badge without a comparison", async () => {
        const { element, badge } = await render({ ...model, compare: undefined });
        expect([element.shadowRoot!.querySelector(".tooltip-compare"), badge]).toEqual([null, null]);
        element.remove();
    });
});
