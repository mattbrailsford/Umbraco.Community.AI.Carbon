import { describe, expect, it } from "vitest";
import { stubColors, uauiChartOptions } from "../test-support/analytics-ui/chart.stub.js";
import { buildTrendChartConfig, withAlpha, type TrendChartOptions, type TrendIncomplete, type TrendLegendLabels, type TrendTooltipModel } from "./trend-chart-config.js";
import { formatBucketTitle } from "./trend-format.js";

const colors = stubColors;
const look = uauiChartOptions(document.body, "bar");
const build = (
    points: Parameters<typeof buildTrendChartConfig>[0],
    yAxisTitle?: (unit: string) => string,
    legendLabels?: TrendLegendLabels,
) => buildTrendChartConfig(points, "Daily", colors, look, { yAxisTitle, legendLabels });
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

/** What the chart hands the element's tooltip handler when the pointer is over bucket `dataIndex` (opacity 0 is the pointer leaving). */
function hover(
    points: Parameters<typeof buildTrendChartConfig>[0],
    dataIndex: number,
    extra: { compare?: TrendChartOptions["comparePoints"]; incomplete?: TrendIncomplete; opacity?: number } = {},
): TrendTooltipModel | undefined | "not called" {
    let got: TrendTooltipModel | undefined | "not called" = "not called";
    const cfg = buildTrendChartConfig(points, "Daily", colors, look, { comparePoints: extra.compare, incomplete: extra.incomplete, onTooltip: (m) => (got = m) });
    const external = cfg.options!.plugins!.tooltip!.external as Function;
    external({ tooltip: { opacity: extra.opacity ?? 1, dataPoints: [{ dataIndex }], caretX: 40, caretY: 60 } });
    return got;
}

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
    it("follows the nearest bucket, not the pointer position", () => {
        expect(config().options!.interaction).toEqual({ mode: "index", intersect: false });
    });

    it("is an HTML tooltip: the canvas one is off and the chart hands the bucket on", () => {
        expect([tooltip().enabled, typeof tooltip().external]).toEqual([false, "function"]);
    });

    it("is titled with the bucket date", () => {
        expect((hover(series, 0) as TrendTooltipModel).heading).toBe("1 Oct 2026");
    });

    it("gives the middle estimate and, apart from it, the likely range", () => {
        expect((hover(series, 0) as TrendTooltipModel).middle).toEqual({ text: "≈ 6 g CO2e", range: "4.5–7.5 g CO2e" });
    });

    it("gives only the central figure when the range collapses to it", () => {
        const flat = [{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 3, max: 3 } }];
        expect((hover(flat, 0) as TrendTooltipModel).middle).toEqual({ text: "3 g CO2e", range: undefined });
    });

    it("reads 0 g CO2e for a bucket with no emissions", () => {
        const zero = [{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 0, max: 0 } }];
        expect((hover(zero, 0) as TrendTooltipModel).middle.text).toBe("0 g CO2e");
    });

    it("passes the bucket's position in the canvas, for placing the tooltip", () => {
        expect([(hover(series, 0) as TrendTooltipModel).x, (hover(series, 0) as TrendTooltipModel).y]).toEqual([40, 60]);
    });

    it("hides the tooltip when the pointer leaves", () => {
        expect(hover(series, 0, { opacity: 0 })).toBeUndefined();
    });
});

describe("Feature: trend chart colours come from the Analytics.UI palette", () => {
    it("draws the range bars as the neutral (status default) bar colour at partial alpha, not the blue series one", () => {
        expect((config().data.datasets[0] as { backgroundColor: string }).backgroundColor).toBe("rgba(120, 130, 140, 0.45)");
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
        expect([line.borderColor, line.pointBackgroundColor]).toEqual(["rgb(1, 2, 3)", "rgb(1, 2, 3)"]);
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

describe("Feature: trend chart compared with a previous period", () => {
    const compare = [
        { timestamp: "2026-09-01T00:00:00Z", co2eGrams: { min: 2, max: 4 } },
        { timestamp: "2026-09-02T00:00:00Z", co2eGrams: { min: 6, max: 10 } },
    ];
    const withCompare = (points = series, previous = compare, labels?: TrendLegendLabels) =>
        buildTrendChartConfig(points, "Daily", colors, look, { legendLabels: labels, comparePoints: previous });
    const compareDataset = (cfg = withCompare()) => cfg.data.datasets[2] as unknown as Record<string, unknown>;
    const tip = (index: number, previous = compare, points = series) => hover(points, index, { compare: previous }) as TrendTooltipModel;

    it("adds no dataset without a comparison", () => {
        expect(build(series).data.datasets).toHaveLength(2);
    });

    it("adds no dataset for an empty comparison", () => {
        expect(withCompare(series, []).data.datasets).toHaveLength(2);
    });

    it("draws the previous period's midpoint as a line, point i against point i", () => {
        expect([compareDataset().type, compareDataset().data]).toEqual(["line", [3, 8]]);
    });

    it("leaves the labels to the current period", () => {
        expect(withCompare().data.labels).toEqual(series.map((p) => p.timestamp));
    });

    it("draws the line dashed and in the palette's compare colour", () => {
        expect([compareDataset().borderColor, compareDataset().borderDash]).toEqual(["compare", [5, 4]]);
    });

    it("draws it under the current line", () => {
        expect(Number(compareDataset().order)).toBeGreaterThan(-1);
        expect(Number(compareDataset().order)).toBeLessThan(Number(config().data.datasets[1].order));
    });

    it("leaves points empty where the previous period is shorter", () => {
        const longer = [...series, { timestamp: "2026-10-03T00:00:00Z", co2eGrams: { min: 1, max: 1 } }];
        expect(compareDataset(withCompare(longer)).data).toEqual([3, 8, null]);
    });

    it("drops points where the previous period is longer", () => {
        const longer = [...compare, { timestamp: "2026-09-03T00:00:00Z", co2eGrams: { min: 9, max: 9 } }];
        expect(compareDataset(withCompare(series, longer)).data).toEqual([3, 8]);
    });

    it("breaks the line at a missing point instead of bridging it", () => {
        expect(compareDataset().spanGaps).toBe(false);
    });

    it("names the line with the localized comparison label", () => {
        expect(compareDataset(withCompare(series, compare, { range: "r", middle: "m", comparison: "Sammenligning" })).label).toBe("Sammenligning");
    });

    it("names it Comparison by default", () => {
        expect(compareDataset().label).toBe("Comparison");
    });

    it("keeps the current period's bars and line as they were", () => {
        expect(withCompare().data.datasets.slice(0, 2)).toEqual(config().data.datasets);
    });

    it("shows the previous period's bucket in the tooltip where it has a point", () => {
        expect(tip(1).compare).toBeDefined();
    });

    it("shows no previous bucket where the previous period has no point", () => {
        const longer = [...series, { timestamp: "2026-10-03T00:00:00Z", co2eGrams: { min: 1, max: 1 } }];
        expect(tip(2, compare, longer).compare).toBeUndefined();
    });

    it("gives the previous bucket its figure, range and own date", () => {
        expect(tip(0).compare).toMatchObject({ text: "≈ 3 g CO2e", range: "2–4 g CO2e", date: formatBucketTitle(compare[0].timestamp, "Daily") });
    });

    it("gives the two middle estimates for the change badge (current, then previous)", () => {
        expect([tip(0).compare!.current, tip(0).compare!.previous]).toEqual([6, 3]);
    });

    it("keeps the current period's figure and date as without a comparison", () => {
        expect([tip(0).heading, tip(0).middle]).toEqual(["1 Oct 2026", { text: "≈ 6 g CO2e", range: "4.5–7.5 g CO2e" }]);
    });

    it("reads both periods' dates one by one", () => {
        expect(tip(1).compare!.date).toBe(formatBucketTitle(compare[1].timestamp, "Daily"));
    });

    it("picks the axis unit from the larger period, so a bigger previous period is not squashed", () => {
        const big = [{ timestamp: "2026-09-01T00:00:00Z", co2eGrams: { min: 4000, max: 6000 } }];
        const units: string[] = [];
        buildTrendChartConfig(series, "Daily", colors, look, { yAxisTitle: (unit) => (units.push(unit), unit), comparePoints: big });
        expect(units).toEqual(["kg"]);
    });
});

describe("Feature: trend chart legend order and swatches", () => {
    const compare = [
        { timestamp: "2026-09-01T00:00:00Z", co2eGrams: { min: 2, max: 4 } },
        { timestamp: "2026-09-02T00:00:00Z", co2eGrams: { min: 6, max: 10 } },
    ];
    const legend = (cfg: ReturnType<typeof build>) =>
        cfg.options!.plugins!.legend!.labels as {
            sort: (a: { datasetIndex: number }, b: { datasetIndex: number }) => number;
            generateLabels: (chart: { data: ReturnType<typeof build>["data"] }) => { text: string; pointStyle: string; lineDash: number[]; datasetIndex: number }[];
            usePointStyle: boolean;
        };
    const withCompare = (labels?: TrendLegendLabels) => buildTrendChartConfig(series, "Daily", colors, look, { legendLabels: labels, comparePoints: compare });

    it("lists Likely range, Middle estimate, then the comparison, though the comparison draws first", () => {
        const cfg = withCompare({ range: "R", middle: "M", comparison: "1 Sep to 2 Sep" });
        const items = legend(cfg).generateLabels({ data: cfg.data });
        expect(items.map((i) => i.text)).toEqual(["R", "M", "1 Sep to 2 Sep"]);
    });

    it("sorts legend entries by dataset index, not draw order", () => {
        expect([legend(withCompare()).sort({ datasetIndex: 2 }, { datasetIndex: 0 }) > 0, legend(withCompare()).sort({ datasetIndex: 0 }, { datasetIndex: 2 }) < 0]).toEqual([true, true]);
    });

    it("still draws the comparison last and the line over the bars", () => {
        expect(withCompare().data.datasets.map((d) => d.order)).toEqual([2, 1, 0]);
    });

    it("gives the comparison a dashed line swatch, the middle a solid line and the range a block", () => {
        const cfg = withCompare();
        const items = legend(cfg).generateLabels({ data: cfg.data });
        expect(items.map((i) => [i.pointStyle, i.lineDash])).toEqual([["rect", []], ["line", []], ["line", [5, 4]]]);
    });

    it("draws swatches as point styles", () => {
        expect(legend(withCompare()).usePointStyle).toBe(true);
    });
});

describe("Feature: trend chart incomplete bucket", () => {
    const three = [...series, { timestamp: "2026-10-03T00:00:00Z", co2eGrams: { min: 1, max: 3 } }];
    const incomplete: TrendIncomplete = { from: 2, title: (t: string, isNow: boolean) => `${t} [${isNow ? "now" : "inc"}]` };
    const withIncomplete = (extra = incomplete) => buildTrendChartConfig(three, "Daily", colors, look, { incomplete: extra });
    const bars = (cfg = withIncomplete()) => cfg.data.datasets[0] as { backgroundColor: string | string[] };
    const line = (cfg = withIncomplete()) => cfg.data.datasets[1] as unknown as { borderColor: string; segment?: { borderColor: (ctx: { p1DataIndex: number }) => string | undefined } };
    const pluginOptions = (cfg = withIncomplete()) => (cfg.options!.plugins as Record<string, { from?: number; hatch?: string; now?: { label: string } }>)["aicarbonIncomplete"];

    it("keeps one colour for every bar when nothing is incomplete", () => {
        expect(typeof bars(buildTrendChartConfig(three, "Daily", colors, look)).backgroundColor).toBe("string");
    });

    it("fades the incomplete bar's fill, one colour per bar", () => {
        expect(bars().backgroundColor).toEqual(["rgba(120, 130, 140, 0.45)", "rgba(120, 130, 140, 0.45)", "rgba(120, 130, 140, 0.225)"]);
    });

    it("fades the line's last segment only", () => {
        const segment = line().segment!.borderColor;
        expect([segment({ p1DataIndex: 1 }), segment({ p1DataIndex: 2 })]).toEqual([undefined, "rgba(1, 2, 3, 0.5)"]);
    });

    it("hands the plugin the incomplete index and a hatch colour made from the text colour", () => {
        expect(pluginOptions()).toMatchObject({ from: 2 });
        expect(pluginOptions().hatch).toBe("rgba(128, 128, 128, 0.1)");
    });

    it("hands the plugin no index when nothing is incomplete", () => {
        expect(pluginOptions(buildTrendChartConfig(three, "Daily", colors, look)).from).toBeUndefined();
    });

    it("draws no now line by day", () => {
        expect(pluginOptions().now).toBeUndefined();
    });

    it("draws a now line at the incomplete hour when given a label", () => {
        expect(pluginOptions(withIncomplete({ ...incomplete, nowLabel: "Now" })).now).toMatchObject({ index: 2, label: "Now" });
    });

    it("adds the incomplete wording to the title of that bucket and later ones only", () => {
        const heading = (index: number) => (hover(three, index, { incomplete }) as TrendTooltipModel).heading;
        expect([heading(1), heading(2)]).toEqual(["2 Oct 2026", "3 Oct 2026 [inc]"]);
    });

    it("names the now bucket as now only when a now line is drawn, and later buckets as plain incomplete", () => {
        const heading = (index: number) => (hover(three, index, { incomplete: { ...incomplete, from: 1, nowLabel: "Now" } }) as TrendTooltipModel).heading;
        expect([heading(1), heading(2)]).toEqual(["2 Oct 2026 [now]", "3 Oct 2026 [inc]"]);
    });

    it("does not fade or hatch the comparison line", () => {
        const cfg = buildTrendChartConfig(three, "Daily", colors, look, { comparePoints: series, incomplete });
        expect((cfg.data.datasets[2] as { segment?: unknown }).segment).toBeUndefined();
    });
});
