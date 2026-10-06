// S1 (AC2, AC3) — Readable CO2e and energy ranges. Task: T14.
import { describe, expect, it } from "vitest";
import { formatCo2eRange, formatEnergyRange } from "./format-co2.js";

describe("Feature: readable CO2e and energy ranges", () => {
    describe("Scenario: a range in grams", () => {
        it("shows both ends with the g CO2e unit", () => {
            expect(formatCo2eRange({ min: 1.2, max: 8.4 })).toBe("1.2–8.4 g CO2e");
        });
    });

    describe("Scenario: a range below one gram", () => {
        it("switches to milligrams", () => {
            expect(formatCo2eRange({ min: 0.012, max: 0.084 })).toBe("12–84 mg CO2e");
        });
    });

    describe("Scenario: a range above one thousand grams", () => {
        it("switches to kilograms", () => {
            expect(formatCo2eRange({ min: 1200, max: 8400 })).toBe("1.2–8.4 kg CO2e");
        });
    });

    describe("Scenario: a range where min equals max", () => {
        it("shows a single value", () => {
            expect(formatCo2eRange({ min: 3, max: 3 })).toBe("3 g CO2e");
        });
    });

    describe("Scenario: energy in watt-hours", () => {
        it("shows the Wh unit", () => {
            expect(formatEnergyRange({ min: 1.4, max: 2.4 })).toBe("1.4–2.4 Wh");
        });
    });

    describe("Scenario: energy above one thousand watt-hours", () => {
        it("switches to kWh", () => {
            expect(formatEnergyRange({ min: 1400, max: 2400 })).toBe("1.4–2.4 kWh");
        });
    });
});
