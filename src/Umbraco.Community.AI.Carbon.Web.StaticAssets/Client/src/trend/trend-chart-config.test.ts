import { describe, expect, it } from "vitest";
import { bandFillColor, buildTrendChartConfig } from "./trend-chart-config.js";

const colors = { line: "#283a97", fill: "rgba(0,0,0,0.25)", text: "#000", grid: "#ccc" };
const yScale = (max: number) =>
    buildTrendChartConfig([{ timestamp: "2026-10-01T00:00:00Z", co2eGrams: { min: 0, max } }], "Daily", colors).options!
        .scales!.y as { suggestedMax?: number };

describe("Feature: trend chart y-axis", () => {
    it("suggests one unit (1 mg) when every value is zero, so the axis is not 0-1,000 mg", () => {
        expect(yScale(0).suggestedMax).toBe(0.001);
    });

    it("leaves the axis maximum to Chart.js when there is data", () => {
        expect(yScale(3).suggestedMax).toBeUndefined();
    });
});

describe("Feature: band fill colour", () => {
    it("is the line colour made translucent", () => {
        expect(bandFillColor("#283a97")).toBe("rgba(40, 58, 151, 0.25)");
    });

    it("falls back to the line colour when it can't be parsed", () => {
        expect(bandFillColor("not-a-colour")).toBe("not-a-colour");
    });
});
