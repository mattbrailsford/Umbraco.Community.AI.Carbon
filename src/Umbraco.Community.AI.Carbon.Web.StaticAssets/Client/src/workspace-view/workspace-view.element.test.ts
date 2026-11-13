import { customElement } from "@umbraco-cms/backoffice/external/lit";
import { UmbContextBase } from "@umbraco-cms/backoffice/class-api";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbBasicState } from "@umbraco-cms/backoffice/observable-api";
import { UMB_MODAL_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/modal";
import { AICARBON_METHOD_PANEL_MODAL } from "../method/index.js";
import { UMB_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/workspace";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EstimateResponseModel } from "../api/types.gen.js";
import type { AnalyticsDateRange } from "../date-range/index.js";
import type { AICarbonEstimateError, AICarbonEstimateResult, AICarbonEstimateRequest } from "../estimate/index.js";
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

const longerRange: AnalyticsDateRange = { range: { from: "2026-10-15", to: "2026-11-13", preset: "last-30-days" } };
const lastWeek: AnalyticsDateRange = { range: { from: "2026-11-07", to: "2026-11-13", preset: "last-7-days" } };

@customElement("aicarbon-test-host")
class TestHostElement extends UmbLitElement {}

/** Stands in for Umbraco.AI's analytics workspace context: the default workspace context token plus its `dateRange`. */
class FakeAnalyticsWorkspaceContext extends UmbContextBase {
    readonly workspaceAlias = "Fake.Analytics";
    #dateRange: UmbBasicState<unknown>;
    readonly dateRange;

    constructor(host: UmbControllerHost, initial: unknown = lastWeek) {
        super(host, UMB_WORKSPACE_CONTEXT);
        this.#dateRange = new UmbBasicState<unknown>(initial);
        this.dateRange = this.#dateRange.asObservable();
    }

    setDateRange(value: unknown) {
        this.#dateRange.setValue(value);
    }
}

/** Renders the tab in a host that provides the fake context (with `initial` as its range), or none when `initial` is `null`. */
async function renderIn(loader: AICarbonEstimateLoader, initial: unknown = lastWeek, setup?: (host: TestHostElement) => void) {
    const host = new TestHostElement();
    document.body.appendChild(host);
    setup?.(host);
    const context = initial === null ? undefined : new FakeAnalyticsWorkspaceContext(host, initial);
    const element = new AICarbonWorkspaceViewElement();
    element.loader = loader;
    host.appendChild(element);
    await element.updateComplete;
    return { element, context };
}

async function render(loader: AICarbonEstimateLoader) {
    return (await renderIn(loader)).element;
}

async function flush(element: AICarbonWorkspaceViewElement) {
    await settle();
    await element.updateComplete;
}

const text = (element: AICarbonWorkspaceViewElement) => element.shadowRoot!.textContent ?? "";
const body = (element: AICarbonWorkspaceViewElement) => element.shadowRoot!.querySelector("#body")!;
const part = (element: AICarbonWorkspaceViewElement, tag: string) => element.shadowRoot!.querySelector(tag)!;
const loading = (element: AICarbonWorkspaceViewElement, tag: string) => (part(element, tag) as unknown as { loading: boolean }).loading;

describe("Feature: CO2 tab states", () => {
    afterEach(() => {
        document.body.innerHTML = "";
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
            const { element, context } = await renderIn(() => {
                calls++;
                return calls === 1 ? Promise.resolve({ data: estimate(5) }) : new Promise((r) => (release = r));
            });
            await flush(element);
            context!.setDateRange(longerRange);
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
            const { element, context } = await renderIn(() => (++calls === 1 ? Promise.resolve({ data: estimate(0) }) : new Promise(() => {})));
            await flush(element);
            expect(element.shadowRoot!.querySelector(".state uui-loader-bar")).toBeNull();
            context!.setDateRange(longerRange);
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
            const { element, context } = await renderIn(async () => (++calls === 1 ? { data: estimate(5) } : failure(undefined, true)));
            await flush(element);
            context!.setDateRange(longerRange);
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
            const button = element.shadowRoot!.querySelector('.page-header uui-button[label="How is this calculated?"]');
            expect(button).not.toBeNull();
        });
    });

    describe("Scenario: the method button", () => {
        const methodButton = (element: AICarbonWorkspaceViewElement) =>
            element.shadowRoot!.querySelector('uui-button[label="How is this calculated?"]')!;

        it("is disabled until an estimate has loaded", async () => {
            const element = await render(() => new Promise(() => {}));
            await flush(element);
            expect(methodButton(element).hasAttribute("disabled")).toBe(true);
        });

        it("is enabled once the estimate is there", async () => {
            const element = await render(async () => ({ data: estimate(5) }));
            await flush(element);
            expect(methodButton(element).hasAttribute("disabled")).toBe(false);
        });

        it("opens the method panel with the estimate's method and equivalent when clicked", async () => {
            const open = vi.fn();
            class FakeModalManager extends UmbContextBase {
                open = open;
                constructor(host: UmbControllerHost) {
                    super(host, UMB_MODAL_MANAGER_CONTEXT);
                }
            }
            const equivalent = { kind: "carKm", amount: 3 };
            const loaded = { ...estimate(5), total: { ...estimate(5).total, equivalent } } as unknown as EstimateResponseModel;
            const { element } = await renderIn(async () => ({ data: loaded }), lastWeek, (host) => void new FakeModalManager(host));
            await flush(element);
            methodButton(element).dispatchEvent(new Event("click"));
            await flush(element);
            expect(open).toHaveBeenCalledTimes(1);
            expect(open.mock.calls[0][1]).toBe(AICARBON_METHOD_PANEL_MODAL);
            expect(open.mock.calls[0][2]).toEqual({ data: { method: loaded.method, equivalent } });
        });
    });

    describe("Scenario: the tab follows Umbraco.AI's header range", () => {
        it("loads the window for the range in the workspace context", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), lastWeek);
            await flush(element);
            expect(requests.map((r) => [r.from.getTime() - r.to.getTime() < 0, r.granularity])).toEqual([[true, "Daily"]]);
            // 7 inclusive local days, whichever zone the tests run in: from the first local midnight to the one after the last.
            const [{ from, to }] = requests;
            expect(to.getTime() - from.getTime()).toBeGreaterThanOrEqual(7 * 24 * 3_600_000 - 3_600_000);
            expect(to.getTime() - from.getTime()).toBeLessThanOrEqual(7 * 24 * 3_600_000 + 3_600_000);
        });

        it("sends the browser's time zone with the window", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), lastWeek);
            await flush(element);
            expect(requests.map((r) => r.timeZone)).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
        });

        it("loads hourly for a one-day range", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn(
                async (request) => (requests.push(request), { data: estimate(5) }),
                { range: { from: "2026-11-13", to: "2026-11-13", preset: "today" } },
            );
            await flush(element);
            expect(requests.map((r) => r.granularity)).toEqual(["Hourly"]);
        });

        it("reloads when the header range changes", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element, context } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }));
            await flush(element);
            context!.setDateRange(longerRange);
            await flush(element);
            expect(requests).toHaveLength(2);
            expect(requests[1].from.getTime()).toBeLessThan(requests[0].from.getTime());
        });

        it("lets the latest range win when changes overlap", async () => {
            const releases: Array<(r: AICarbonEstimateResult) => void> = [];
            const { element, context } = await renderIn(() => new Promise((resolve) => releases.push(resolve)));
            await flush(element);
            context!.setDateRange(longerRange);
            await flush(element);
            releases[1]({ data: estimate(9) });
            releases[0]({ data: estimate(1) });
            await flush(element);
            const tiles = part(element, "aicarbon-summary-cards") as unknown as { estimate: EstimateResponseModel };
            expect(tiles.estimate.total.requests).toBe(9);
        });
    });

    describe("Scenario: comparing with a previous period", () => {
        const previousPeriod = { mode: "previous-period", from: "2026-10-31", to: "2026-11-06" };
        const withCompare: AnalyticsDateRange = { ...lastWeek, compare: previousPeriod };
        const tiles = (element: AICarbonWorkspaceViewElement) =>
            part(element, "aicarbon-summary-cards") as unknown as { estimate?: EstimateResponseModel; compare?: EstimateResponseModel };
        // The compare window of `lastWeek` starts around 31 October, the main one around 7 November, in any zone.
        const isCompare = (request: AICarbonEstimateRequest) => request.from.getTime() < Date.parse("2026-11-04T00:00:00Z");

        it("makes one call when no comparison is on", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }));
            await flush(element);
            expect(requests).toHaveLength(1);
        });

        it("starts both requests before either answers, so they run in parallel", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn((request) => (requests.push(request), new Promise(() => {})), withCompare);
            await flush(element);
            expect(requests).toHaveLength(2);
        });

        it("asks for the compare window with the main window's granularity and zone", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), withCompare);
            await flush(element);
            const [main, compare] = requests;
            expect([compare.granularity, compare.timeZone]).toEqual([main.granularity, main.timeZone]);
            expect(compare.to.getTime()).toBeLessThanOrEqual(main.from.getTime() + 3_600_000);
        });

        it("keeps the main granularity when the compared period has another length", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const oneDay: AnalyticsDateRange = {
                range: { from: "2026-11-13", to: "2026-11-13", preset: "today" },
                compare: { mode: "custom", from: "2026-11-01", to: "2026-11-10" },
            };
            const { element } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), oneDay);
            await flush(element);
            expect(requests.map((r) => r.granularity)).toEqual(["Hourly", "Hourly"]);
        });

        it("hands the compare estimate to the tiles, next to the main one", async () => {
            const { element } = await renderIn(async (request) => ({ data: estimate(isCompare(request) ? 3 : 8) }), withCompare);
            await flush(element);
            expect([tiles(element).estimate?.total.requests, tiles(element).compare?.total.requests]).toEqual([8, 3]);
        });

        it("reloads only the comparison when only the comparison changes", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element, context } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }));
            await flush(element);
            context!.setDateRange(withCompare);
            await flush(element);
            expect(requests).toHaveLength(2);
            expect(requests[1].to.getTime()).toBeLessThanOrEqual(requests[0].from.getTime() + 3_600_000);
        });

        it("does not touch the figures when only the comparison changes", async () => {
            const { element, context } = await renderIn(async () => ({ data: estimate(5) }));
            await flush(element);
            const before = tiles(element).estimate;
            context!.setDateRange(withCompare);
            await flush(element);
            expect(tiles(element).estimate).toBe(before);
        });

        it("reloads both when the range changes with a comparison on", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element, context } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), withCompare);
            await flush(element);
            context!.setDateRange({ ...longerRange, compare: { mode: "previous-period", from: "2026-09-15", to: "2026-10-14" } });
            await flush(element);
            expect(requests).toHaveLength(4);
        });

        it("makes no call and drops the comparison when it is turned off", async () => {
            const requests: AICarbonEstimateRequest[] = [];
            const { element, context } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), withCompare);
            await flush(element);
            context!.setDateRange(lastWeek);
            await flush(element);
            expect([requests.length, tiles(element).compare]).toEqual([2, undefined]);
        });

        // Either answer can come last, and a failed comparison must leave the figures alone in both orders.
        it.each([
            ["before", true],
            ["after", false],
        ])("keeps the main figures and shows no comparison when the compare request fails %s the figures arrive", async (_when, compareFirst) => {
            const { element } = await renderIn(async (request) => {
                if (!isCompare(request)) {
                    if (compareFirst) await settle();
                    return { data: estimate(8) };
                }
                if (!compareFirst) await settle();
                return failure(500);
            }, withCompare);
            await flush(element);
            await flush(element);
            expect([tiles(element).estimate?.total.requests, tiles(element).compare, element.shadowRoot!.querySelector("uaui-error-state")]).toEqual([8, undefined, null]);
        });

        it.each([
            ["before", true],
            ["after", false],
        ])("keeps the main figures and shows no comparison when the compare request is aborted by something else %s the figures arrive", async (_when, compareFirst) => {
            const { element } = await renderIn(async (request) => {
                if (!isCompare(request)) {
                    if (compareFirst) await settle();
                    return { data: estimate(8) };
                }
                if (!compareFirst) await settle();
                return failure(undefined, true);
            }, withCompare);
            await flush(element);
            await flush(element);
            expect([tiles(element).estimate?.total.requests, tiles(element).compare]).toEqual([8, undefined]);
        });

        it("does not wait for a slow comparison to show the figures", async () => {
            const { element } = await renderIn(
                (request) => (isCompare(request) ? new Promise(() => {}) : Promise.resolve({ data: estimate(8) })),
                withCompare,
            );
            await flush(element);
            expect([tiles(element).estimate?.total.requests, loading(element, "aicarbon-summary-cards")]).toEqual([8, false]);
        });

        it("lets the latest comparison win when changes overlap", async () => {
            const releases: Array<(r: AICarbonEstimateResult) => void> = [];
            const { element, context } = await renderIn(() => new Promise((resolve) => releases.push(resolve)));
            await flush(element);
            releases[0]({ data: estimate(5) });
            context!.setDateRange(withCompare);
            await flush(element);
            context!.setDateRange({ ...lastWeek, compare: { mode: "previous-year", from: "2025-11-07", to: "2025-11-13" } });
            await flush(element);
            releases[2]({ data: estimate(9) });
            releases[1]({ data: estimate(1) });
            await flush(element);
            expect(tiles(element).compare?.total.requests).toBe(9);
        });

        it("aborts a comparison in flight when it is turned off", async () => {
            const signals: AbortSignal[] = [];
            const { element, context } = await renderIn((_request, signal) => (signals.push(signal), new Promise(() => {})), withCompare);
            await flush(element);
            context!.setDateRange(lastWeek);
            await flush(element);
            expect(signals.map((signal) => signal.aborted)).toEqual([false, true]);
        });

        it("aborts both requests when the tab is left", async () => {
            const signals: AbortSignal[] = [];
            const { element } = await renderIn((_request, signal) => (signals.push(signal), new Promise(() => {})), withCompare);
            await flush(element);
            element.remove();
            expect(signals.map((signal) => signal.aborted)).toEqual([true, true]);
        });

        describe("a range change while a comparison is on", () => {
            const compareB = { mode: "previous-period", from: "2026-09-15", to: "2026-10-14" };
            const rangeB: AnalyticsDateRange = { ...longerRange, compare: compareB };
            // Calls come in this order: A (figures), A' (its comparison), B, B'. Each answers with its own request count.
            const COUNTS = { A: 1, "A'": 2, B: 3, "B'": 4 } as const;
            const names = ["A", "A'", "B", "B'"] as const;

            async function setup() {
                const answers: Array<(r: AICarbonEstimateResult) => void> = [];
                const { element, context } = await renderIn(() => new Promise((resolve) => answers.push(resolve)), withCompare);
                await flush(element);
                const answer = (name: (typeof names)[number], result?: AICarbonEstimateResult) =>
                    answers[names.indexOf(name)](result ?? { data: estimate(COUNTS[name]) });
                // Every pairing the tab may show: figures with their own comparison, or with none.
                const seen: Array<[number | undefined, number | undefined]> = [];
                const look = async () => {
                    await flush(element);
                    seen.push([tiles(element).estimate?.total.requests, tiles(element).compare?.total.requests]);
                    const chart = part(element, "aicarbon-trend-chart") as unknown as { comparePoints?: unknown };
                    const model = part(element, "aicarbon-model-table") as unknown as { compareRows?: unknown };
                    // The chart and the tables follow the tiles: a comparison is passed to all of them or none.
                    expect([chart.comparePoints !== undefined, model.compareRows !== undefined]).toEqual([
                        tiles(element).compare !== undefined,
                        tiles(element).compare !== undefined,
                    ]);
                };
                // The first figures and their comparison are in before the range changes.
                answer("A");
                answer("A'");
                await flush(element);
                return { answer, context, look, seen };
            }
            const allowed = [
                [undefined, undefined],
                [1, undefined],
                [1, 2],
                [3, undefined],
                [3, 4],
            ];

            it("keeps the old figures with their own comparison until the new figures arrive", async () => {
                const { context, look, seen } = await setup();
                await look();
                context!.setDateRange(rangeB);
                await look();
                expect(seen[seen.length - 1]).toEqual([1, 2]);
            });

            it("shows no comparison when the new comparison arrives before the new figures", async () => {
                const { answer, context, look, seen } = await setup();
                context!.setDateRange(rangeB);
                await look();
                answer("B'");
                await look();
                expect(seen[seen.length - 1]).toEqual([1, undefined]);
                answer("B");
                await look();
                expect(seen[seen.length - 1]).toEqual([3, 4]);
                expect(seen.every((pair) => allowed.some((ok) => ok[0] === pair[0] && ok[1] === pair[1]))).toBe(true);
            });

            it("shows no comparison when the new figures arrive before the new comparison, until it does", async () => {
                const { answer, context, look, seen } = await setup();
                context!.setDateRange(rangeB);
                await look();
                answer("B");
                await look();
                expect(seen[seen.length - 1]).toEqual([3, undefined]);
                answer("B'");
                await look();
                expect(seen[seen.length - 1]).toEqual([3, 4]);
            });

            it("never pairs the old figures with the new comparison when the new figures are cancelled by something else", async () => {
                const { answer, context, look, seen } = await setup();
                context!.setDateRange(rangeB);
                await look();
                answer("B'");
                answer("B", failure(undefined, true));
                await look();
                expect(seen.every((pair) => allowed.some((ok) => ok[0] === pair[0] && ok[1] === pair[1]))).toBe(true);
                expect(seen[seen.length - 1]).toEqual([1, undefined]);
            });

            it("drops the comparison at once when only the comparison changes", async () => {
                const { context, look, seen } = await setup();
                await look();
                context!.setDateRange({ ...lastWeek, compare: { mode: "previous-year", from: "2025-11-07", to: "2025-11-13" } });
                await look();
                expect(seen[seen.length - 1]).toEqual([1, undefined]);
            });
        });
    });

    describe("Scenario: Umbraco.AI's header range cannot be read", () => {
        const waitForFallback = () => new Promise((resolve) => setTimeout(resolve, 100));

        it("falls back to the last 7 days and warns once, naming the expected context, when there is no workspace context", async () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), null);
            await waitForFallback();
            await element.updateComplete;
            expect(requests).toHaveLength(1);
            expect(requests[0].granularity).toBe("Daily");
            expect(warn).toHaveBeenCalledTimes(1);
            expect(String(warn.mock.calls[0][0])).toContain("dateRange");
            expect(text(element)).toContain("Estimated CO2e from AI Inference");
        });

        it("falls back, and warns, when the context emits a range of an unknown shape", async () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            const requests: AICarbonEstimateRequest[] = [];
            const { element } = await renderIn(async (request) => (requests.push(request), { data: estimate(5) }), { from: 1, to: 2 });
            await flush(element);
            expect(requests).toHaveLength(1);
            expect(warn).toHaveBeenCalledTimes(1);
        });
    });
});
