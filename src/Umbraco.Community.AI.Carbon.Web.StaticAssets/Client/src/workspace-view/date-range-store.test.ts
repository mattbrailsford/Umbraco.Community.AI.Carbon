// S8 (AC3, AC4) — Remembered date range. Task: T19.
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDateRange, saveDateRange } from "./date-range-store.js";

describe("Feature: remembered date range", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    describe("Scenario: a range was saved earlier", () => {
        it("loads the saved range", () => {
            saveDateRange("last30d");
            expect(loadDateRange()).toBe("last30d");
        });
    });

    describe("Scenario: nothing saved yet", () => {
        it("defaults to the last 7 days", () => {
            expect(loadDateRange()).toBe("last7d");
        });
    });

    describe("Scenario: browser storage throws", () => {
        it("still defaults to the last 7 days", () => {
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            expect(loadDateRange()).toBe("last7d");
        });
    });

    describe("Scenario: a stored value that isn't a known range", () => {
        it("defaults to the last 7 days", () => {
            localStorage.setItem("aicarbon.dateRange", "last-century");
            expect(loadDateRange()).toBe("last7d");
        });
    });
});
