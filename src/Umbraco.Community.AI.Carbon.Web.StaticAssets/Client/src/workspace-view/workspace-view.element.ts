import { css, html, customElement, nothing, property, state, type TemplateResult } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UMB_MODAL_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/modal";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UMB_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/workspace";
import type { EstimateResponseModel } from "../api/types.gen.js";
import {
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

    /**
     * Test seam for the server call. Not a supported extension point.
     * @internal
     */
    @property({ attribute: false })
    loader: AICarbonEstimateLoader = (request, signal) => this.#repository.requestEstimate(request, signal);

    @state()
    private _estimate?: EstimateResponseModel;

    @state()
    private _error?: AICarbonEstimateError;

    @state()
    private _loading = false;

    /** The range of Umbraco.AI's header picker. Kept whole so the comparison can use it later; only `range` is read today. */
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
        const previous = this._dateRange?.range;
        this._dateRange = range;
        // A change to the comparison alone gives the same figures.
        if (previous?.from === range.range.from && previous?.to === range.range.to) return;
        void this.#load();
    }

    async #load() {
        if (!this._dateRange) return;
        this.#abortController?.abort();
        const abortController = new AbortController();
        this.#abortController = abortController;

        this._loading = true;
        // A retry starts from a clean slate; figures already on screen stay until replaced, while the chart and tables show a loading bar.
        this._error = undefined;
        const { from, to, granularity } = windowForDateRange(this._dateRange.range);
        const { data, error } = await this.loader({ from, to, granularity }, abortController.signal);

        // A newer load, or leaving the tab, supersedes this one.
        if (abortController.signal.aborted) return;
        // Cancelled by something else: with figures on screen, keep them and drop it silently.
        // With nothing to show, a first load must not hang on the loader, so it becomes a failure.
        if (error?.isAborted && this._estimate) {
            this._loading = false;
            return;
        }

        this._estimate = data;
        this._error = error;
        this._loading = false;
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
        return html`
            <div class="sections">
                <section id="summary">
                    <aicarbon-summary-cards .estimate=${estimate} ?loading=${loading}></aicarbon-summary-cards>
                </section>
                ${estimate?.total.equivalent
                    ? html`<section id="equivalent">
                          <aicarbon-equivalent-strip .equivalent=${estimate.total.equivalent}></aicarbon-equivalent-strip>
                      </section>`
                    : nothing}
                <section id="trend">
                    <aicarbon-trend-chart
                        .points=${estimate?.timeSeries}
                        .granularity=${estimate?.granularity ?? "Daily"}
                        ?loading=${loading}
                    ></aicarbon-trend-chart>
                </section>
                <section id="by-model">
                    <aicarbon-model-table .rows=${estimate?.byModel} ?loading=${loading}></aicarbon-model-table>
                </section>
                <section id="by-feature">
                    <aicarbon-feature-table
                        .byFeature=${estimate?.byFeature}
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
