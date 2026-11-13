import { describe, expect, it } from "vitest";
import { browserTimeZone, localDayStart, localIsoDate, windowForDateRange } from "./date-range-window.js";

const CPH = "Europe/Copenhagen";
const iso = (date: Date) => date.toISOString();
const windowOf = (from: string, to: string, zone = CPH) => {
    const window = windowForDateRange({ from, to }, zone);
    return { from: iso(window.from), to: iso(window.to), granularity: window.granularity };
};

describe("Feature: request window for a date range picked in Umbraco.AI's header", () => {
    describe("Scenario: one day", () => {
        it("runs from local midnight to the next local midnight, hourly", () => {
            expect(windowOf("2026-11-10", "2026-11-10")).toEqual({
                from: "2026-11-09T23:00:00.000Z",
                to: "2026-11-10T23:00:00.000Z",
                granularity: "Hourly",
            });
        });
    });

    describe("Scenario: two days", () => {
        it("is still hourly", () => {
            expect(windowOf("2026-11-09", "2026-11-10")).toEqual({
                from: "2026-11-08T23:00:00.000Z",
                to: "2026-11-10T23:00:00.000Z",
                granularity: "Hourly",
            });
        });
    });

    describe("Scenario: the window carries its time zone", () => {
        it("names the zone the day edges are in", () => {
            expect(windowForDateRange({ from: "2026-11-04", to: "2026-11-10" }, "America/New_York").timeZone).toBe("America/New_York");
        });

        it("defaults to the browser's zone", () => {
            expect(windowForDateRange({ from: "2026-11-04", to: "2026-11-10" }).timeZone).toBe(browserTimeZone());
        });
    });

    describe("Scenario: three days", () => {
        it("is daily", () => expect(windowOf("2026-11-08", "2026-11-10").granularity).toBe("Daily"));
    });

    describe("Scenario: 7 days", () => {
        it("is daily, and ends at the midnight after the last day, not at it", () => {
            expect(windowOf("2026-11-04", "2026-11-10")).toEqual({
                from: "2026-11-03T23:00:00.000Z",
                to: "2026-11-10T23:00:00.000Z",
                granularity: "Daily",
            });
        });
    });

    describe("Scenario: a month across the autumn clock change", () => {
        it("starts at summer time and ends at winter time", () => {
            expect(windowOf("2026-10-01", "2026-10-31")).toEqual({
                from: "2026-09-30T22:00:00.000Z",
                to: "2026-10-31T23:00:00.000Z",
                granularity: "Daily",
            });
        });
    });

    describe("Scenario: the week the clocks go back (25 Oct 2026)", () => {
        it("is a day and an hour longer than 7 x 24 hours", () => {
            const window = windowForDateRange({ from: "2026-10-24", to: "2026-10-30" }, CPH);
            expect([iso(window.from), iso(window.to)]).toEqual(["2026-10-23T22:00:00.000Z", "2026-10-30T23:00:00.000Z"]);
            expect((window.to.getTime() - window.from.getTime()) / 3_600_000).toBe(7 * 24 + 1);
        });
    });

    describe("Scenario: the week the clocks go forward (29 Mar 2026)", () => {
        it("is an hour shorter than 7 x 24 hours", () => {
            const window = windowForDateRange({ from: "2026-03-28", to: "2026-04-03" }, CPH);
            expect([iso(window.from), iso(window.to)]).toEqual(["2026-03-27T23:00:00.000Z", "2026-04-03T22:00:00.000Z"]);
        });
    });

    describe("Scenario: the single day the clocks go back", () => {
        it("has 25 hours", () => {
            const window = windowForDateRange({ from: "2026-10-25", to: "2026-10-25" }, CPH);
            expect((window.to.getTime() - window.from.getTime()) / 3_600_000).toBe(25);
        });
    });

    describe("Scenario: a range that includes today", () => {
        it("ends at the coming midnight, so it holds all of today so far", () => {
            // 14:37 UTC on 13 Nov is 15:37 in Copenhagen.
            const today = localIsoDate(new Date("2026-11-13T14:37:00Z"), CPH);
            expect(windowOf("2026-11-07", today)).toEqual({
                from: "2026-11-06T23:00:00.000Z",
                to: "2026-11-13T23:00:00.000Z",
                granularity: "Daily",
            });
        });
    });

    describe("Scenario: a zone behind UTC", () => {
        it("starts at its own midnight, which is later than UTC midnight", () => {
            expect(windowOf("2026-11-10", "2026-11-10", "America/New_York").from).toBe("2026-11-10T05:00:00.000Z");
        });
    });

    describe("Scenario: the last year", () => {
        it("is daily, and within what the server accepts for daily buckets", () => {
            const window = windowForDateRange({ from: "2025-11-14", to: "2026-11-13" }, CPH);
            expect(window.granularity).toBe("Daily");
            expect((window.to.getTime() - window.from.getTime()) / 86_400_000).toBeLessThan(1830);
        });
    });
});

describe("Feature: start of a local day, as Umbraco.AI works it out", () => {
    it("moves a midnight that does not exist to the first time that does (Sao Paulo, 4 Nov 2018)", () => {
        expect(iso(localDayStart("2018-11-04", "America/Sao_Paulo"))).toBe("2018-11-04T03:00:00.000Z");
    });

    it("takes the first of a midnight that happens twice (Havana, 4 Nov 2018)", () => {
        expect(iso(localDayStart("2018-11-04", "America/Havana"))).toBe("2018-11-04T04:00:00.000Z");
    });
});

describe("Feature: local date of an instant", () => {
    it("is the next day for an instant late in the evening UTC, east of UTC", () => {
        expect(localIsoDate(new Date("2026-11-12T23:30:00Z"), CPH)).toBe("2026-11-13");
    });
});
