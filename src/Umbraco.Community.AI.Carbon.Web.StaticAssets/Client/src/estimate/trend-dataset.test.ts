// S4 (AC1) — Trend chart band data. Task: T16.
import { describe, expect, it } from "vitest";
import { toTrendBand } from "./trend-dataset.js";

const points = [
    { timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 1, max: 3 } },
    { timestamp: "2026-10-02T00:00:00Z", co2eGrams: { min: 0, max: 0 } },
];

describe("Feature: trend chart band", () => {
    describe("Scenario: two buckets", () => {
        it("has one label per bucket", () => {
            expect(toTrendBand(points).labels).toHaveLength(2);
        });

        it("puts the min values in the lower line", () => {
            expect(toTrendBand(points).lower).toEqual([1, 0]);
        });

        it("puts the max values in the upper line", () => {
            expect(toTrendBand(points).upper).toEqual([3, 0]);
        });
    });

    describe("Scenario: no buckets", () => {
        it("gives empty lines", () => {
            expect(toTrendBand([])).toEqual({ labels: [], lower: [], upper: [] });
        });
    });

    describe("Scenario: buckets out of time order", () => {
        it("keeps the order it was given", () => {
            const reversed = [...points].reverse();
            expect(toTrendBand(reversed).labels).toEqual([points[1].timestamp, points[0].timestamp]);
        });
    });
});
