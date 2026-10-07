// Chart.js needs a canvas 2D context, which happy-dom does not provide, so these tests swap the chart
// factory for a stand-in and check what the element hands it. The real Chart.js is covered by the
// demo-site check.
import { afterEach, describe, expect, it, vi } from "vitest";
import { UmbContextProviderController } from "@umbraco-cms/backoffice/context-api";
import { UmbControllerHostElementMixin } from "@umbraco-cms/backoffice/controller-api";
import { UmbStringState } from "@umbraco-cms/backoffice/observable-api";
import { UMB_THEME_CONTEXT } from "@umbraco-cms/backoffice/themes";
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

class ThemeHostElement extends UmbControllerHostElementMixin(HTMLElement) {}
customElements.define("aicarbon-test-theme-host", ThemeHostElement);

describe("Feature: aicarbon-trend-chart theme switching", () => {
    afterEach(() => vi.unstubAllGlobals());

    async function mountWithTheme() {
        const theme = new UmbStringState("umb-light-theme");
        const host = new ThemeHostElement();
        document.body.appendChild(host);
        const provider = new UmbContextProviderController(host, UMB_THEME_CONTEXT, { theme: theme.asObservable(), getHostElement: () => host } as never);
        const { element, chart, factory } = setup();
        host.appendChild(element);
        element.points = points;
        element.style.setProperty("--uui-color-text", "#111111");
        await element.updateComplete;
        await Promise.resolve();
        return { element, chart, factory, theme, provider };
    }

    const legendColor = (chart: TrendChart) => (chart.options as { plugins: { legend: { labels: { color: string } } } }).plugins.legend.labels.color;

    /** Deterministic frames: callbacks queue until flushFrames runs them, and cancelling removes them. */
    function stubFrames() {
        const queue = new Map<number, FrameRequestCallback>();
        let nextId = 1;
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            queue.set(nextId, cb);
            return nextId++;
        });
        vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
        return {
            pending: () => queue.size,
            flushFrames(count: number) {
                for (let i = 0; i < count; i++) {
                    const [id, cb] = queue.entries().next().value ?? [];
                    if (id === undefined) return;
                    queue.delete(id);
                    cb!(0);
                }
            },
        };
    }

    it("re-resolves the colours into the same chart after the theme changes", async () => {
        const frames = stubFrames();
        const { element, chart, theme, provider } = await mountWithTheme();
        element.style.setProperty("--uui-color-text", "#eeeeee");
        theme.setValue("umb-dark-theme");
        frames.flushFrames(1);
        expect(legendColor(chart)).toBe("#eeeeee");
        provider.destroy();
        element.parentElement?.remove();
    });

    it("ends on the final colours when an intermediate state comes first", async () => {
        const frames = stubFrames();
        const { element, chart, theme, provider } = await mountWithTheme();
        theme.setValue("umb-dark-theme");
        element.style.setProperty("--uui-color-text", "#aaaaaa");
        frames.flushFrames(2);
        element.style.setProperty("--uui-color-text", "#eeeeee");
        frames.flushFrames(2);
        expect(legendColor(chart)).toBe("#eeeeee");
        provider.destroy();
        element.parentElement?.remove();
    });

    it("leaves the chart untouched when the colours never change", async () => {
        const frames = stubFrames();
        const { element, chart, theme, provider } = await mountWithTheme();
        theme.setValue("umb-dark-theme");
        frames.flushFrames(1000);
        expect(chart.update).not.toHaveBeenCalled();
        provider.destroy();
        element.parentElement?.remove();
    });

    it("stops re-resolving once the colours have settled", async () => {
        const frames = stubFrames();
        const { element, theme, provider } = await mountWithTheme();
        theme.setValue("umb-dark-theme");
        element.style.setProperty("--uui-color-text", "#eeeeee");
        frames.flushFrames(20);
        expect(frames.pending()).toBe(0);
        provider.destroy();
        element.parentElement?.remove();
    });

    it("cancels a pending refresh when disconnected", async () => {
        const frames = stubFrames();
        const { element, chart, theme, provider } = await mountWithTheme();
        element.style.setProperty("--uui-color-text", "#eeeeee");
        theme.setValue("umb-dark-theme");
        element.parentElement?.remove();
        frames.flushFrames(5);
        expect(chart.update).not.toHaveBeenCalled();
        provider.destroy();
    });

    it("re-resolves when a stylesheet finishes loading after the settle window", async () => {
        const frames = stubFrames();
        const { element, chart, theme, provider } = await mountWithTheme();
        theme.setValue("umb-dark-theme");
        frames.flushFrames(1000);
        const link = document.createElement("link");
        link.rel = "stylesheet";
        document.head.appendChild(link);
        await Promise.resolve();
        element.style.setProperty("--uui-color-text", "#eeeeee");
        link.dispatchEvent(new Event("load"));
        expect(legendColor(chart)).toBe("#eeeeee");
        link.remove();
        provider.destroy();
        element.parentElement?.remove();
    });
});
