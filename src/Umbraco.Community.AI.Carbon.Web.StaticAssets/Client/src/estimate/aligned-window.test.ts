import { describe, expect, it } from "vitest";
import { alignedWindow } from "./aligned-window.js";

const iso = (date: Date) => date.toISOString();

describe("Feature: request windows aligned to bucket boundaries", () => {
    describe("Scenario: last 24 hours mid-hour", () => {
        const window = alignedWindow("last24h", new Date("2026-10-06T14:37:12Z"));

        it("ends at the start of the next UTC hour", () => expect(iso(window.to)).toBe("2026-10-06T15:00:00.000Z"));
        it("starts 24 hours earlier", () => expect(iso(window.from)).toBe("2026-10-05T15:00:00.000Z"));
        it("is hourly", () => expect(window.granularity).toBe("Hourly"));
    });

    describe("Scenario: last 7 days mid-hour", () => {
        const window = alignedWindow("last7d", new Date("2026-10-06T14:37:12Z"));

        it("ends at the start of the next UTC hour", () => expect(iso(window.to)).toBe("2026-10-06T15:00:00.000Z"));
        it("starts exactly 7 days earlier", () => expect(iso(window.from)).toBe("2026-09-29T15:00:00.000Z"));
        it("is hourly, because an exact 7-day window is hourly", () => expect(window.granularity).toBe("Hourly"));
    });

    describe("Scenario: last 30 days mid-day", () => {
        const window = alignedWindow("last30d", new Date("2026-10-06T14:37:12Z"));

        it("ends at the next UTC midnight", () => expect(iso(window.to)).toBe("2026-10-07T00:00:00.000Z"));
        it("starts 30 days earlier", () => expect(iso(window.from)).toBe("2026-09-07T00:00:00.000Z"));
        it("is daily", () => expect(window.granularity).toBe("Daily"));
    });

    describe("Scenario: now exactly on an hour boundary", () => {
        it("ends at the following hour, not now", () => {
            const window = alignedWindow("last24h", new Date("2026-10-06T14:00:00.000Z"));
            expect(iso(window.to)).toBe("2026-10-06T15:00:00.000Z");
        });
    });

    describe("Scenario: just after UTC midnight", () => {
        it("keeps a daily window ending at the next midnight", () => {
            const window = alignedWindow("last30d", new Date("2026-10-06T00:00:01Z"));
            expect(iso(window.to)).toBe("2026-10-07T00:00:00.000Z");
        });

        it("keeps an hourly window ending at 01:00 the same day", () => {
            const window = alignedWindow("last24h", new Date("2026-10-06T00:00:01Z"));
            expect(iso(window.to)).toBe("2026-10-06T01:00:00.000Z");
        });
    });

    describe("Scenario: repeat requests in the same bucket", () => {
        it("produce an identical window", () => {
            const first = alignedWindow("last7d", new Date("2026-10-06T14:01:00Z"));
            const second = alignedWindow("last7d", new Date("2026-10-06T14:59:00Z"));
            expect([iso(second.from), iso(second.to)]).toEqual([iso(first.from), iso(first.to)]);
        });
    });
});
