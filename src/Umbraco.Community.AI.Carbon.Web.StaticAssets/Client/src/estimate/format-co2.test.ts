// S1 (AC2, AC3) — Readable CO2e and energy ranges. Task: T14.
import { describe, expect, it } from "vitest";
import { formatCentral, formatCo2eFigure, formatCo2eRange, formatEnergyRange } from "./format-co2.js";

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

describe("Feature: edge cases of range formatting", () => {
    describe("Scenario: zero", () => {
        it("shows 0 g CO2e", () => {
            expect(formatCo2eRange({ min: 0, max: 0 })).toBe("0 g CO2e");
        });

        it("shows 0 Wh for energy", () => {
            expect(formatEnergyRange({ min: 0, max: 0 })).toBe("0 Wh");
        });
    });

    describe("Scenario: a tiny value", () => {
        it("stays in milligrams with decimals", () => {
            expect(formatCo2eRange({ min: 0.0002, max: 0.0005 })).toBe("0.2–0.5 mg CO2e");
        });

        it("stays in Wh with decimals for energy", () => {
            expect(formatEnergyRange({ min: 0.02, max: 0.05 })).toBe("0.02–0.05 Wh");
        });
    });

    describe("Scenario: ends of very different size", () => {
        it("shares the unit of the larger end", () => {
            expect(formatCo2eRange({ min: 0.5, max: 2400 })).toBe("0.0005–2.4 kg CO2e");
        });
    });

    describe("Scenario: ends that round to the same value", () => {
        it("shows a single value", () => {
            expect(formatCo2eRange({ min: 1.21, max: 1.24 })).toBe("1.2 g CO2e");
        });
    });

    describe("Scenario: three-digit values", () => {
        it("rounds to whole numbers", () => {
            expect(formatCo2eRange({ min: 120.4, max: 840.6 })).toBe("120–841 g CO2e");
        });
    });
});

describe("Feature: rounding that reaches the next unit", () => {
    it("moves 999.96 g up to kilograms", () => {
        expect(formatCo2eRange({ min: 999.96, max: 999.96 })).toBe("1 kg CO2e");
    });

    it("moves 0.9996 g up to grams", () => {
        expect(formatCo2eRange({ min: 0.9996, max: 0.9996 })).toBe("1 g CO2e");
    });

    it("moves 999.96 Wh up to kWh", () => {
        expect(formatEnergyRange({ min: 999.96, max: 999.96 })).toBe("1 kWh");
    });

    it("stays in the unit when rounding does not reach the next one", () => {
        expect(formatCo2eRange({ min: 990, max: 999.4 })).toBe("990–999 g CO2e");
    });
});

describe("Feature: invalid inputs", () => {
    it.each([NaN, Infinity, -Infinity])("shows a dash for %s", (value) => {
        expect(formatCo2eRange({ min: 0, max: value })).toBe("—");
        expect(formatCo2eRange({ min: value, max: 1 })).toBe("—");
        expect(formatEnergyRange({ min: 0, max: value })).toBe("—");
    });

    it("clamps negative values to zero", () => {
        expect(formatCo2eRange({ min: -2, max: 3 })).toBe("0–3 g CO2e");
        expect(formatCo2eRange({ min: -2, max: -1 })).toBe("0 g CO2e");
    });
});

describe("Feature: number style", () => {
    it("uses thousands separators for large values", () => {
        expect(formatCo2eRange({ min: 1_200_000, max: 8_400_000 })).toBe("1,200–8,400 kg CO2e");
    });
});

describe("Feature: central figure", () => {
    describe("Scenario: the midpoint of a range", () => {
        it("rounds the midpoint and marks it approximate", () => {
            expect(formatCentral({ min: 48, max: 72 }, "co2e")).toEqual({ value: "≈ 60", unit: "g CO2e" });
        });
    });

    describe("Scenario: the unit follows the range's max, so headline and range agree", () => {
        it("uses grams below 1 kg although the midpoint is under 1 g", () => {
            expect(formatCentral({ min: 0.5, max: 1.3 }, "co2e")).toEqual({ value: "≈ 0.9", unit: "g CO2e" });
        });

        it("uses kilograms when the max reaches 1 kg", () => {
            expect(formatCentral({ min: 100, max: 1500 }, "co2e")).toEqual({ value: "≈ 0.8", unit: "kg CO2e" });
        });

        it.each([
            { min: 0.5, max: 1.3 },
            { min: 100, max: 1500 },
            { min: 0.0004, max: 2 },
            { min: 0.5, max: 999.96 },
        ])("always shows the same unit as the range for %o", (range) => {
            const figure = formatCo2eFigure(range);
            expect(figure.range.endsWith(figure.central.unit)).toBe(true);
        });

        it("does the same for energy", () => {
            expect(formatCentral({ min: 100, max: 1500 }, "energy")).toEqual({ value: "≈ 0.8", unit: "kWh" });
        });

        it("uses milligrams for a small midpoint", () => {
            expect(formatCentral({ min: 0.012, max: 0.084 }, "co2e")).toEqual({ value: "≈ 48", unit: "mg CO2e" });
        });

        it("uses kilograms from 1,000 g", () => {
            expect(formatCentral({ min: 1200, max: 8400 }, "co2e")).toEqual({ value: "≈ 4.8", unit: "kg CO2e" });
        });

        it("uses kWh for energy from 1,000 Wh", () => {
            expect(formatCentral({ min: 1400, max: 2400 }, "energy")).toEqual({ value: "≈ 1.9", unit: "kWh" });
        });

        it("uses Wh for small energy", () => {
            expect(formatCentral({ min: 10, max: 30 }, "energy")).toEqual({ value: "≈ 20", unit: "Wh" });
        });
    });

    describe("Scenario: no approximation", () => {
        it("drops the sign when the ends are equal", () => {
            expect(formatCentral({ min: 3, max: 3 }, "co2e")).toEqual({ value: "3", unit: "g CO2e" });
        });

        it("shows zero plainly", () => {
            expect(formatCentral({ min: 0, max: 0 }, "co2e")).toEqual({ value: "0", unit: "g CO2e" });
        });
    });

    describe("Scenario: invalid input", () => {
        it.each([NaN, Infinity, -Infinity])("shows a dash with no unit for %s", (value) => {
            expect(formatCentral({ min: 0, max: value }, "co2e")).toEqual({ value: "—", unit: "" });
        });
    });

    describe("Scenario: the range line", () => {
        it("gives the range text next to the central figure", () => {
            expect(formatCo2eFigure({ min: 48, max: 72 }).range).toBe("48–72 g CO2e");
        });

        it("has no range line when the ends read the same", () => {
            expect(formatCo2eFigure({ min: 3, max: 3 }).range).toBe("");
        });
    });
});
