import type { ChartConfiguration, ChartOptions, UauiChartColors } from "@umbraco/analytics-ui/external/chart.js";
import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { co2eAxisUnit, formatCo2eAxisValue, formatCo2eFigure } from "../estimate/format-co2.js";
import { toTrendBand } from "../estimate/trend-dataset.js";
import { formatBucketLabel, formatBucketTitle } from "./trend-format.js";

export type TrendChartConfiguration = ChartConfiguration<"bar" | "line", (number | [number, number] | null)[], string>;

const MAX_X_TICKS = 12;

/** Legend text for the datasets (the element passes localized text). */
export interface TrendLegendLabels {
    range: string;
    middle: string;
    /** The compared period's line. A neutral word, as Analytics.UI's own chart uses: it can be the previous period, the previous year or a custom range. */
    comparison?: string;
}

const DEFAULT_LEGEND_LABELS: TrendLegendLabels = { range: "Likely range", middle: "Middle estimate", comparison: "Comparison" };

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

/** Strong enough to read as a band behind the line, light enough that the gridlines show through. */
const RANGE_ALPHA = 0.45;

/**
 * The Chart.js configuration for the trend: a floating bar per bucket spanning its likely range
 * (min to max) behind a line through the middle estimate (the midpoint, as on the summary cards).
 * Looks come from the Analytics.UI palette (`colors`) and base options (`look`, from `uauiChartOptions`); the range is the
 * first series' bar colour at partial alpha, with no outline (an outline on ~160 narrow bars blurs into the line), so
 * the band reads as a fill and stays distinct from the line in every theme (in dark the bar and line colours are the same).
 */
export function buildTrendChartConfig(
    points: readonly EstimateTimeSeriesPointModel[],
    granularity: AiUsagePeriod,
    colors: UauiChartColors,
    look: ChartOptions<"bar">,
    yAxisTitle: (unitLabel: string) => string = (unit) => `${unit} CO2e`,
    legendLabels: TrendLegendLabels = DEFAULT_LEGEND_LABELS,
    comparePoints?: readonly EstimateTimeSeriesPointModel[],
): TrendChartConfiguration {
    const band = toTrendBand(points);
    // The compared period lines up by position (point i under point i); where it is shorter, the line stops, and where it is longer, the extra points are dropped.
    const compare = comparePoints && comparePoints.length > 0 ? toTrendBand(comparePoints.slice(0, points.length)) : undefined;
    const unit = co2eAxisUnit(Math.max(0, ...band.upper, ...(compare?.upper ?? [])));
    const middle = band.lower.map((min, index) => (min + band.upper[index]) / 2);
    const compareMiddle = compare ? band.labels.map((_, i): number | null => (i < compare.lower.length ? (compare.lower[i] + compare.upper[i]) / 2 : null)) : undefined;
    const compareIndex = 2;
    const figureText = (min: number, max: number) => {
        const figure = formatCo2eFigure({ min, max });
        return figure.range ? `${figure.centralText} (${figure.range})` : figure.centralText;
    };
    // One point has no line to draw, so show it as a dot.
    const pointRadius = points.length === 1 ? 3 : 0;
    const series = colors.series[0];
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
                    // No border: the translucent fill carries the band, and also fills the legend swatch.
                    backgroundColor: withAlpha(series.bar, RANGE_ALPHA, series.fill),
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
                // The legend is only a key: hiding "Likely range" would leave the tooltip (which reads from it) empty.
                // Set explicitly: the look turns it off, and another product may have registered the plugin.
                legend: {
                    ...look.plugins?.legend,
                    display: true,
                    position: "bottom",
                    onClick: () => {},
                    labels: { ...look.plugins?.legend?.labels, boxWidth: 12, boxHeight: 12 },
                },
                tooltip: {
                    ...look.plugins?.tooltip,
                    enabled: true,
                    backgroundColor: colors.surface,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.grid,
                    borderWidth: 1,
                    // The bar and the middle line describe one bucket, so show one line (from the bar dataset);
                    // the compared period adds a second line of its own, when it has a point here.
                    // The unit is picked per bucket here (as on the summary cards, so a tiny bucket reads "4 mg"),
                    // while the axis uses one unit for the whole series. The difference is on purpose.
                    // The current period first, then the compared one (the compare line draws first, so it would lead otherwise).
                    itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
                    filter: (item) =>
                        item.datasetIndex === 0 || (item.datasetIndex === compareIndex && compare !== undefined && item.dataIndex < compare.lower.length),
                    callbacks: {
                        title: (items) => (items[0] ? formatBucketTitle(band.labels[items[0].dataIndex], granularity) : ""),
                        label: (item) => {
                            if (item.datasetIndex === compareIndex && compare) {
                                // The compared period's own date, so the two lines can be told apart.
                                const date = formatBucketTitle(compare.labels[item.dataIndex], granularity);
                                const name = legendLabels.comparison ?? DEFAULT_LEGEND_LABELS.comparison!;
                                return `${name} (${date}): ${figureText(compare.lower[item.dataIndex], compare.upper[item.dataIndex])}`;
                            }
                            return figureText(band.lower[item.dataIndex], band.upper[item.dataIndex]);
                        },
                    },
                },
            },
            scales: {
                ...look.scales,
                x: {
                    ...look.scales?.x,
                    ticks: {
                        ...lookX?.ticks,
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: MAX_X_TICKS,
                        callback: (value) => formatBucketLabel(band.labels[Number(value)] ?? "", granularity),
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
    };
}
