import { css, html, customElement, nothing, property, state, type TemplateResult } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UMB_MODAL_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/modal";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UMB_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/workspace";
import type { EstimateResponseModel } from "../api/types.gen.js";
import {
    windowForCompareRange,
    windowForDateRange,
    AICarbonEstimateRepository,
    type AICarbonEstimateError,
    type AICarbonEstimateRequest,
    type AICarbonEstimateResult,
} from "../estimate/index.js";
import {
    ANALYTICS_WORKSPACE_CONTEXT_NAME,
    defaultAnalyticsDateRange,
    hasAnalyticsDateRange,
    toAnalyticsDateRange,
    type AnalyticsDateRange,
} from "../date-range/index.js";
import "../by-feature/index.js";
import "../by-model/index.js";
import { AICARBON_METHOD_PANEL_MODAL } from "../method/index.js";
import "../summary/index.js";
import "../trend/index.js";
import { selectViewState, type ViewState } from "./view-state.js";

/** Identifies the main range an estimate was loaded for. */
const rangeKey = (range: { from: string; to: string }) => `${range.from}|${range.to}`;

const SCOPE_FALLBACK =
    "AI provider side of chat requests only. Excludes your own servers, database and hosting.";

/** Loads one estimate. The default goes to the server; tests inject their own. */
export type AICarbonEstimateLoader = (
    request: AICarbonEstimateRequest,
    signal: AbortSignal,
) => Promise<AICarbonEstimateResult>;

/**
 * The "CO2" tab of Umbraco.AI's Analytics workspace. Owns loading and the estimate/error/loading
 * state, and renders one body per `selectViewState` result under an always-visible header. Loading, error and empty
 * are drawn by Analytics.UI's own states (tile and table `loading`/`error`/`no-data`, `uaui-error-state`, `uaui-empty-state`).
 */
@customElement("aicarbon-workspace-view")
export class AICarbonWorkspaceViewElement extends UmbLitElement {
    #repository = new AICarbonEstimateRepository(this);
    #abortController?: AbortController;
    #compareAbortController?: AbortController;

    /**
     * Test seam for the server call. Not a supported extension point.
     * @internal
     */
    @property({ attribute: false })
    loader: AICarbonEstimateLoader = (request, signal) => this.#repository.requestEstimate(request, signal);

    @state()
    private _estimate?: EstimateResponseModel;

    /** The main range `_estimate` was loaded for. A comparison only goes with figures of the same range. */
    private _estimateKey?: string;

    /** The zone the server counted `_estimate`'s Daily buckets in; `UTC` when it could not use the viewer's. */
    @state()
    private _estimateTimeZone?: string;

    /**
     * The compared period's estimate, with the main range it was loaded for. Only ever decoration: when it is missing,
     * failed, still loading, or for another range than the figures on screen, the tab shows no comparison.
     */
    @state()
    private _compare?: { key: string; estimate: EstimateResponseModel };

    @state()
    private _error?: AICarbonEstimateError;

    @state()
    private _loading = false;

    /** The range of Umbraco.AI's header picker, with its comparison when one is on. */
    @state()
    private _dateRange?: AnalyticsDateRange;

    #warned = false;

    override connectedCallback() {
        super.connectedCallback();
        // Loading from the start: the range arrives a moment later, and the page should not flash its empty shape first.
        this._loading = true;
        // A reconnect starts over, so the first range it reads always loads.
        this._dateRange = undefined;
        void this.#followHeaderRange();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.#abortController?.abort();
        this.#compareAbortController?.abort();
        this._loading = false;
    }

    /** Follows the range in Umbraco.AI's header; without it (or in a shape we don't know) the tab uses Umbraco.AI's default range. */
    async #followHeaderRange() {
        // The workspace context is there when this view connects; a miss means a different Umbraco.AI, so getContext rejects.
        const context = await this.getContext(UMB_WORKSPACE_CONTEXT).catch(() => undefined);
        if (!this.isConnected) return;
        if (hasAnalyticsDateRange(context)) {
            // One alias, so a reconnect replaces the observer instead of adding another.
            this.observe(context.dateRange, (value) => this.#applyDateRange(toAnalyticsDateRange(value)), "aicarbonHeaderDateRange");
        } else {
            this.#applyDateRange(undefined);
        }
    }

    #applyDateRange(next: AnalyticsDateRange | undefined) {
        if (!next && !this.#warned) {
            this.#warned = true;
            console.warn(
                `Umbraco.Community.AI.Carbon: could not read the date range from the ${ANALYTICS_WORKSPACE_CONTEXT_NAME}; using the last 7 days.`,
            );
        }
        const range = next ?? defaultAnalyticsDateRange();
        const previous = this._dateRange;
        this._dateRange = range;
        if (previous?.range.from !== range.range.from || previous?.range.to !== range.range.to) {
            // A new range reloads both: the compared period moves with it.
            void this.#load();
        } else if (previous.compare?.from !== range.compare?.from || previous.compare?.to !== range.compare?.to) {
            // A change to the comparison alone gives the same figures, so only the comparison reloads.
            void this.#loadCompare(true);
        }
    }

    async #load() {
        if (!this._dateRange) return;
        this.#abortController?.abort();
        const abortController = new AbortController();
        this.#abortController = abortController;

        this._loading = true;
        // A retry starts from a clean slate; figures already on screen stay until replaced, while the chart and tables show a loading bar.
        this._error = undefined;
        // Both requests start before either is awaited, so they run in parallel. The comparison never waits for or fails the figures.
        const key = rangeKey(this._dateRange.range);
        const request = this.loader(windowForDateRange(this._dateRange.range), abortController.signal);
        void this.#loadCompare(false);
        const { data, error, timeZone } = await request;

        // A newer load, or leaving the tab, supersedes this one.
        if (abortController.signal.aborted) return;
        // Cancelled by something else: with figures on screen, keep them and drop it silently.
        // With nothing to show, a first load must not hang on the loader, so it becomes a failure.
        if (error?.isAborted && this._estimate) {
            this._loading = false;
            return;
        }

        this._estimate = data;
        this._estimateKey = key;
        this._estimateTimeZone = timeZone;
        this._error = error;
        this._loading = false;
    }

    /**
     * Loads the compared period's estimate, with the main window's granularity and zone. A comparison is only shown
     * beside figures of the range it was loaded for (`rangeKey`), so a range change can keep the old pair on screen
     * until both new answers are in, whichever lands first. A change to the comparison alone drops the old one at
     * once, since it no longer matches. A failure or a cancelled request leaves no comparison and no message: the
     * figures it would have decorated stand on their own.
     */
    async #loadCompare(clearFirst: boolean) {
        this.#compareAbortController?.abort();
        const dateRange = this._dateRange;
        if (clearFirst || !dateRange?.compare) this._compare = undefined;
        if (!dateRange?.compare) return;
        const abortController = new AbortController();
        this.#compareAbortController = abortController;

        const key = rangeKey(dateRange.range);
        const request = windowForCompareRange(dateRange.compare, windowForDateRange(dateRange.range));
        const { data } = await this.loader(request, abortController.signal);

        // A newer comparison, a comparison switched off, or leaving the tab supersedes this one.
        if (abortController.signal.aborted) return;
        this._compare = data ? { key, estimate: data } : undefined;
    }

    async #onRetry() {
        void this.#load();
        // The error state is replaced by the loading page, so hand focus to the body rather than lose it.
        await this.updateComplete;
        this.shadowRoot?.querySelector<HTMLElement>("#body")?.focus();
    }

    async #onMethodOpen() {
        const method = this._estimate?.method;
        if (!method) return;
        const equivalent = this._estimate?.total.equivalent;
        const modalManager = await this.getContext(UMB_MODAL_MANAGER_CONTEXT);
        modalManager?.open(this, AICARBON_METHOD_PANEL_MODAL, { data: { method, equivalent } });
    }

    #t(key: string, fallback: string) {
        return this.localize.termOrDefault(key, fallback);
    }

    /** The page for the loading and content states: the same parts either way, so nothing jumps when the figures arrive. */
    #renderDashboard(estimate?: EstimateResponseModel) {
        const loading = this._loading;
        // The comparison of another range than the figures shown would measure the wrong periods against each other.
        const compare = estimate && this._compare && this._compare.key === this._estimateKey ? this._compare.estimate : undefined;
        return html`
            <div class="sections">
                <section id="summary">
                    <aicarbon-summary-cards
                        .estimate=${estimate}
                        .compare=${compare}
                        ?loading=${loading}
                    ></aicarbon-summary-cards>
                </section>
                ${estimate?.total.equivalent
                    ? html`<section id="equivalent">
                          <aicarbon-equivalent-strip .equivalent=${estimate.total.equivalent}></aicarbon-equivalent-strip>
                      </section>`
                    : nothing}
                <section id="trend">
                    <aicarbon-trend-chart
                        .points=${estimate?.timeSeries}
                        .comparePoints=${compare?.timeSeries}
                        .granularity=${estimate?.granularity ?? "Daily"}
                        .timeZone=${this._estimateTimeZone}
                        ?loading=${loading}
                    ></aicarbon-trend-chart>
                </section>
                <section id="by-model">
                    <aicarbon-model-table
                        .rows=${estimate?.byModel}
                        .compareRows=${compare?.byModel}
                        ?loading=${loading}
                    ></aicarbon-model-table>
                </section>
                <section id="by-feature">
                    <aicarbon-feature-table
                        .byFeature=${estimate?.byFeature}
                        .compareByFeature=${compare?.byFeature}
                        .analyticsEnabled=${estimate?.method.analyticsEnabled}
                        ?loading=${loading}
                    ></aicarbon-feature-table>
                </section>
            </div>
        `;
    }

    /** Tiles (when given) above one box holding a message state. A reload over a message shows a loading bar on the box. */
    #renderStateBox(state: TemplateResult, tiles?: TemplateResult) {
        return html`<div class="sections">
            ${tiles ? html`<section id="summary">${tiles}</section>` : nothing}
            <uui-box>
                <div class="state">
                    ${this._loading ? html`<uui-loader-bar></uui-loader-bar>` : nothing}
                    ${state}
                </div>
            </uui-box>
        </div>`;
    }

    #renderBody(state: ViewState) {
        switch (state) {
            case "loading":
                return this.#renderDashboard();
            case "content":
                return this.#renderDashboard(this._estimate);
            case "empty":
                return this.#renderStateBox(
                    html`<uaui-empty-state
                        headline=${this.#t("aiCarbon_empty_headline", "No AI usage in this period yet")}
                        description=${this.#t("aiCarbon_empty_hint", "Pick a longer time range to look further back.")}
                    ></uaui-empty-state>`,
                    html`<aicarbon-summary-cards .estimate=${this._estimate} no-data></aicarbon-summary-cards>`,
                );
            case "analyticsDisabled":
                return this.#renderStateBox(
                    html`<uaui-empty-state
                        icon="icon-settings"
                        headline=${this.#t("aiCarbon_analyticsDisabled_headline", "Umbraco.AI analytics are switched off")}
                        description=${this.#t(
                            "aiCarbon_analyticsDisabled_body",
                            "There is no usage recorded, so there is nothing to estimate. To turn analytics on, set Umbraco:AI:Analytics:Enabled to true in appsettings.json.",
                        )}
                    ></uaui-empty-state>`,
                );
            case "forbidden":
                // No description: the default ("The data could not be loaded.") would not say why. Retrying can't grant access.
                return this.#renderStateBox(
                    html`<uaui-error-state
                        icon="icon-lock"
                        headline=${this.#t("aiCarbon_forbidden", "You need access to the AI section to see this.")}
                        description=""
                    ></uaui-error-state>`,
                );
            case "error":
                return this.#renderStateBox(
                    html`<uaui-error-state
                        headline=${this.#t("aiCarbon_loadFailed", "The estimate couldn't be loaded.")}
                        description=${this.#t("aiCarbon_loadFailed_hint", "Check your connection and try again.")}
                        retryable
                        @retry=${this.#onRetry}
                    ></uaui-error-state>`,
                    html`<aicarbon-summary-cards error></aicarbon-summary-cards>`,
                );
        }
    }

    override render() {
        const state = selectViewState({
            estimate: this._estimate,
            // 0 marks a failure with no HTTP status (e.g. offline): still an error, not forbidden.
            errorStatus: this._error ? (this._error.status ?? 0) : undefined,
        });
        const methodLabel = this.#t("aiCarbon_method_button", "How is this calculated?");
        return html`
            <div class="layout">
                <div class="page-header">
                    <div class="page-title">
                        <h3>${this.#t("aiCarbon_headline", "Estimated CO2e from AI Inference")}</h3>
                        <p class="scope">${this.#t("aiCarbon_scope", SCOPE_FALLBACK)}</p>
                    </div>
                    <uui-button
                        look="default"
                        compact
                        label=${methodLabel}
                        title=${methodLabel}
                        ?disabled=${!this._estimate?.method}
                        @click=${this.#onMethodOpen}
                    >
                        <uui-icon name="icon-info"></uui-icon>
                    </uui-button>
                </div>
                <div id="body" tabindex="-1" aria-busy=${this._loading ? "true" : "false"}>
                    ${this.#renderBody(state)}
                </div>
            </div>
        `;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
                /* Same page padding and section spacing as Umbraco.AI's Usage dashboard. */
                padding: var(--uui-size-layout-2);
            }

            .layout {
                display: flex;
                flex-direction: column;
                gap: var(--uui-size-space-5);
            }

            .page-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: var(--uui-size-space-3);
                margin-bottom: var(--uui-size-space-3);
            }

            .page-title {
                flex: 1 1 20rem;
                min-width: 0;
            }

            .page-header h3 {
                margin: 0 0 var(--uui-size-space-1);
            }

            .scope {
                margin: 0;
                color: var(--uui-color-text-alt);
                font-size: var(--uui-type-small-size);
            }

            .sections {
                display: flex;
                flex-direction: column;
                gap: var(--uui-size-space-5);
            }

            #body:focus {
                outline: none;
            }

            /* Positions the loading bar a reload shows over an empty or switched-off message. */
            .state {
                position: relative;
            }

            .state uui-loader-bar {
                position: absolute;
                inset: 0 0 auto 0;
            }
        `,
    ];
}

export default AICarbonWorkspaceViewElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-workspace-view": AICarbonWorkspaceViewElement;
    }
}
