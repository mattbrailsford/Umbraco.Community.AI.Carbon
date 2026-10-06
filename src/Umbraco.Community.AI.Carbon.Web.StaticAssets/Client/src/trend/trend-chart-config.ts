import type { ChartConfiguration } from "chart.js";
import { color } from "chart.js/helpers";
import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { co2eAxisUnit, formatCo2eAxisValue, formatCo2eRange } from "../estimate/format-co2.js";
import { toTrendBand } from "../estimate/trend-dataset.js";
import { formatBucketLabel, formatBucketTitle } from "./trend-format.js";

/** Resolved colours (canvas can't read CSS variables, so the element resolves them from the UUI theme). */
export type TrendChartConfiguration = ChartConfiguration<"line", number[], string>;

export interface TrendChartColors {
    /** Band edges. */
    line: string;
    /** Band fill: the line colour, translucent. */
    fill: string;
    /** Axis text. */
    text: string;
    /** Grid lines. */
    grid: string;
}

const MAX_X_TICKS = 12;

/** The band fill: the line colour, translucent. If the colour can't be parsed, the line colour itself is used. */
export function bandFillColor(line: string): string {
    const parsed = color(line);
    // An unparseable colour has no rgb value, and alpha() on it would throw.
    return parsed.valid ? (parsed.alpha(0.25).rgbString() ?? line) : line;
}

/**
 * The Chart.js configuration for the min-max band: a lower line (min) and an upper line (max) with
 * the area between them filled. There is no mid line: the middle of a range is not an estimate of
 * its own, and drawing it would suggest a precision the model does not have.
 */
export function buildTrendChartConfig(
    points: readonly EstimateTimeSeriesPointModel[],
    granularity: AiUsagePeriod,
    colors: TrendChartColors,
    yAxisTitle: (unitLabel: string) => string = (unit) => `${unit} CO2e`,
): TrendChartConfiguration {
    const band = toTrendBand(points);
    const unit = co2eAxisUnit(Math.max(0, ...band.upper));
    // One point has no line to draw, so show it as a dot.
    const pointRadius = points.length === 1 ? 3 : 0;
    const edge = {
        borderColor: colors.line,
        backgroundColor: colors.fill,
        borderWidth: 1.5,
        pointRadius,
        pointHoverRadius: 4,
        pointBackgroundColor: colors.line,
        tension: 0,
    };

    return {
        type: "line",
        data: {
            labels: band.labels,
            datasets: [
                { ...edge, label: "min", data: band.lower, fill: false },
                // Filled down to the dataset before it (the lower line).
                { ...edge, label: "max", data: band.upper, fill: "-1" },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                // A single band needs no legend; the heading names it.
                legend: { display: false },
                tooltip: {
                    // Both edges are one range, so show one line (from the upper dataset).
                    filter: (item) => item.datasetIndex === 1,
                    callbacks: {
                        title: (items) => (items[0] ? formatBucketTitle(band.labels[items[0].dataIndex], granularity) : ""),
                        label: (item) =>
                            formatCo2eRange({ min: band.lower[item.dataIndex], max: band.upper[item.dataIndex] }),
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
                    title: { display: true, text: yAxisTitle(unit.label), color: colors.text },
                    ticks: { color: colors.text, callback: (value) => formatCo2eAxisValue(Number(value), unit) },
                },
            },
        },
    };
}
