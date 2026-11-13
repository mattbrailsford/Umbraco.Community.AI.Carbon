// Chart.js needs a canvas 2D context, which happy-dom does not provide, so these tests swap the chart
// factory for a stand-in and check what the element hands it. The real Chart.js is covered by the
// demo-site check.
import { describe, expect, it, vi } from "vitest";
import { stubColors } from "../test-support/analytics-ui/chart.stub.js";
import type { EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { formatBucketTitle } from "./trend-format.js";
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

    it("gives the box an h3 heading, as the Usage chart box has", async () => {
        const { element } = setup();
        element.points = points;
        await mount(element);
        expect(element.shadowRoot!.querySelector("uui-box")!.getAttribute("headline-variant")).toBe("h3");
        element.remove();
    });

    it("passes slotted header actions on to the box's header-actions slot", async () => {
        const { element } = setup();
        element.points = points;
        await mount(element);
        const forward = element.shadowRoot!.querySelector('uui-box > slot[name="header-actions"]')!;
        expect(forward.getAttribute("slot")).toBe("header-actions");
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

    const darkColors = { ...stubColors, status: { ...stubColors.status, default: { ...stubColors.status.default, bar: "rgb(200, 210, 220)" } } };
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
        expect(root.querySelector("uui-box")!.getAttribute("headline")).toBe("Estimated CO2e Over Time");
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
        expect(chart.data.datasets.map((d) => d.label)).toEqual(["Likely range", "Middle estimate", "2026-09-01 - 2026-09-01"]);
        element.comparePoints = undefined;
        await element.updateComplete;
        expect(chart.data.datasets).toHaveLength(2);
        element.remove();
    });
});

describe("Feature: aicarbon-trend-chart incomplete bucket, comparison label and plugin", () => {
    type Config = { plugins?: { id: string }[]; data: { datasets: { label: string; backgroundColor: unknown }[] }; options: { plugins: Record<string, { from?: number; now?: { label: string } }> } };
    const configOf = (factory: ReturnType<typeof setup>["factory"]) => (factory.mock.calls[0] as unknown as [HTMLCanvasElement, Config])[1];
    /** Plays the pointer arriving over a bucket, as Chart.js would call the tooltip's external handler. */
    const hoverBucket = (factory: ReturnType<typeof setup>["factory"], dataIndex: number) => {
        const external = (configOf(factory).options.plugins["tooltip"] as unknown as { external: Function }).external;
        external({ tooltip: { opacity: 1, dataPoints: [{ dataIndex }], caretX: 10 + dataIndex, caretY: 20 } });
    };
    const days = [
        { timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 1, max: 3 } },
        { timestamp: "2026-10-02T00:00:00Z", co2eGrams: { min: 1, max: 3 } },
    ];

    it("passes the chart its own incomplete plugin, and registers nothing globally", async () => {
        const { element, factory } = setup();
        element.points = points;
        await mount(element);
        expect(configOf(factory).plugins!.map((p) => p.id)).toEqual(["aicarbonIncomplete"]);
        element.remove();
    });

    it("marks today's day, in the estimate's zone, as the incomplete bucket", async () => {
        const { element, factory } = setup();
        element.now = () => new Date("2026-10-02T10:00:00Z");
        element.timeZone = "UTC";
        element.points = days;
        await mount(element);
        expect(configOf(factory).options.plugins["aicarbonIncomplete"].from).toBe(1);
        element.remove();
    });

    it("uses the estimate's zone, not the browser's, to find today", async () => {
        const { element, factory } = setup();
        // 2 October 05:00 UTC is still 1 October in Honolulu (UTC-10), whose days start at 10:00 UTC; read in UTC it would be the second day.
        element.now = () => new Date("2026-10-02T05:00:00Z");
        element.timeZone = "Pacific/Honolulu";
        element.points = [
            { timestamp: "2026-10-01T10:00:00Z", co2eGrams: { min: 1, max: 3 } },
            { timestamp: "2026-10-02T10:00:00Z", co2eGrams: { min: 1, max: 3 } },
        ];
        await mount(element);
        expect(configOf(factory).options.plugins["aicarbonIncomplete"].from).toBe(0);
        element.remove();
    });

    it("marks nothing incomplete when the range is in the past", async () => {
        const { element, factory } = setup();
        element.now = () => new Date("2026-11-20T10:00:00Z");
        element.points = days;
        await mount(element);
        expect(configOf(factory).options.plugins["aicarbonIncomplete"].from).toBeUndefined();
        element.remove();
    });

    it("fades the incomplete bar and draws no now line by day", async () => {
        const { element, factory } = setup();
        element.now = () => new Date("2026-10-02T10:00:00Z");
        element.timeZone = "UTC";
        element.points = days;
        await mount(element);
        const config = configOf(factory);
        expect([Array.isArray(config.data.datasets[0].backgroundColor), config.options.plugins["aicarbonIncomplete"].now]).toEqual([true, undefined]);
        element.remove();
    });

    it("marks the current hour at Hourly and draws the now line there", async () => {
        const { element, factory } = setup();
        element.granularity = "Hourly";
        element.now = () => new Date("2026-10-02T10:30:00Z");
        element.points = [
            { timestamp: "2026-10-02T09:00:00Z", co2eGrams: { min: 1, max: 3 } },
            { timestamp: "2026-10-02T10:00:00Z", co2eGrams: { min: 1, max: 3 } },
        ];
        await mount(element);
        expect(configOf(factory).options.plugins["aicarbonIncomplete"]).toMatchObject({ from: 1, now: { label: expect.any(String) } });
        element.remove();
    });

    it("words the incomplete tooltip title as Analytics.UI does", async () => {
        const { element, factory } = setup();
        element.now = () => new Date("2026-10-02T10:00:00Z");
        element.timeZone = "UTC";
        element.points = days;
        await mount(element);
        hoverBucket(factory, 1);
        // No translations are registered here, so this is the fallback text: the date must still be in it.
        expect(element["_tooltip"]!.heading).toBe("2 Oct 2026 (incomplete)");
        element.remove();
    });

    it("names only the current hour as now at Hourly, and the hours after it as incomplete", async () => {
        const { element, factory } = setup();
        element.granularity = "Hourly";
        element.now = () => new Date("2026-10-02T10:30:00Z");
        element.points = [
            { timestamp: "2026-10-02T10:00:00Z", co2eGrams: { min: 1, max: 3 } },
            { timestamp: "2026-10-02T11:00:00Z", co2eGrams: { min: 1, max: 3 } },
        ];
        await mount(element);
        const heading = (dataIndex: number) => {
            hoverBucket(factory, dataIndex);
            return element["_tooltip"]!.heading;
        };
        // No translations are registered here, so these are the fallback texts: the date must still be in them.
        expect([heading(0), heading(1)]).toEqual([
            `${formatBucketTitle("2026-10-02T10:00:00Z", "Hourly")} (now, incomplete)`,
            `${formatBucketTitle("2026-10-02T11:00:00Z", "Hourly")} (incomplete)`,
        ]);
        element.remove();
    });

    it("labels the comparison in the legend with its own date range", async () => {
        const { element, factory } = setup();
        element.points = days;
        element.timeZone = "UTC";
        element.comparePoints = [
            { timestamp: "2026-09-30T00:00:00Z", co2eGrams: { min: 1, max: 3 } },
            { timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 1, max: 3 } },
        ];
        await mount(element);
        expect(configOf(factory).data.datasets[2].label).toBe("2026-09-30 - 2026-10-01");
        element.remove();
    });

    it("renders the hovered bucket in the tooltip element, and removes it when the pointer leaves", async () => {
        const { element, factory } = setup();
        element.points = days;
        await mount(element);
        hoverBucket(factory, 0);
        await element.updateComplete;
        const shown = element.shadowRoot!.querySelector("aicarbon-trend-tooltip") as unknown as { model: { heading: string } } | null;
        const heading = shown?.model.heading;
        const external = (configOf(factory).options.plugins["tooltip"] as unknown as { external: Function }).external;
        external({ tooltip: { opacity: 0, dataPoints: [], caretX: 0, caretY: 0 } });
        await element.updateComplete;
        expect([heading, element.shadowRoot!.querySelector("aicarbon-trend-tooltip")]).toEqual(["1 Oct 2026", null]);
        element.remove();
    });

    it("keeps the tooltip out of the accessibility tree: the canvas carries the summary", async () => {
        const { element, factory } = setup();
        element.points = days;
        await mount(element);
        hoverBucket(factory, 0);
        await element.updateComplete;
        expect(element.shadowRoot!.querySelector("aicarbon-trend-tooltip")!.getAttribute("aria-hidden")).toBe("true");
        element.remove();
    });

    it("drops a hovered tooltip when the chart is destroyed, so it is not there when the element comes back", async () => {
        const { element, factory } = setup();
        element.points = days;
        await mount(element);
        hoverBucket(factory, 0);
        await element.updateComplete;
        element.remove();
        document.body.appendChild(element);
        await element.updateComplete;
        expect(element.shadowRoot!.querySelector("aicarbon-trend-tooltip")).toBeNull();
        element.remove();
    });

    it("redraws the tooltip when a data refresh changes its figures under the same bucket", async () => {
        const { element, chart } = setup();
        element.points = days;
        await mount(element);
        // The chart keeps one options object, which the element replaces on a refresh; hover through its current handler.
        const hover = () =>
            (chart.options!.plugins!.tooltip as unknown as { external: Function }).external({ tooltip: { opacity: 1, dataPoints: [{ dataIndex: 0 }], caretX: 10, caretY: 20 } });
        // The stand-in chart gets its options from the first refresh.
        element.points = days.map((d) => ({ ...d }));
        await element.updateComplete;
        hover();
        const before = element["_tooltip"]!.middle.text;
        element.points = days.map((d) => ({ ...d, co2eGrams: { min: 10, max: 30 } }));
        await element.updateComplete;
        hover();
        expect([before, element["_tooltip"]!.middle.text]).toEqual(["≈ 2 g CO2e", "≈ 20 g CO2e"]);
        element.remove();
    });
});
