import type { TooltipItem } from "@umbraco/analytics-ui/external/chart.js";
import { describe, expect, it } from "vitest";
import { stubColors, uauiChartOptions } from "../test-support/analytics-ui/chart.stub.js";
import { buildTrendChartConfig, withAlpha, type TrendLegendLabels } from "./trend-chart-config.js";

const colors = stubColors;
const look = uauiChartOptions(document.body, "bar");
const build = (
    points: Parameters<typeof buildTrendChartConfig>[0],
    yAxisTitle?: (unit: string) => string,
    legendLabels?: TrendLegendLabels,
) => buildTrendChartConfig(points, "Daily", colors, look, yAxisTitle, legendLabels);
const yScale = (max: number) =>
    build([{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 0, max } }]).options!
        .scales!.y as { suggestedMax?: number };

describe("Feature: trend chart y-axis", () => {
    it("suggests one unit (1 mg) when every value is zero, so the axis is not 0-1,000 mg", () => {
        expect(yScale(0).suggestedMax).toBe(0.001);
    });

    it("leaves the axis maximum to Chart.js when there is data", () => {
        expect(yScale(3).suggestedMax).toBeUndefined();
    });
});

const series = [
    { timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 4.5, max: 7.5 } },
    { timestamp: "2026-10-02T00:00:00Z", co2eGrams: { min: 0, max: 2 } },
];
const config = () => build(series);
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
        const single = build([series[0]]);
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
        const localized = build(series, undefined, { range: "R", middle: "M" });
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
        const flat = build([{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 3, max: 3 } }]);
        expect((flat.options!.plugins!.tooltip!.callbacks as { label: Function }).label(itemAt(0))).toBe("3 g CO2e");
    });

    it("lists one line per bucket by keeping only the bar dataset", () => {
        const filter = tooltip().filter as Function;
        expect([filter(itemAt(0, 0)), filter(itemAt(0, 1))]).toEqual([true, false]);
    });

    it("reads 0 g CO2e for a bucket with no emissions", () => {
        const zero = build([{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 0, max: 0 } }]);
        expect((zero.options!.plugins!.tooltip!.callbacks as { label: Function }).label(itemAt(0))).toBe("0 g CO2e");
    });
});

describe("Feature: trend chart colours come from the Analytics.UI palette", () => {
    it("draws the range bars as the first series bar colour at partial alpha", () => {
        expect((config().data.datasets[0] as { backgroundColor: string }).backgroundColor).toBe("rgba(10, 20, 30, 0.45)");
    });

    it("draws the range bars without an outline, so the legend swatch is the fill alone", () => {
        expect((config().data.datasets[0] as { borderWidth: number }).borderWidth).toBe(0);
    });

    it("keeps the band a different colour from the middle line", () => {
        const [bars, line] = config().data.datasets as { backgroundColor: string; borderColor?: string }[];
        expect(bars.backgroundColor).not.toBe(line.borderColor);
    });

    it("draws the middle line in the first series line colour", () => {
        const line = config().data.datasets[1] as { borderColor: string; pointBackgroundColor: string };
        expect([line.borderColor, line.pointBackgroundColor]).toEqual(["series-1-line", "series-1-line"]);
    });

    it("colours the tooltip from the palette surface, text and grid", () => {
        expect([tooltip().backgroundColor, tooltip().bodyColor, tooltip().titleColor, tooltip().borderColor]).toEqual(["surface", "text", "text", "grid"]);
    });

    it("colours the y-axis title from the palette text", () => {
        expect((config().options!.scales!.y as { title: { color: string } }).title.color).toBe("text");
    });
});

describe("Feature: trend chart keeps the Analytics.UI look", () => {
    it("keeps the look's axis grid and tick colours", () => {
        const { x, y } = config().options!.scales as { x: { grid: object; ticks: { color: string } }; y: { grid: object; ticks: { color: string } } };
        expect([x.grid, x.ticks.color, y.grid, y.ticks.color]).toEqual([{ display: false }, "text", { color: "grid" }, "text"]);
    });

    it("keeps the look's legend label colour while turning the legend on", () => {
        expect(config().options!.plugins!.legend!.labels!.color).toBe("text");
    });

    it("keeps the look's tooltip font", () => {
        expect((tooltip() as { titleFont: object }).titleFont).toEqual({ family: "font" });
    });

    it("enables the tooltip explicitly, as another product may have turned it off", () => {
        expect(tooltip().enabled).toBe(true);
    });

    it("tells the axis to label ticks with the local-time bucket label", () => {
        const ticks = (config().options!.scales!.x as { ticks: { callback: Function } }).ticks;
        expect(ticks.callback(0)).toBe("1 Oct");
    });
});

describe("Feature: withAlpha", () => {
    it("applies the alpha to an rgb() colour", () => {
        expect(withAlpha("rgb(1, 2, 3)", 0.5, "x")).toBe("rgba(1, 2, 3, 0.5)");
    });

    it("applies the alpha to a color(srgb) colour", () => {
        expect(withAlpha("color(srgb 0.1 0.2 0.3)", 0.5, "x")).toBe("color(srgb 0.1 0.2 0.3 / 0.5)");
    });

    it("returns the fallback for a colour it can't read", () => {
        expect(withAlpha("not-a-colour", 0.5, "fallback")).toBe("fallback");
    });
});
