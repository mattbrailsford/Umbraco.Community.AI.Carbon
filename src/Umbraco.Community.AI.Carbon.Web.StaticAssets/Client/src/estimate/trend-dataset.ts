import type { EstimateTimeSeriesPointModel } from "../api/types.gen.js";

export interface TrendBand {
    /** One entry per bucket: the bucket's UTC timestamp, as the API sent it. Formatting is the chart's job. */
    labels: string[];
    /** Min of each bucket (the bottom of the bucket's range). */
    lower: number[];
    /** Max of each bucket (the top of the bucket's range). */
    upper: number[];
}

/** Splits time-series points into the labels and the per-bucket min and max, in the given order. */
export function toTrendBand(points: readonly EstimateTimeSeriesPointModel[]): TrendBand {
    return {
        labels: points.map((point) => point.timestamp),
        lower: points.map((point) => point.co2eGrams.min),
        upper: points.map((point) => point.co2eGrams.max),
    };
}
