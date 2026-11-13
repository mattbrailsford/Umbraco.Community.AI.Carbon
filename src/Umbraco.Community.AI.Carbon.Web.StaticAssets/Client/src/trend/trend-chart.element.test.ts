// Chart.js needs a canvas 2D context, which happy-dom does not provide, so these tests swap the chart
// factory for a stand-in and check what the element hands it. The real Chart.js is covered by the
// demo-site check.
import { describe, expect, it, vi } from "vitest";
import { stubColors } from "../test-support/analytics-ui/chart.stub.js";
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
    element.themeWatcher = () => () => {};
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

    it("gives the chart range bars and a middle line", async () => {
        const { element, factory } = setup();
        element.points = points;
        await mount(element);
        const datasets = (factory.mock.calls[0] as unknown as [HTMLCanvasElement, { data: { datasets: { type: string; data: unknown }[] } }])[1].data.datasets;
        expect(datasets.map((d) => [d.type, d.data])).toEqual([
            ["bar", [[1, 3], [0, 0]]],
            ["line", [2, 0]],
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

describe("Feature: aicarbon-trend-chart theme switching", () => {
    function setupWithWatcher() {
        const stop = vi.fn();
        let onChange: ((colors: typeof stubColors) => void) | undefined;
        const watcher = vi.fn((_chart: TrendChart, cb: (colors: typeof stubColors) => void) => {
            onChange = cb;
            return stop;
        });
        const base = setup();
        base.element.themeWatcher = watcher;
        return { ...base, stop, watcher, changeTheme: (colors: typeof stubColors) => onChange!(colors) };
    }

    const darkColors = { ...stubColors, series: stubColors.series.map((s) => ({ ...s, line: "dark-line", fill: "dark-fill", bar: "rgb(200, 210, 220)" })) };
    const barFill = (chart: TrendChart) => (chart.data.datasets[0] as { backgroundColor: string }).backgroundColor;

    it("watches the chart's theme once it is created", async () => {
        const { element, chart, watcher } = setupWithWatcher();
        element.points = points;
        await mount(element);
        expect(watcher).toHaveBeenCalledWith(chart, expect.any(Function));
        element.remove();
    });

    it("does not start a second watch when the points change", async () => {
        const { element, watcher } = setupWithWatcher();
        element.points = points;
        await mount(element);
        element.points = [points[0]];
        await element.updateComplete;
        expect(watcher).toHaveBeenCalledTimes(1);
        element.remove();
    });

    it("recolours the same chart's datasets with the new palette", async () => {
        const { element, chart, changeTheme } = setupWithWatcher();
        element.points = points;
        await mount(element);
        changeTheme(darkColors);
        expect(barFill(chart)).toBe("rgba(200, 210, 220, 0.45)");
        element.remove();
    });

    it("leaves the update to the theme watcher, which calls it itself", async () => {
        const { element, chart, changeTheme } = setupWithWatcher();
        element.points = points;
        await mount(element);
        changeTheme(darkColors);
        expect(chart.update).not.toHaveBeenCalled();
        element.remove();
    });

    it("stops watching when removed from the page", async () => {
        const { element, stop } = setupWithWatcher();
        element.points = points;
        await mount(element);
        element.remove();
        expect(stop).toHaveBeenCalledTimes(1);
    });

    it("starts a fresh watch, after stopping the old one, when moved and reconnected", async () => {
        const { element, stop, watcher } = setupWithWatcher();
        element.points = points;
        await mount(element);
        element.remove();
        document.body.appendChild(element);
        await element.updateComplete;
        expect([stop.mock.calls.length, watcher.mock.calls.length]).toEqual([1, 2]);
        element.remove();
    });

    it("stops watching when the points become empty", async () => {
        const { element, stop } = setupWithWatcher();
        element.points = points;
        await mount(element);
        element.points = [];
        await element.updateComplete;
        expect(stop).toHaveBeenCalledTimes(1);
        element.remove();
    });


describe("Feature: aicarbon-trend-chart loading", () => {
    it("first load: keeps the box and its heading, with a placeholder where the chart goes", async () => {
        const { element, factory } = setup();
        element.loading = true;
        await mount(element);
        const root = element.shadowRoot!;
        expect(root.querySelector("uui-box")!.getAttribute("headline")).toBe("CO2e Over Time");
        expect(root.querySelector(".skeleton")).not.toBeNull();
        expect(root.querySelector("canvas")).toBeNull();
        expect(factory).not.toHaveBeenCalled();
        element.remove();
    });

    it("reload: keeps the chart and shows a loading bar over it", async () => {
        const { element, factory } = setup();
        element.points = points;
        element.loading = true;
        await mount(element);
        const root = element.shadowRoot!;
        expect(root.querySelector("canvas")).not.toBeNull();
        expect(root.querySelector(".skeleton")).toBeNull();
        expect(root.querySelector("uui-loader-bar")).not.toBeNull();
        expect(factory).toHaveBeenCalledTimes(1);
        element.remove();
    });

    it("loaded: shows neither the placeholder nor the bar", async () => {
        const { element } = setup();
        element.points = points;
        await mount(element);
        expect(element.shadowRoot!.querySelector(".skeleton, uui-loader-bar")).toBeNull();
        element.remove();
    });
});

    it("draws the comparison when given comparison points, and rebuilds the same chart when they change", async () => {
        const { element, chart, factory } = setup();
        element.points = points;
        await mount(element);
        expect(chart.data.datasets).toHaveLength(0);
        const compare: EstimateTimeSeriesPointModel[] = [{ timestamp: "2026-09-01T00:00:00Z", co2eGrams: { min: 2, max: 4 } }];
        element.comparePoints = compare;
        await element.updateComplete;
        expect(factory).toHaveBeenCalledTimes(1);
        expect(chart.data.datasets.map((d) => d.label)).toEqual(["Likely range", "Middle estimate", "Comparison"]);
        element.comparePoints = undefined;
        await element.updateComplete;
        expect(chart.data.datasets).toHaveLength(2);
        element.remove();
    });
});
