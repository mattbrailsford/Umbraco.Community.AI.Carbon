import { describe, expect, it } from "vitest";
import { co2eAxisUnit, formatCo2eAxisValue } from "../estimate/format-co2.js";
import { describeTrend, formatBucketLabel, formatBucketTitle } from "./trend-format.js";

describe("Feature: trend chart formatting", () => {
    describe("Scenario: x-axis labels follow the granularity, in UTC", () => {
        it("shows day and month for Daily buckets", () => {
            expect(formatBucketLabel("2026-10-01T00:00:00Z", "Daily")).toBe("1 Oct");
        });

        it("adds the UTC hour for Hourly buckets", () => {
            expect(formatBucketLabel("2026-10-01T14:00:00Z", "Hourly")).toBe("1 Oct 14:00");
        });

        it("shows midnight as 00:00, not 24:00", () => {
            expect(formatBucketLabel("2026-10-01T00:00:00Z", "Hourly")).toBe("1 Oct 00:00");
        });

        it("hands back text it cannot read as a date", () => {
            expect(formatBucketLabel("nope", "Daily")).toBe("nope");
        });
    });

    describe("Scenario: tooltip headings", () => {
        it("shows the full date for Daily buckets", () => {
            expect(formatBucketTitle("2026-10-01T00:00:00Z", "Daily")).toBe("1 Oct 2026");
        });

        it("shows the full date and the hour with UTC for Hourly buckets", () => {
            expect(formatBucketTitle("2026-10-01T14:00:00Z", "Hourly")).toBe("1 Oct 2026, 14:00 UTC");
        });
    });

    describe("Scenario: one y-axis unit for the whole series", () => {
        it("picks the unit from the largest value", () => {
            expect(co2eAxisUnit(2400).label).toBe("kg");
        });

        it("uses milligrams for a tiny series", () => {
            expect(co2eAxisUnit(0.0005).label).toBe("mg");
        });

        it("falls back to the smallest unit for an empty or invalid series", () => {
            expect([co2eAxisUnit(0).label, co2eAxisUnit(Number.NaN).label]).toEqual(["mg", "mg"]);
        });

        it("shows every tick in that unit", () => {
            const unit = co2eAxisUnit(2400);
            expect([0, 500, 1200, 2400].map((grams) => formatCo2eAxisValue(grams, unit))).toEqual(["0", "0.5", "1.2", "2.4"]);
        });

        it("drops floating-point noise from ticks", () => {
            expect(formatCo2eAxisValue(0.30000000000000004, { label: "g", size: 1 })).toBe("0.3");
        });
    });

    describe("Scenario: screen-reader summary", () => {
        const points = [
            { timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 1, max: 3 } },
            { timestamp: "2026-10-02T00:00:00Z", co2eGrams: { min: 2, max: 8.4 } },
        ];

        it("names the period, the bucket size and the highest value", () => {
            expect(describeTrend(points, "Daily")).toBe(
                "Estimated CO2e over time, daily from 1 Oct 2026 to 2 Oct 2026. The highest period is up to 8.4 g CO2e.",
            );
        });

        it("is empty without points", () => {
            expect(describeTrend([], "Daily")).toBe("");
        });
    });
});
