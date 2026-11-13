import type { ChartConfiguration, ChartOptions, UauiChartColors } from "@umbraco/analytics-ui/external/chart.js";
import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { co2eAxisUnit, formatCo2eAxisValue, formatCo2eFigure } from "../estimate/format-co2.js";
import { toTrendBand } from "../estimate/trend-dataset.js";
import { INCOMPLETE_PLUGIN_ID, createIncompletePlugin } from "./incomplete-plugin.js";
import { formatBucketLabel, formatBucketTitle } from "./trend-format.js";

export type TrendChartConfiguration = ChartConfiguration<"bar" | "line", (number | [number, number] | null)[], string>;

const MAX_X_TICKS = 12;

/** Legend text for the datasets (the element passes localized text). */
export interface TrendLegendLabels {
    range: string;
    middle: string;
    /** The compared period's legend entry: its date range, as Analytics.UI's own chart labels it ("Oct 31, 2026 to Nov 6, 2026"). */
    comparison?: string;
}

const DEFAULT_LEGEND_LABELS: TrendLegendLabels = { range: "Likely range", middle: "Middle estimate", comparison: "Comparison" };

/** The period that is not finished yet: the bucket that contains now, and everything after it. */
export interface TrendIncomplete {
    /** Index of the first incomplete bucket. */
    from: number;
    /** The tooltip title of an incomplete bucket, given the plain title and whether it is the one that is now (only with `nowLabel`). */
    title: (plainTitle: string, isNow: boolean) => string;
    /** Draws a now line, with this label, at that bucket. Only for Hourly, as the Usage chart does: at Daily the hatch already marks today. */
    nowLabel?: string;
}

/** What the hover tooltip shows for one bucket: text is already formatted; the element lays it out and localizes its labels. */
export interface TrendTooltipModel {
    /** The bucket's date, with the incomplete wording where it applies. */
    heading: string;
    /** The middle estimate ("≈ 23 g CO2e") and its likely range ("18–28 g CO2e"; absent when it collapses to the figure). */
    middle: { text: string; range?: string };
    /** The compared period's bucket: its middle estimate and range, its own date, and the two middles for the change badge. */
    compare?: { text: string; range?: string; date: string; current: number; previous: number };
    /** The hovered bucket's position in the canvas, in CSS pixels. */
    x: number;
    y: number;
}

/** Receives the tooltip to show, or undefined to hide it. */
export type TrendTooltipHandler = (tooltip: TrendTooltipModel | undefined) => void;

/** Room above the plot for the now label, as Analytics.UI's chart reserves. */
const NOW_LABEL_ROOM = 16;
/** How much of its colour the incomplete bucket keeps. */
const INCOMPLETE_FADE = 0.5;

/** The compare line's width and dash, as Analytics.UI draws its own compare lines. */
const COMPARE_LINE_WIDTH = 1.75;
const COMPARE_DASH = [5, 4];

const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/;
const COLOR_SRGB = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/;

/**
 * `colour` (a computed `rgb()` or `color(srgb ...)` string, as the palette gives) at `alpha`. A colour in any other form
 * is returned as `fallback`, so a palette change can make the band paler but never invisible or throw.
 */
export function withAlpha(colour: string, alpha: number, fallback: string): string {
    const rgb = RGB.exec(colour);
    if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
    const srgb = COLOR_SRGB.exec(colour);
    if (srgb) return `color(srgb ${srgb[1]} ${srgb[2]} ${srgb[3]} / ${alpha})`;
    return fallback;
}

/** The optional parts of the trend chart: text, the compared period, the zone, the unfinished period and the tooltip hand-off. */
export interface TrendChartOptions {
    /** The y-axis title, given the axis unit ("g", "kg"). */
    yAxisTitle?: (unitLabel: string) => string;
    legendLabels?: TrendLegendLabels;
    /** The compared period's points, drawn as a dashed line lined up by position. */
    comparePoints?: readonly EstimateTimeSeriesPointModel[];
    /** The zone Daily buckets were counted in; unset means the viewer's. */
    dayTimeZone?: string;
    incomplete?: TrendIncomplete;
    /** Receives the tooltip to show, or undefined to hide it. */
    onTooltip?: TrendTooltipHandler;
}

/** Strong enough to read as a band behind the line in light, dark and high contrast, light enough that the gridlines show through. */
const RANGE_ALPHA = 0.45;

/**
 * The Chart.js configuration for the trend: a floating bar per bucket spanning its likely range
 * (min to max) behind a line through the middle estimate (the midpoint, as on the summary cards).
 * Looks come from the Analytics.UI palette (`colors`) and base options (`look`, from `uauiChartOptions`); the range is the
 * palette's neutral grey (`status.default`) at partial alpha, with no outline (an outline on ~160 narrow bars blurs into the
 * line), so the band reads as a fill and stays distinct from the blue line in every theme (in dark the first series' bar and
 * line are the same blue, which hid the line).
 */
export function buildTrendChartConfig(
    points: readonly EstimateTimeSeriesPointModel[],
    granularity: AiUsagePeriod,
    colors: UauiChartColors,
    look: ChartOptions<"bar">,
    options: TrendChartOptions = {},
): TrendChartConfiguration {
    const {
        yAxisTitle = (unit: string) => `${unit} CO2e`,
        legendLabels = DEFAULT_LEGEND_LABELS,
        comparePoints,
        dayTimeZone,
        incomplete,
        onTooltip = () => {},
    } = options;
    const band = toTrendBand(points);
    // The compared period lines up by position (point i under point i); where it is shorter, the line stops, and where it is longer, the extra points are dropped.
    const compare = comparePoints && comparePoints.length > 0 ? toTrendBand(comparePoints.slice(0, points.length)) : undefined;
    const unit = co2eAxisUnit(Math.max(0, ...band.upper, ...(compare?.upper ?? [])));
    const middle = band.lower.map((min, index) => (min + band.upper[index]) / 2);
    const compareMiddle = compare ? band.labels.map((_, i): number | null => (i < compare.lower.length ? (compare.lower[i] + compare.upper[i]) / 2 : null)) : undefined;
    const compareIndex = 2;
    // One point has no line to draw, so show it as a dot.
    const pointRadius = points.length === 1 ? 3 : 0;
    const series = colors.series[0];
    const neutral = colors.status.default;
    const rangeColour = withAlpha(neutral.bar, RANGE_ALPHA, neutral.fill);
    const fadedRange = withAlpha(neutral.bar, RANGE_ALPHA * INCOMPLETE_FADE, neutral.fill);
    const fadedLine = withAlpha(series.line, INCOMPLETE_FADE, series.line);
    const from = incomplete?.from;
    const lookX = look.scales?.x as { ticks?: object } | undefined;
    const lookY = look.scales?.y as { ticks?: object } | undefined;

    return {
        type: "bar",
        data: {
            labels: band.labels,
            datasets: [
                {
                    type: "bar",
                    label: legendLabels.range,
                    // Native floating bars: each bar runs from [min, max].
                    data: band.lower.map((min, index): [number, number] => [min, band.upper[index]]),
                    // No border: the translucent fill carries the band. An incomplete bucket's bar is fainter, one colour per bar.
                    backgroundColor: from === undefined ? rangeColour : band.labels.map((_, i) => (i >= from ? fadedRange : rangeColour)),
                    borderWidth: 0,
                    // Wide enough that 168 hourly bars stay readable, with a gap so 24 or 30 do not merge.
                    barPercentage: 0.9,
                    categoryPercentage: 0.9,
                    order: 2,
                },
                {
                    type: "line",
                    label: legendLabels.middle,
                    data: middle,
                    borderColor: series.line,
                    backgroundColor: series.line,
                    borderWidth: 2,
                    pointRadius,
                    pointHoverRadius: 4,
                    pointBackgroundColor: series.line,
                    cubicInterpolationMode: "monotone",
                    // The line into an incomplete bucket is fainter.
                    ...(from === undefined
                        ? {}
                        : { segment: { borderColor: (ctx: { p1DataIndex: number }) => (ctx.p1DataIndex >= from ? fadedLine : undefined) } }),
                    // A lower order draws later, so the line sits on top of the bars.
                    order: 1,
                },
                ...(compareMiddle
                    ? [
                          {
                              type: "line" as const,
                              label: legendLabels.comparison ?? DEFAULT_LEGEND_LABELS.comparison!,
                              data: compareMiddle,
                              borderColor: colors.compare,
                              backgroundColor: colors.compare,
                              borderWidth: COMPARE_LINE_WIDTH,
                              borderDash: COMPARE_DASH,
                              pointRadius: compareMiddle.filter((v) => v !== null).length === 1 ? 3 : 0,
                              pointHoverRadius: 4,
                              pointBackgroundColor: colors.compare,
                              cubicInterpolationMode: "monotone" as const,
                              spanGaps: false,
                              order: 0,
                          },
                      ]
                    : []),
            ],
        },
        options: {
            ...look,
            interaction: { mode: "index", intersect: false },
            plugins: {
                ...look.plugins,
                // The legend is only a key: clicking an entry does nothing, so no series can be hidden.
                // Set explicitly: the look turns it off, and another product may have registered the plugin.
                legend: {
                    ...look.plugins?.legend,
                    display: true,
                    position: "bottom",
                    onClick: () => {},
                    labels: {
                        ...look.plugins?.legend?.labels,
                        boxWidth: 16,
                        boxHeight: 12,
                        usePointStyle: true,
                        // Chart.js sorts the legend by draw order, which would list the comparison first: list the datasets as they are
                        // declared (range, middle, comparison) instead. The swatches: a block for the range, a line for the middle
                        // estimate and a dashed line for the comparison, as the lines are drawn.
                        sort: (a, b) => a.datasetIndex! - b.datasetIndex!,
                        generateLabels: (chart) =>
                            chart.data.datasets.map((dataset, datasetIndex) => {
                                const isRange = datasetIndex === 0;
                                const isCompare = datasetIndex === compareIndex;
                                return {
                                    text: dataset.label ?? "",
                                    datasetIndex,
                                    hidden: false,
                                    fontColor: colors.text,
                                    pointStyle: isRange ? "rect" : "line",
                                    fillStyle: isRange ? rangeColour : (dataset.borderColor as string),
                                    strokeStyle: isRange ? rangeColour : (dataset.borderColor as string),
                                    lineWidth: isRange ? 0 : (dataset.borderWidth as number),
                                    lineDash: isCompare ? COMPARE_DASH : [],
                                };
                            }),
                    },
                },
                [INCOMPLETE_PLUGIN_ID]: {
                    from,
                    hatch: withAlpha(colors.text, 0.1, "rgba(128, 128, 128, 0.1)"),
                    now: incomplete?.nowLabel === undefined || from === undefined ? undefined : { index: from, label: incomplete.nowLabel, color: colors.text, fontFamily: colors.fontFamily },
                },
                // An HTML tooltip drawn by the element (like Analytics.UI's own chart), not Chart.js's canvas one: the plugin
                // still tracks the hovered bucket and calls `external`, which hands it on.
                // The unit is picked per bucket (as on the summary cards, so a tiny bucket reads "4 mg"), while the axis uses
                // one unit for the whole series. The difference is on purpose.
                tooltip: {
                    ...look.plugins?.tooltip,
                    enabled: false,
                    external: ({ tooltip }) => {
                        const index = tooltip.dataPoints?.[0]?.dataIndex;
                        if (tooltip.opacity === 0 || index === undefined) return onTooltip(undefined);
                        const title = formatBucketTitle(band.labels[index], granularity, dayTimeZone);
                        const split = (min: number, max: number) => {
                            const figure = formatCo2eFigure({ min, max });
                            return { text: figure.centralText, range: figure.range || undefined };
                        };
                        onTooltip({
                            heading: incomplete && index >= incomplete.from ? incomplete.title(title, incomplete.nowLabel !== undefined && index === incomplete.from) : title,
                            middle: split(band.lower[index], band.upper[index]),
                            compare:
                                compare && index < compare.lower.length
                                    ? {
                                          ...split(compare.lower[index], compare.upper[index]),
                                          date: formatBucketTitle(compare.labels[index], granularity, dayTimeZone),
                                          current: middle[index],
                                          previous: (compare.lower[index] + compare.upper[index]) / 2,
                                      }
                                    : undefined,
                            x: tooltip.caretX,
                            y: tooltip.caretY,
                        });
                    },
                },
            },
            // Room for the now label above the plot.
            layout: { ...look.layout, padding: incomplete?.nowLabel === undefined ? look.layout?.padding : { top: NOW_LABEL_ROOM } },
            scales: {
                ...look.scales,
                x: {
                    ...look.scales?.x,
                    ticks: {
                        ...lookX?.ticks,
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: MAX_X_TICKS,
                        callback: (value) => formatBucketLabel(band.labels[Number(value)] ?? "", granularity, dayTimeZone),
                    },
                },
                y: {
                    ...look.scales?.y,
                    beginAtZero: true,
                    // An all-zero series would otherwise get an axis of 0 to 1,000 of the unit.
                    suggestedMax: Math.max(...band.upper, 0) === 0 ? unit.size : undefined,
                    title: { display: true, text: yAxisTitle(unit.label), color: colors.text },
                    ticks: { ...lookY?.ticks, callback: (value) => formatCo2eAxisValue(Number(value), unit) },
                },
            },
        },
        // This chart's own plugin, never registered globally: the Chart.js copy is shared with other products.
        plugins: [createIncompletePlugin()],
    };
}
