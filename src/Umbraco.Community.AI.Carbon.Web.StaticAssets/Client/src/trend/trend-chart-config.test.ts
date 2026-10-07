import type { TooltipItem } from "chart.js";
import { describe, expect, it } from "vitest";
import { color } from "chart.js/helpers";
import { translucentEquivalent, buildTrendChartConfig } from "./trend-chart-config.js";

const colors = { line: "#283a97", fill: "rgba(0,0,0,0.25)", text: "#000", grid: "#ccc" };
const yScale = (max: number) =>
    buildTrendChartConfig([{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 0, max } }], "Daily", colors).options!
        .scales!.y as { suggestedMax?: number };

describe("Feature: trend chart y-axis", () => {
    it("suggests one unit (1 mg) when every value is zero, so the axis is not 0-1,000 mg", () => {
        expect(yScale(0).suggestedMax).toBe(0.001);
    });

    it("leaves the axis maximum to Chart.js when there is data", () => {
        expect(yScale(3).suggestedMax).toBeUndefined();
    });
});

describe("Feature: translucent range fill", () => {
    const pink = "#f5c1bc";
    const composite = (fill: string, bg: { r: number; g: number; b: number }) => {
        const { r, g, b, a } = color(fill).rgb;
        return [r, g, b].map((c, i) => c * a + [bg.r, bg.g, bg.b][i] * (1 - a));
    };

    it("looks like the original colour once drawn over the background", () => {
        const shown = composite(translucentEquivalent(pink, "#ffffff"), { r: 255, g: 255, b: 255 });
        const original = color(pink).rgb;
        expect(shown.every((c, i) => Math.abs(c - [original.r, original.g, original.b][i]) <= 1)).toBe(true);
    });

    it("uses the requested alpha", () => {
        expect(color(translucentEquivalent(pink, "#ffffff", 0.5)).rgb.a).toBe(0.5);
    });

    it("defaults to an alpha of 0.35", () => {
        expect(translucentEquivalent(pink, "#ffffff")).toBe("rgba(226, 78, 64, 0.35)");
    });

    it("returns the colour unchanged when it can't be parsed", () => {
        expect(translucentEquivalent("not-a-colour", "#ffffff")).toBe("not-a-colour");
    });

    it("returns the colour unchanged, without throwing, when the background can't be parsed", () => {
        expect(translucentEquivalent(pink, "not-a-colour")).toBe(pink);
    });
});

const series = [
    { timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 4.5, max: 7.5 } },
    { timestamp: "2026-10-02T00:00:00Z", co2eGrams: { min: 0, max: 2 } },
];
const config = () => buildTrendChartConfig(series, "Daily", colors);
const tooltip = () => config().options!.plugins!.tooltip!;
const itemAt = (dataIndex: number, datasetIndex = 0) => ({ dataIndex, datasetIndex }) as TooltipItem<"bar">;

describe("Feature: trend chart datasets", () => {
    it("is a bar chart carrying a line dataset", () => {
        expect([config().type, config().data.datasets.map((d) => d.type)]).toEqual(["bar", ["bar", "line"]]);
    });

    it("gives the bars a [min, max] pair per bucket", () => {
        expect(config().data.datasets[0].data).toEqual([[4.5, 7.5], [0, 2]]);
    });

    it("gives the line the midpoint of each bucket", () => {
        expect(config().data.datasets[1].data).toEqual([6, 1]);
    });

    it("draws the line after (on top of) the bars", () => {
        const [bars, line] = config().data.datasets;
        expect(line.order).toBeLessThan(bars.order!);
    });

    it("keeps the bucket timestamps as labels", () => {
        expect(config().data.labels).toEqual(series.map((p) => p.timestamp));
    });

    it("shows a dot for a single bucket, which has no line to draw", () => {
        const single = buildTrendChartConfig([series[0]], "Daily", colors);
        expect((single.data.datasets[1] as { pointRadius: number }).pointRadius).toBe(3);
    });

    it("hides the points on the line when there are several buckets", () => {
        expect((config().data.datasets[1] as { pointRadius: number }).pointRadius).toBe(0);
    });
});

describe("Feature: trend chart legend", () => {
    it("is shown", () => {
        expect(config().options!.plugins!.legend!.display).toBe(true);
    });

    it("names the two datasets Likely range and Middle estimate", () => {
        expect(config().data.datasets.map((d) => d.label)).toEqual(["Likely range", "Middle estimate"]);
    });

    it("ignores clicks, so a dataset can't be hidden", () => {
        const legend = config().options!.plugins!.legend as { onClick: Function };
        const datasets = [{ hidden: false }];
        legend.onClick({}, { datasetIndex: 0 }, { chart: { data: { datasets } } });
        expect(datasets[0].hidden).toBe(false);
    });

    it("uses the localized labels it is given", () => {
        const localized = buildTrendChartConfig(series, "Daily", colors, undefined, { range: "R", middle: "M" });
        expect(localized.data.datasets.map((d) => d.label)).toEqual(["R", "M"]);
    });
});

describe("Feature: trend chart tooltip", () => {
    const callbacks = () => tooltip().callbacks! as { title: Function; label: Function };

    it("follows the nearest bucket, not the pointer position", () => {
        expect(config().options!.interaction).toEqual({ mode: "index", intersect: false });
    });

    it("is titled with the bucket time", () => {
        expect(callbacks().title([itemAt(0)])).toBe("1 Oct 2026");
    });

    it("shows the middle estimate and the range on one line", () => {
        expect(callbacks().label(itemAt(0))).toBe("≈ 6 g CO2e (4.5–7.5 g CO2e)");
    });

    it("shows only the central figure when the range collapses to it", () => {
        const flat = buildTrendChartConfig([{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 3, max: 3 } }], "Daily", colors);
        expect((flat.options!.plugins!.tooltip!.callbacks as { label: Function }).label(itemAt(0))).toBe("3 g CO2e");
    });

    it("lists one line per bucket by keeping only the bar dataset", () => {
        const filter = tooltip().filter as Function;
        expect([filter(itemAt(0, 0)), filter(itemAt(0, 1))]).toEqual([true, false]);
    });

    it("reads 0 g CO2e for a bucket with no emissions", () => {
        const zero = buildTrendChartConfig([{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 0, max: 0 } }], "Daily", colors);
        expect((zero.options!.plugins!.tooltip!.callbacks as { label: Function }).label(itemAt(0))).toBe("0 g CO2e");
    });
});
