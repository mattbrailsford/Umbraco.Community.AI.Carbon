// Chart.js needs a canvas 2D context, which happy-dom does not provide, so these tests swap the chart
// factory for a stand-in and check what the element hands it. The real Chart.js is covered by the
// demo-site check.
import { describe, expect, it, vi } from "vitest";
import type { EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { AICarbonTrendChartElement, type TrendChart } from "./trend-chart.element.js";

const points: EstimateTimeSeriesPointModel[] = [
    { timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 1, max: 3 } },
    { timestamp: "2026-10-02T00:00:00Z", co2eGrams: { min: 0, max: 0 } },
];

function setup() {
    const chart: TrendChart = { data: { datasets: [] }, options: {}, update: vi.fn(), destroy: vi.fn() };
    const factory = vi.fn(() => chart);
    const element = new AICarbonTrendChartElement();
    element.chartFactory = factory;
    return { element, chart, factory };
}

async function mount(element: AICarbonTrendChartElement) {
    document.body.appendChild(element);
    await element.updateComplete;
}

describe("Feature: aicarbon-trend-chart element", () => {
    it("does no chart work and renders nothing without points", async () => {
        const { element, factory } = setup();
        await mount(element);
        expect(factory).not.toHaveBeenCalled();
        expect(element.shadowRoot!.querySelector("canvas")).toBeNull();
        element.remove();
    });

    it("gives the chart a lower and an upper dataset filled between", async () => {
        const { element, factory } = setup();
        element.points = points;
        await mount(element);
        const datasets = (factory.mock.calls[0] as unknown as [HTMLCanvasElement, { data: { datasets: { data: number[]; fill: unknown }[] } }])[1].data.datasets;
        expect(datasets.map((d) => [d.data, d.fill])).toEqual([
            [[1, 0], false],
            [[3, 0], "-1"],
        ]);
        element.remove();
    });

    it("describes the series on the canvas for screen readers", async () => {
        const { element } = setup();
        element.points = points;
        await mount(element);
        expect(element.shadowRoot!.querySelector("canvas")!.getAttribute("aria-label")).toContain("Estimated CO2e over time");
        element.remove();
    });

    it("updates the same chart in place when the points change", async () => {
        const { element, chart, factory } = setup();
        element.points = points;
        await mount(element);
        element.points = [points[0]];
        await element.updateComplete;
        expect(factory).toHaveBeenCalledTimes(1);
        expect([chart.update, chart.data.labels]).toEqual([expect.any(Function), [points[0].timestamp]]);
        expect(chart.update).toHaveBeenCalledTimes(1);
        element.remove();
    });

    it("destroys the chart when removed from the page", async () => {
        const { element, chart } = setup();
        element.points = points;
        await mount(element);
        element.remove();
        expect(chart.destroy).toHaveBeenCalledTimes(1);
    });

    it("destroys the chart when the points become empty", async () => {
        const { element, chart } = setup();
        element.points = points;
        await mount(element);
        element.points = [];
        await element.updateComplete;
        expect(chart.destroy).toHaveBeenCalledTimes(1);
        element.remove();
    });

    it("does not rebuild the config when an unrelated update happens", async () => {
        const { element, chart, factory } = setup();
        element.points = points;
        await mount(element);
        element.requestUpdate();
        await element.updateComplete;
        expect(factory).toHaveBeenCalledTimes(1);
        expect(chart.update).not.toHaveBeenCalled();
        element.remove();
    });

    it("rebuilds the chart when the element is moved and reconnected", async () => {
        const { element, factory } = setup();
        element.points = points;
        await mount(element);
        element.remove();
        document.body.appendChild(element);
        await element.updateComplete;
        expect(factory).toHaveBeenCalledTimes(2);
        element.remove();
    });
});
