import { BehaviorSubject } from "@umbraco-cms/backoffice/external/rxjs";
import { describe, expect, it } from "vitest";
import { hasAnalyticsDateRange, toAnalyticsDateRange } from "./analytics-date-range.guard.js";
import { defaultAnalyticsDateRange } from "./default-date-range.js";

type Context = Parameters<typeof hasAnalyticsDateRange>[0];
const asContext = (value: unknown) => value as Context;

describe("Feature: reading Umbraco.AI's analytics workspace context", () => {
    describe("Scenario: the context has a dateRange observable", () => {
        it("is accepted", () => {
            const context = { dateRange: new BehaviorSubject({ range: { from: "2026-11-07", to: "2026-11-13" } }).asObservable() };
            expect(hasAnalyticsDateRange(asContext(context))).toBe(true);
        });
    });

    describe("Scenario: the context is not Umbraco.AI's", () => {
        it.each([
            ["missing", undefined],
            ["a context without dateRange", {}],
            ["a dateRange that is a plain value", { dateRange: { range: { from: "a", to: "b" } } }],
            ["a dateRange that is null", { dateRange: null }],
        ])("is rejected: %s", (_name, context) => {
            expect(hasAnalyticsDateRange(asContext(context))).toBe(false);
        });
    });

    describe("Scenario: a value the observable emits", () => {
        it("keeps the range, its preset and the comparison", () => {
            expect(
                toAnalyticsDateRange({
                    range: { from: "2026-11-07", to: "2026-11-13", preset: "last-7-days" },
                    compare: { mode: "previous-period", from: "2026-10-31", to: "2026-11-06" },
                }),
            ).toEqual({
                range: { from: "2026-11-07", to: "2026-11-13", preset: "last-7-days" },
                compare: { mode: "previous-period", from: "2026-10-31", to: "2026-11-06" },
            });
        });

        it("has no comparison when there is none", () => {
            expect(toAnalyticsDateRange({ range: { from: "2026-11-07", to: "2026-11-13" } })?.compare).toBeUndefined();
        });

        it.each([
            ["nothing", undefined],
            ["no range", {}],
            ["a range of Date objects", { range: { from: new Date(), to: new Date() } }],
            ["a range that is not ISO dates", { range: { from: "7 Nov", to: "13 Nov" } }],
        ])("is rejected: %s", (_name, value) => {
            expect(toAnalyticsDateRange(value)).toBeUndefined();
        });
    });
});

describe("Feature: the range used without Umbraco.AI's header", () => {
    it("is the last 7 days through today in the viewer's zone", () => {
        expect(defaultAnalyticsDateRange(new Date("2026-11-13T14:37:00Z"), "Europe/Copenhagen").range).toEqual({
            from: "2026-11-07",
            to: "2026-11-13",
            preset: "last-7-days",
        });
    });

    it("uses the local date, which is already tomorrow late in the evening UTC east of UTC", () => {
        expect(defaultAnalyticsDateRange(new Date("2026-11-13T23:30:00Z"), "Europe/Copenhagen").range.to).toBe("2026-11-14");
    });
});
