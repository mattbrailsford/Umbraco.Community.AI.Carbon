import type { ChartConfiguration } from "chart.js";
import { color } from "chart.js/helpers";
import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { co2eAxisUnit, formatCo2eAxisValue, formatCo2eFigure } from "../estimate/format-co2.js";
import { toTrendBand } from "../estimate/trend-dataset.js";
import { formatBucketLabel, formatBucketTitle } from "./trend-format.js";

/** Resolved colours (canvas can't read CSS variables, so the element resolves them from the UUI theme). */
export type TrendChartConfiguration = ChartConfiguration<"bar" | "line", (number | [number, number])[], string>;

export interface TrendChartColors {
    /** The middle-estimate line. */
    line: string;
    /** The range bars (already translucent, so gridlines show through). */
    fill: string;
    /** Axis tick text. */
    text: string;
    /** Stronger text: legend, axis title and tooltip text. */
    strongText: string;
    /** The card surface, used as the tooltip background. */
    surface: string;
    /** Grid lines. */
    grid: string;
}

const MAX_X_TICKS = 12;

/** Legend text for the two datasets (the element passes localized text). */
export interface TrendLegendLabels {
    range: string;
    middle: string;
}

const DEFAULT_LEGEND_LABELS: TrendLegendLabels = { range: "Likely range", middle: "Middle estimate" };

/**
 * A translucent colour that looks the same as `colorValue` once drawn over `background`, so gridlines show
 * through the bars without changing their look. Per channel: bg - (bg - c) / alpha, clamped to 0-255
 * (a very pale colour over a dark background can't be matched exactly, so it comes out as close as possible).
 * If either colour can't be parsed, `colorValue` is returned unchanged.
 */
export function translucentEquivalent(colorValue: string, background: string, alpha = 0.35): string {
    const target = color(colorValue);
    const backdrop = color(background);
    if (!target.valid || !backdrop.valid) return colorValue;
    const channel = (c: number, bg: number) => Math.min(255, Math.max(0, Math.round(bg - (bg - c) / alpha)));
    const { r, g, b } = target.rgb;
    const { r: bgR, g: bgG, b: bgB } = backdrop.rgb;
    return `rgba(${channel(r, bgR)}, ${channel(g, bgG)}, ${channel(b, bgB)}, ${alpha})`;
}

/** Umbraco's light pink; the range bars' base colour in every theme. */
const LIGHT_PINK = "#ffe8e6";
/** On a dark surface the pale pink can't be reproduced by a translucent fill, so use a lighter pink at low alpha. */
const DARK_SURFACE_FILL = "rgba(255, 140, 150, 0.3)";

/** True when the colour's relative luminance is below 0.5 (an unparseable colour is treated as light). */
export function isDarkColor(colorValue: string): boolean {
    const parsed = color(colorValue);
    if (!parsed.valid) return false;
    const linear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const { r, g, b } = parsed.rgb;
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) < 0.5;
}

/** The subtle pink for the range bars: the pale pink on a light surface, a lighter low-alpha pink on a dark one. */
export function rangeFillFor(surface: string): string {
    return isDarkColor(surface) ? DARK_SURFACE_FILL : translucentEquivalent(LIGHT_PINK, surface);
}

/** Resolves the chart colours from UUI theme variables via `readVariable` (which returns "" when unset). */
export function resolveTrendColors(readVariable: (name: string) => string): TrendChartColors {
    const read = (name: string, fallback: string) => readVariable(name).trim() || fallback;
    const surface = read("--uui-color-surface", "#ffffff");
    return {
        line: read("--uui-color-default-emphasis", "#2d42ab"),
        fill: rangeFillFor(surface),
        text: read("--uui-color-text-alt", "#68676b"),
        strongText: read("--uui-color-text", "#060606"),
        surface,
        grid: read("--uui-color-border", "#d8d7d9"),
    };
}

/**
 * The Chart.js configuration for the trend: a floating bar per bucket spanning its likely range
 * (min to max) behind a line through the middle estimate (the midpoint, as on the summary cards).
 */
export function buildTrendChartConfig(
    points: readonly EstimateTimeSeriesPointModel[],
    granularity: AiUsagePeriod,
    colors: TrendChartColors,
    yAxisTitle: (unitLabel: string) => string = (unit) => `${unit} CO2e`,
    legendLabels: TrendLegendLabels = DEFAULT_LEGEND_LABELS,
): TrendChartConfiguration {
    const band = toTrendBand(points);
    const unit = co2eAxisUnit(Math.max(0, ...band.upper));
    const middle = band.lower.map((min, index) => (min + band.upper[index]) / 2);
    // One point has no line to draw, so show it as a dot.
    const pointRadius = points.length === 1 ? 3 : 0;

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
                    backgroundColor: colors.fill,
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
                    borderColor: colors.line,
                    backgroundColor: colors.line,
                    borderWidth: 2,
                    pointRadius,
                    pointHoverRadius: 4,
                    pointBackgroundColor: colors.line,
                    cubicInterpolationMode: "monotone",
                    // A lower order draws later, so the line sits on top of the bars.
                    order: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                // The legend is only a key: hiding "Likely range" would leave the tooltip (which reads from it) empty.
                legend: { display: true, position: "bottom", onClick: () => {}, labels: { color: colors.strongText, boxWidth: 12, boxHeight: 12 } },
                tooltip: {
                    backgroundColor: colors.surface,
                    titleColor: colors.strongText,
                    bodyColor: colors.strongText,
                    borderColor: colors.grid,
                    borderWidth: 1,
                    // Both datasets describe one bucket, so show one line (from the bar dataset).
                    // The unit is picked per bucket here (as on the summary cards, so a tiny bucket reads "4 mg"),
                    // while the axis uses one unit for the whole series. The difference is on purpose.
                    filter: (item) => item.datasetIndex === 0,
                    callbacks: {
                        title: (items) => (items[0] ? formatBucketTitle(band.labels[items[0].dataIndex], granularity) : ""),
                        label: (item) => {
                            const figure = formatCo2eFigure({ min: band.lower[item.dataIndex], max: band.upper[item.dataIndex] });
                            return figure.range ? `${figure.centralText} (${figure.range})` : figure.centralText;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { color: colors.grid },
                    ticks: {
                        color: colors.text,
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: MAX_X_TICKS,
                        callback: (value) => formatBucketLabel(band.labels[Number(value)] ?? "", granularity),
                    },
                },
                y: {
                    beginAtZero: true,
                    // An all-zero series would otherwise get an axis of 0 to 1,000 of the unit.
                    suggestedMax: Math.max(...band.upper, 0) === 0 ? unit.size : undefined,
                    grid: { color: colors.grid },
                    title: { display: true, text: yAxisTitle(unit.label), color: colors.strongText },
                    ticks: { color: colors.text, callback: (value) => formatCo2eAxisValue(Number(value), unit) },
                },
            },
        },
    };
}
