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
const part = (element: AICarbonWorkspaceViewElement, tag: string) => element.shadowRoot!.querySelector(tag)!;
const loading = (element: AICarbonWorkspaceViewElement, tag: string) => (part(element, tag) as unknown as { loading: boolean }).loading;

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
        it("lays out the whole page with every part loading, so nothing jumps when the figures arrive", async () => {
            const element = await render(() => new Promise(() => {}));
            expect(
                ["aicarbon-summary-cards", "aicarbon-trend-chart", "aicarbon-model-table", "aicarbon-feature-table"].map(
                    (tag) => loading(element, tag),
                ),
            ).toEqual([true, true, true, true]);
        });

        it("has no figures in the parts yet", async () => {
            const element = await render(() => new Promise(() => {}));
            expect((part(element, "aicarbon-summary-cards") as unknown as { estimate?: unknown }).estimate).toBeUndefined();
        });

        it("marks the body busy and draws none of our own loader", async () => {
            const element = await render(() => new Promise(() => {}));
            expect(body(element).getAttribute("aria-busy")).toBe("true");
            expect(element.shadowRoot!.querySelector("uui-loader-bar, .loading-text")).toBeNull();
            expect(text(element)).not.toContain("Loading the estimate");
        });

        it("shows no error or empty state", async () => {
            const element = await render(() => new Promise(() => {}));
            expect(element.shadowRoot!.querySelector("uaui-error-state, uaui-empty-state")).toBeNull();
        });
    });

    describe("Scenario: the header explains what the estimate covers", () => {
        it("shows the scope subtitle", async () => {
            const element = await render(() => new Promise(() => {}));
            expect(element.shadowRoot!.querySelector(".scope")!.textContent).toContain(
                "AI provider side of chat requests only.",
            );
        });
    });

    describe("Scenario: usage was estimated", () => {
        it("shows the figures sections, none of them loading", async () => {
            const element = await render(async () => ({ data: estimate(5) }));
            await flush(element);
            expect(element.shadowRoot!.querySelector("#by-model")).not.toBeNull();
            expect(
                ["aicarbon-summary-cards", "aicarbon-trend-chart", "aicarbon-model-table", "aicarbon-feature-table"].map(
                    (tag) => loading(element, tag),
                ),
            ).toEqual([false, false, false, false]);
            expect(body(element).getAttribute("aria-busy")).toBe("false");
        });

        it("hands the estimate to the tiles, with no error or no-data", async () => {
            const element = await render(async () => ({ data: estimate(5) }));
            await flush(element);
            const tiles = part(element, "aicarbon-summary-cards") as unknown as Record<string, unknown>;
            expect([tiles.error, tiles.noData, (tiles.estimate as EstimateResponseModel).total.requests]).toEqual([false, false, 5]);
        });
    });

    describe("Scenario: changing the range with figures on screen", () => {
        it("keeps the old figures, every part loading, until the new result arrives", async () => {
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
            expect(
                ["aicarbon-summary-cards", "aicarbon-trend-chart", "aicarbon-model-table", "aicarbon-feature-table"].map(
                    (tag) => loading(element, tag),
                ),
            ).toEqual([true, true, true, true]);
            expect((part(element, "aicarbon-summary-cards") as unknown as { estimate?: unknown }).estimate).toBeDefined();
            expect(body(element).getAttribute("aria-busy")).toBe("true");
            expect(body(element).classList.contains("reloading")).toBe(false);
            expect(element.shadowRoot!.querySelector("uui-loader-bar")).toBeNull();
            release({ data: estimate(7) });
            await flush(element);
            expect(loading(element, "aicarbon-model-table")).toBe(false);
        });
    });

    describe("Sad path: no usage in range", () => {
        it("shows the empty state with the headline and hint", async () => {
            const element = await render(async () => ({ data: estimate(0) }));
            await flush(element);
            const empty = element.shadowRoot!.querySelector("uaui-empty-state")!;
            expect([empty.getAttribute("headline"), empty.getAttribute("description")]).toEqual([
                "No AI usage in this period yet",
                "Pick a longer time range to look further back.",
            ]);
        });

        it("marks the tiles no-data, and shows no chart or tables", async () => {
            const element = await render(async () => ({ data: estimate(0) }));
            await flush(element);
            expect((part(element, "aicarbon-summary-cards") as unknown as { noData: boolean }).noData).toBe(true);
            expect(element.shadowRoot!.querySelector("aicarbon-trend-chart, aicarbon-model-table, aicarbon-feature-table")).toBeNull();
        });

        it("shows no error state", async () => {
            const element = await render(async () => ({ data: estimate(0) }));
            await flush(element);
            expect(element.shadowRoot!.querySelector("uaui-error-state")).toBeNull();
        });
    });

    describe("Scenario: changing the range while the empty state shows", () => {
        it("shows a loading bar on the box until the new result arrives", async () => {
            let calls = 0;
            const element = await render(() => (++calls === 1 ? Promise.resolve({ data: estimate(0) }) : new Promise(() => {})));
            await flush(element);
            expect(element.shadowRoot!.querySelector(".state uui-loader-bar")).toBeNull();
            chooseRange(element, "last30d");
            await element.updateComplete;
            expect(element.shadowRoot!.querySelector("uaui-empty-state")).not.toBeNull();
            expect(element.shadowRoot!.querySelector(".state uui-loader-bar")).not.toBeNull();
        });
    });

    describe("Sad path: analytics switched off", () => {
        it("explains that analytics are off and where to turn them on, never suggesting a wider range", async () => {
            const element = await render(async () => ({ data: estimate(0, false) }));
            await flush(element);
            const empty = element.shadowRoot!.querySelector("uaui-empty-state")!;
            expect(empty.getAttribute("headline")).toBe("Umbraco.AI analytics are switched off");
            expect(empty.getAttribute("description")).toContain("Umbraco:AI:Analytics:Enabled");
            expect(text(element)).not.toContain("longer time range");
            expect(empty.getAttribute("description")).not.toContain("longer time range");
        });

        it("shows no tiles, chart or tables, as there is nothing to estimate", async () => {
            const element = await render(async () => ({ data: estimate(0, false) }));
            await flush(element);
            expect(element.shadowRoot!.querySelector("aicarbon-summary-cards, aicarbon-trend-chart, aicarbon-model-table")).toBeNull();
        });
    });

    describe("Sad path: the request failed", () => {
        it("shows the error state with our wording and a Retry button", async () => {
            const element = await render(async () => failure(500));
            await flush(element);
            const error = element.shadowRoot!.querySelector("uaui-error-state")!;
            expect([error.getAttribute("headline"), error.getAttribute("description")]).toEqual([
                "The estimate couldn't be loaded.",
                "Check your connection and try again.",
            ]);
            expect(error.hasAttribute("retryable")).toBe(true);
        });

        it("shows the tiles' error dash", async () => {
            const element = await render(async () => failure(500));
            await flush(element);
            const tiles = part(element, "aicarbon-summary-cards") as unknown as { error: boolean; loading: boolean };
            expect([tiles.error, tiles.loading]).toEqual([true, false]);
        });

        it("Retry loads again, and the page goes back to loading", async () => {
            let calls = 0;
            const loader = vi.fn<AICarbonEstimateLoader>(() => (++calls === 1 ? Promise.resolve(failure(500)) : new Promise(() => {})));
            const element = await render(loader);
            await flush(element);
            element.shadowRoot!.querySelector("uaui-error-state")!.dispatchEvent(new Event("retry", { bubbles: true }));
            await flush(element);
            expect(loader).toHaveBeenCalledTimes(2);
            expect(element.shadowRoot!.querySelector("uaui-error-state")).toBeNull();
            expect(loading(element, "aicarbon-summary-cards")).toBe(true);
        });

        it("shows the error state when the failure has no HTTP status", async () => {
            const element = await render(async () => failure(undefined));
            await flush(element);
            const error = element.shadowRoot!.querySelector("uaui-error-state")!;
            expect(error.getAttribute("headline")).toBe("The estimate couldn't be loaded.");
        });
    });

    describe("Sad path: no AI section access", () => {
        it("says so, without a Retry button", async () => {
            const element = await render(async () => failure(403));
            await flush(element);
            const error = element.shadowRoot!.querySelector("uaui-error-state")!;
            expect(error.getAttribute("headline")).toBe("You need access to the AI section to see this.");
            expect([error.getAttribute("description"), error.hasAttribute("retryable")]).toEqual(["", false]);
        });

        it("shows no tiles, as an error dash would say something went wrong", async () => {
            const element = await render(async () => failure(403));
            await flush(element);
            expect(element.shadowRoot!.querySelector("aicarbon-summary-cards")).toBeNull();
        });
    });

    describe("Sad path: the request was aborted by something else", () => {
        it("ends a first load in the error state with Retry, not on the skeleton", async () => {
            const element = await render(async () => failure(undefined, true));
            await flush(element);
            const error = element.shadowRoot!.querySelector("uaui-error-state")!;
            expect(error.hasAttribute("retryable")).toBe(true);
        });

        it("drops it silently during a reload with figures shown", async () => {
            let calls = 0;
            const element = await render(async () => (++calls === 1 ? { data: estimate(5) } : failure(undefined, true)));
            await flush(element);
            chooseRange(element, "last30d");
            await flush(element);
            expect(element.shadowRoot!.querySelector("uaui-error-state")).toBeNull();
            expect(element.shadowRoot!.querySelector("#by-model")).not.toBeNull();
            expect(body(element).getAttribute("aria-busy")).toBe("false");
        });
    });

    describe("Scenario: the heading and method button stay in every state", () => {
        const states: Array<[string, AICarbonEstimateLoader]> = [
            ["loading", () => new Promise(() => {})],
            ["content", async () => ({ data: estimate(5) })],
            ["empty", async () => ({ data: estimate(0) })],
            ["analytics off", async () => ({ data: estimate(0, false) })],
            ["error", async () => failure(500)],
            ["forbidden", async () => failure(403)],
        ];

        it.each(states)("%s", async (_name, loader) => {
            const element = await render(loader);
            await flush(element);
            expect(element.shadowRoot!.querySelector(".page-title h3")!.textContent).toContain("Estimated CO2e from AI Inference");
            expect(element.shadowRoot!.querySelector("aicarbon-header")).not.toBeNull();
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
