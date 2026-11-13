import { describe, expect, it } from "vitest";
import { rangeMidpoint } from "./range-midpoint.js";

describe("Feature: range midpoint", () => {
    it("is the middle of the two ends", () => {
        expect(rangeMidpoint({ min: 2, max: 10 })).toBe(6);
    });

    it("clamps a negative end at zero", () => {
        expect(rangeMidpoint({ min: -4, max: 10 })).toBe(5);
    });

    it("is undefined when an end is not a number", () => {
        expect(rangeMidpoint({ min: Number.NaN, max: 1 })).toBeUndefined();
    });
});
