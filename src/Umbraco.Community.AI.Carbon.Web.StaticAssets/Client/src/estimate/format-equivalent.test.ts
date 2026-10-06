import { describe, expect, it } from "vitest";
import type { EstimateEquivalentModel } from "../api/types.gen.js";
import { formatEquivalent } from "./format-equivalent.js";

function equivalent(kind: EstimateEquivalentModel["kind"], amount: number): EstimateEquivalentModel {
    return { kind, amount, basisCo2eGrams: 77, source: "Test source", sourceYear: 2024 };
}

describe("Feature: formatting the everyday equivalent", () => {
    describe("Scenario: each kind", () => {
        it("words phone charges", () => expect(formatEquivalent(equivalent("PhoneCharges", 6.21))).toBe("Up to about 6.3 phone charges"));
        it("words km by car", () => expect(formatEquivalent(equivalent("CarKm", 120))).toBe("Up to about 120 km by car"));
        it("words km flown", () => expect(formatEquivalent(equivalent("FlightKm", 450))).toBe("Up to about 450 km flown (short-haul, per passenger)"));
    });

    describe("Scenario: rounding never understates", () => {
        it.each([
            [6.21, "6.3"],
            [1.4, "1.4"],
            [1.04, "1.1"],
            [12.4, "13"],
            [0.36, "0.36"],
            [0.361, "0.37"],
            [12_345, "13,000"],
            [1.2, "1.2"],
            [0.3, "0.3"],
        ])("shows %s km by car as %s", (amount, shown) =>
            expect(formatEquivalent(equivalent("CarKm", amount))).toBe(`Up to about ${shown} km by car`));
    });

    describe("Scenario: phone charges around one", () => {
        it("uses the singular when the shown amount is exactly 1", () =>
            expect(formatEquivalent(equivalent("PhoneCharges", 1))).toBe("Up to about 1 phone charge"));
        it("uses the plural when the shown amount is 1.1", () =>
            expect(formatEquivalent(equivalent("PhoneCharges", 1.04))).toBe("Up to about 1.1 phone charges"));
        it("says less than one below 1", () =>
            expect(formatEquivalent(equivalent("PhoneCharges", 0.6))).toBe("Less than one phone charge"));
    });

    describe("Scenario: nothing to show", () => {
        it("returns null for null", () => expect(formatEquivalent(null)).toBeNull());
        it("returns null for undefined", () => expect(formatEquivalent(undefined)).toBeNull());
        it.each([0, -1, NaN])("returns null for an amount of %d", (amount) =>
            expect(formatEquivalent(equivalent("CarKm", amount))).toBeNull());
        it("returns null for an unknown kind", () =>
            expect(formatEquivalent({ ...equivalent("CarKm", 5), kind: "Boat" as never })).toBeNull());
    });

    describe("Scenario: localized wording", () => {
        it("uses the translation for the kind, filling in the amount", () =>
            expect(formatEquivalent(equivalent("CarKm", 120), (key) => (key === "aiCarbon_equivalent_carKm" ? "Op til {amount} km i bil" : key)))
                .toBe("Op til 120 km i bil"));
    });
});
