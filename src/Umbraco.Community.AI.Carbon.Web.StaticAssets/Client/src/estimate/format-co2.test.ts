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
