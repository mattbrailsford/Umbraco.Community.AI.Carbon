import { beforeEach, describe, expect, it, vi } from "vitest";
import { UmbControllerHostElementMixin } from "@umbraco-cms/backoffice/controller-api";
import type { EstimateResponseModel } from "../api/types.gen.js";

const getEstimate = vi.hoisted(() => vi.fn());
vi.mock("../api/sdk.gen.js", () => ({ EstimateService: { getEstimate } }));

import { AICarbonEstimateRepository } from "./estimate.repository.js";
import { resetTimeZoneFallback } from "./estimate.server.data-source.js";

class TestHost extends UmbControllerHostElementMixin(HTMLElement) {}
customElements.define("aicarbon-test-host", TestHost);

const request = {
    from: new Date("2026-10-05T15:00:00Z"),
    to: new Date("2026-10-06T15:00:00Z"),
    granularity: "Hourly" as const,
    timeZone: "Europe/Copenhagen",
};

describe("Feature: requesting an estimate", () => {
    let repository: AICarbonEstimateRepository;

    beforeEach(() => {
        getEstimate.mockReset();
        resetTimeZoneFallback();
        vi.restoreAllMocks();
        repository = new AICarbonEstimateRepository(new TestHost());
    });

    describe("Scenario: the server answers 200", () => {
        const payload = { granularity: "Hourly" } as EstimateResponseModel;

        beforeEach(() => {
            getEstimate.mockResolvedValue({ data: payload });
        });

        it("returns the data", async () => expect((await repository.requestEstimate(request)).data).toBe(payload));
        it("returns no error", async () => expect((await repository.requestEstimate(request)).error).toBeUndefined());

        it("sends the window as ISO timestamps with the granularity and the time zone", async () => {
            await repository.requestEstimate(request);
            expect(getEstimate).toHaveBeenCalledWith({
                signal: undefined,
                query: {
                    from: "2026-10-05T15:00:00.000Z",
                    to: "2026-10-06T15:00:00.000Z",
                    granularity: "Hourly",
                    timeZone: "Europe/Copenhagen",
                },
            });
        });
    });

    describe("Scenario: the server answers 403", () => {
        beforeEach(() => {
            getEstimate.mockResolvedValue({ error: { status: 403, title: "Forbidden" } });
        });

        it("flags the error as forbidden", async () => {
            expect((await repository.requestEstimate(request)).error?.isForbidden).toBe(true);
        });

        it("returns no data", async () => expect((await repository.requestEstimate(request)).data).toBeUndefined());
    });

    describe("Scenario: the server answers 400", () => {
        beforeEach(() => {
            getEstimate.mockResolvedValue({ error: { status: 400, title: "Bad Request" } });
        });

        it("keeps the status and does not flag it as forbidden", async () => {
            const { error } = await repository.requestEstimate(request);
            expect([error?.status, error?.isForbidden]).toEqual([400, false]);
        });
    });

    describe("Scenario: the server cannot resolve the time zone", () => {
        const payload = { granularity: "Daily" } as EstimateResponseModel;
        const timeZoneProblem = { status: 400, title: "Validation", errors: { timeZone: ["Unknown time zone."] } };
        const queryOf = (call: number) => getEstimate.mock.calls[call][0].query;
        let warn: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            getEstimate.mockResolvedValueOnce({ error: timeZoneProblem }).mockResolvedValue({ data: payload });
        });

        it("retries once without the zone and returns the data", async () => {
            const result = await repository.requestEstimate(request);
            expect([result.data, getEstimate.mock.calls.length, queryOf(1).timeZone]).toEqual([payload, 2, undefined]);
        });

        it("keeps everything else in the retried request", async () => {
            await repository.requestEstimate(request);
            expect(queryOf(1)).toEqual({ from: "2026-10-05T15:00:00.000Z", to: "2026-10-06T15:00:00.000Z", granularity: "Hourly", timeZone: undefined });
        });

        it("reports UTC as the zone the figures are in", async () => {
            expect((await repository.requestEstimate(request)).timeZone).toBe("UTC");
        });

        it("warns once, naming the zone", async () => {
            await repository.requestEstimate(request);
            expect(warn.mock.calls.map((c: unknown[]) => String(c[0]).includes("Europe/Copenhagen"))).toEqual([true]);
        });

        it("leaves the zone out of later requests without a failed attempt first", async () => {
            await repository.requestEstimate(request);
            await repository.requestEstimate(request);
            expect([getEstimate.mock.calls.length, queryOf(2).timeZone]).toEqual([3, undefined]);
        });

        it("sends the compare period's request the same way", async () => {
            await repository.requestEstimate(request);
            const compare = { ...request, from: new Date("2026-10-03T15:00:00Z"), to: new Date("2026-10-04T15:00:00Z") };
            const result = await repository.requestEstimate(compare);
            expect([queryOf(2).timeZone, queryOf(2).from, result.timeZone]).toEqual([undefined, "2026-10-03T15:00:00.000Z", "UTC"]);
        });

        it("reports the zone it sent when the server accepts it", async () => {
            resetTimeZoneFallback();
            getEstimate.mockReset();
            getEstimate.mockResolvedValue({ data: payload });
            expect((await repository.requestEstimate(request)).timeZone).toBe("Europe/Copenhagen");
        });
    });

    describe("Scenario: the server answers 400 for another field", () => {
        beforeEach(() => {
            getEstimate.mockResolvedValue({ error: { status: 400, title: "Validation", errors: { from: ["Bad."] } } });
        });

        it("does not retry", async () => {
            const result = await repository.requestEstimate(request);
            expect([getEstimate.mock.calls.length, result.error?.status]).toEqual([1, 400]);
        });

        it("keeps sending the zone afterwards", async () => {
            await repository.requestEstimate(request);
            await repository.requestEstimate(request);
            expect(getEstimate.mock.calls[1][0].query.timeZone).toBe("Europe/Copenhagen");
        });
    });

    describe("Scenario: the time zone is still rejected on the retry", () => {
        it("returns the error after one retry", async () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            getEstimate.mockResolvedValue({ error: { status: 400, errors: { timeZone: ["x"] } } });
            const result = await repository.requestEstimate(request);
            expect([getEstimate.mock.calls.length, result.error?.status]).toEqual([2, 400]);
        });
    });

    describe("Scenario: the request never reaches the server", () => {
        beforeEach(() => {
            getEstimate.mockRejectedValue(new TypeError("Failed to fetch"));
        });

        it("returns an error without a status", async () => {
            const { error } = await repository.requestEstimate(request);
            expect([error?.status, error?.isForbidden]).toEqual([undefined, false]);
        });
    });

    describe("Scenario: the service resolves with a network error instead of rejecting", () => {
        beforeEach(() => {
            getEstimate.mockResolvedValue({ error: new TypeError("Failed to fetch") });
        });

        it("returns an error without data", async () => {
            const result = await repository.requestEstimate(request);
            expect([result.data, result.error?.isForbidden]).toEqual([undefined, false]);
        });
    });

    describe("Scenario: the caller aborts", () => {
        it("passes the abort signal to the generated service", async () => {
            getEstimate.mockResolvedValue({ data: {} as EstimateResponseModel });
            const controller = new AbortController();
            await repository.requestEstimate(request, controller.signal);
            expect(getEstimate).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
        });

        it("flags an AbortError as aborted", async () => {
            const controller = new AbortController();
            controller.abort();
            getEstimate.mockResolvedValue({ error: new DOMException("aborted", "AbortError") });
            expect((await repository.requestEstimate(request, controller.signal)).error?.isAborted).toBe(true);
        });

        it("does not flag an ordinary failure as aborted", async () => {
            getEstimate.mockResolvedValue({ error: { status: 400, title: "Bad Request" } });
            expect((await repository.requestEstimate(request)).error?.isAborted).toBe(false);
        });
    });
});
