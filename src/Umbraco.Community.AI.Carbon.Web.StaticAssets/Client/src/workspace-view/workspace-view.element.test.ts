import { afterEach, describe, expect, it, vi } from "vitest";
import type { EstimateResponseModel } from "../api/types.gen.js";
import type { AICarbonEstimateError, AICarbonEstimateResult } from "../estimate/index.js";
import { AICarbonWorkspaceViewElement, type AICarbonEstimateLoader } from "./workspace-view.element.js";

// happy-dom has no ElementInternals, which the uui form mixins need on construction.
if (!("attachInternals" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "attachInternals", {
        value: () => ({ setFormValue() {}, setValidity() {}, labels: [], form: null }),
        configurable: true,
    });
}

const zero = { min: 0, max: 0 };
const estimate = (requests: number, analyticsEnabled = true): EstimateResponseModel =>
    ({
        total: { co2eGrams: zero, energyWh: zero, requests, outputTokens: 0 },
        notEstimated: { requests: 0, outputTokens: 0, models: 0 },
        method: { analyticsEnabled, electricityZones: [] },
        timeSeries: [],
        granularity: "Hourly",
        byModel: [],
        byFeature: { available: true, items: [] },
    }) as unknown as EstimateResponseModel;

const failure = (status?: number, isAborted = false): AICarbonEstimateResult => ({
    error: { status, isForbidden: status === 403, isAborted, message: "x" } satisfies AICarbonEstimateError,
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render(loader: AICarbonEstimateLoader) {
    const element = new AICarbonWorkspaceViewElement();
    element.loader = loader;
    document.body.appendChild(element);
    await element.updateComplete;
    return element;
}

async function flush(element: AICarbonWorkspaceViewElement) {
    await settle();
    await element.updateComplete;
}

const text = (element: AICarbonWorkspaceViewElement) => element.shadowRoot!.textContent ?? "";
const body = (element: AICarbonWorkspaceViewElement) => element.shadowRoot!.querySelector("#body")!;

function chooseRange(element: AICarbonWorkspaceViewElement, range: string) {
    element.shadowRoot!.querySelector("aicarbon-header")!.dispatchEvent(new CustomEvent("range-change", { detail: range }));
}

describe("Feature: CO2 tab states", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe("Scenario: first load", () => {
        it("shows the loader bar and the loading text", async () => {
            const element = await render(() => new Promise(() => {}));
            expect(element.shadowRoot!.querySelector("uui-loader-bar")).not.toBeNull();
            expect(text(element)).toContain("Loading the estimate…");
        });
    });

    describe("Scenario: the header explains what the estimate covers", () => {
        it("shows the scope subtitle", async () => {
            const element = await render(() => new Promise(() => {}));
            expect(element.shadowRoot!.querySelector(".scope")!.textContent).toContain(
                "Covers the AI provider's servers and data centres for your chat requests.",
            );
        });
    });

    describe("Scenario: usage was estimated", () => {
        it("shows the figures sections", async () => {
            const element = await render(async () => ({ data: estimate(5) }));
            await flush(element);
            expect(element.shadowRoot!.querySelector("#by-model")).not.toBeNull();
        });
    });

    describe("Scenario: changing the range with figures on screen", () => {
        it("keeps the old figures, dimmed and busy, until the new result arrives", async () => {
            let release: (r: AICarbonEstimateResult) => void = () => {};
            let calls = 0;
            const element = await render(() => {
                calls++;
                return calls === 1 ? Promise.resolve({ data: estimate(5) }) : new Promise((r) => (release = r));
            });
            await flush(element);
            chooseRange(element, "last30d");
            await element.updateComplete;
            expect(element.shadowRoot!.querySelector("#by-model")).not.toBeNull();
            expect(body(element).classList.contains("reloading")).toBe(true);
            expect(body(element).getAttribute("aria-busy")).toBe("true");
            expect(element.shadowRoot!.querySelector("uui-loader-bar")).not.toBeNull();
            release({ data: estimate(7) });
            await flush(element);
            expect(body(element).classList.contains("reloading")).toBe(false);
        });
    });

    describe("Sad path: no usage in range", () => {
        it("says there is no usage and suggests a longer range", async () => {
            const element = await render(async () => ({ data: estimate(0) }));
            await flush(element);
            expect(text(element)).toContain("No AI usage in this period yet");
            expect(text(element)).toContain("longer time range");
        });
    });

    describe("Sad path: analytics switched off", () => {
        it("explains that analytics are off and where to turn them on", async () => {
            const element = await render(async () => ({ data: estimate(0, false) }));
            await flush(element);
            expect(text(element)).toContain("Umbraco:AI:Analytics:Enabled");
        });
    });

    describe("Sad path: the request failed", () => {
        it("shows the error message and Retry loads again", async () => {
            const loader = vi.fn<AICarbonEstimateLoader>(async () => failure(500));
            const element = await render(loader);
            await flush(element);
            expect(text(element)).toContain("The estimate couldn't be loaded.");
            element.shadowRoot!.querySelector<HTMLElement>("uui-box.error uui-button")!.dispatchEvent(new Event("click"));
            await flush(element);
            expect(loader).toHaveBeenCalledTimes(2);
        });

        it("shows the error state when the failure has no HTTP status", async () => {
            const element = await render(async () => failure(undefined));
            await flush(element);
            expect(element.shadowRoot!.querySelector("uui-box.error")).not.toBeNull();
        });
    });

    describe("Sad path: no AI section access", () => {
        it("shows the forbidden message without a Retry button", async () => {
            const element = await render(async () => failure(403));
            await flush(element);
            expect(text(element)).toContain("You need access to the AI section to see this.");
            expect(element.shadowRoot!.querySelector("uui-box.error")).toBeNull();
        });
    });

    describe("Sad path: the request was aborted by something else", () => {
        it("ends a first load in the error state with Retry, not on the loader", async () => {
            const element = await render(async () => failure(undefined, true));
            await flush(element);
            expect(element.shadowRoot!.querySelector("uui-box.error uui-button")).not.toBeNull();
        });

        it("drops it silently during a reload with figures shown", async () => {
            let calls = 0;
            const element = await render(async () => (++calls === 1 ? { data: estimate(5) } : failure(undefined, true)));
            await flush(element);
            chooseRange(element, "last30d");
            await flush(element);
            expect(element.shadowRoot!.querySelector("uui-box.error")).toBeNull();
            expect(element.shadowRoot!.querySelector("#by-model")).not.toBeNull();
            expect(body(element).getAttribute("aria-busy")).toBe("false");
        });
    });

    describe("Scenario: remembered range", () => {
        it("starts from the stored range", async () => {
            localStorage.setItem("aicarbon.dateRange", "last30d");
            const element = await render(async () => ({ data: estimate(5) }));
            expect(element.shadowRoot!.querySelector("aicarbon-header")!.getAttribute("range")).toBeNull();
            expect((element.shadowRoot!.querySelector("aicarbon-header") as unknown as { range: string }).range).toBe("last30d");
        });

        it("saves the range when it changes", async () => {
            const element = await render(async () => ({ data: estimate(5) }));
            chooseRange(element, "last24h");
            expect(localStorage.getItem("aicarbon.dateRange")).toBe("last24h");
        });
    });
});
