// S8 (AC5–AC7), S9 (AC4) — Which state the CO2 tab shows. Task: T19.
import { describe, expect, it } from "vitest";
import { selectViewState } from "./view-state.js";

const zero = { min: 0, max: 0 };
const estimate = (requests: number, analyticsEnabled = true, notEstimatedRequests = 0) => ({
    total: { co2eGrams: zero, energyWh: zero, requests, outputTokens: 0 },
    notEstimated: { requests: notEstimatedRequests, outputTokens: 0, models: 0 },
    method: { analyticsEnabled },
});

describe("Feature: CO2 tab state", () => {
    describe("Scenario: usage was estimated", () => {
        it("shows the figures", () => {
            expect(selectViewState({ estimate: estimate(5) })).toBe("content");
        });
    });

    describe("Scenario: only not-estimated usage", () => {
        it("still shows the figures so the not-estimated rows are visible", () => {
            expect(selectViewState({ estimate: estimate(0, true, 3) })).toBe("content");
        });
    });

    describe("Scenario: still loading the first time", () => {
        it("shows the loader", () => {
            expect(selectViewState({ loading: true })).toBe("loading");
        });
    });

    describe("Sad path: no usage in range", () => {
        it("shows the empty state", () => {
            expect(selectViewState({ estimate: estimate(0) })).toBe("empty");
        });
    });

    describe("Sad path: analytics switched off", () => {
        it("shows the analytics-disabled state", () => {
            expect(selectViewState({ estimate: estimate(0, false) })).toBe("analyticsDisabled");
        });
    });

    describe("Sad path: the request failed", () => {
        it("shows the error state", () => {
            expect(selectViewState({ errorStatus: 500 })).toBe("error");
        });
    });

    describe("Sad path: the user lacks AI section access", () => {
        it("shows the forbidden state", () => {
            expect(selectViewState({ errorStatus: 403 })).toBe("forbidden");
        });
    });
});
