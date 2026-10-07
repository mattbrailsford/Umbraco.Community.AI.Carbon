import { beforeEach, describe, expect, it, vi } from "vitest";
import { UmbControllerHostElementMixin } from "@umbraco-cms/backoffice/controller-api";
import type { EstimateResponseModel } from "../api/types.gen.js";

const getEstimate = vi.hoisted(() => vi.fn());
vi.mock("../api/sdk.gen.js", () => ({ EstimateService: { getEstimate } }));

import { AICarbonEstimateRepository } from "./estimate.repository.js";

class TestHost extends UmbControllerHostElementMixin(HTMLElement) {}
customElements.define("aicarbon-test-host", TestHost);

const request = {
    from: new Date("2026-10-05T15:00:00Z"),
    to: new Date("2026-10-06T15:00:00Z"),
    granularity: "Hourly" as const,
};

describe("Feature: requesting an estimate", () => {
    let repository: AICarbonEstimateRepository;

    beforeEach(() => {
        getEstimate.mockReset();
        repository = new AICarbonEstimateRepository(new TestHost());
    });

    describe("Scenario: the server answers 200", () => {
        const payload = { granularity: "Hourly" } as EstimateResponseModel;

        beforeEach(() => {
            getEstimate.mockResolvedValue({ data: payload });
        });

        it("returns the data", async () => expect((await repository.requestEstimate(request)).data).toBe(payload));
        it("returns no error", async () => expect((await repository.requestEstimate(request)).error).toBeUndefined());

        it("sends the window as ISO timestamps with the granularity", async () => {
            await repository.requestEstimate(request);
            expect(getEstimate).toHaveBeenCalledWith({
                signal: undefined,
                query: { from: "2026-10-05T15:00:00.000Z", to: "2026-10-06T15:00:00.000Z", granularity: "Hourly" },
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
