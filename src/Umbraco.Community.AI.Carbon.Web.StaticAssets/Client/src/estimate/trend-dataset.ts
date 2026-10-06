import type { EstimateTimeSeriesPointModel } from "../api/types.gen.js";

export interface TrendBand {
    /** One entry per bucket: the bucket's UTC timestamp, as the API sent it. Formatting is the chart's job. */
    labels: string[];
    /** Min of each bucket (the bottom edge of the band). */
    lower: number[];
    /** Max of each bucket (the top edge of the band). */
    upper: number[];
}

/** Splits time-series points into the labels and the two edges of the min-max band, in the given order. */
export function toTrendBand(points: readonly EstimateTimeSeriesPointModel[]): TrendBand {
    return {
        labels: points.map((point) => point.timestamp),
        lower: points.map((point) => point.co2eGrams.min),
        upper: points.map((point) => point.co2eGrams.max),
    };
}
