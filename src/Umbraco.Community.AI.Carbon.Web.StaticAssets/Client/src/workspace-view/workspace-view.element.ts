import { css, html, customElement, nothing, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UMB_MODAL_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/modal";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateResponseModel } from "../api/types.gen.js";
import {
    alignedWindow,
    AICarbonEstimateRepository,
    type AICarbonEstimateError,
    type AICarbonEstimateRequest,
    type AICarbonEstimateResult,
    type EstimateRange,
} from "../estimate/index.js";
import "../by-feature/index.js";
import "../by-model/index.js";
import "../header/index.js";
import { AICARBON_METHOD_PANEL_MODAL } from "../method/index.js";
import "../summary/index.js";
import "../trend/index.js";
import { loadDateRange, saveDateRange } from "./date-range-store.js";
import { selectViewState, type ViewState } from "./view-state.js";

const SCOPE_FALLBACK =
    "Covers the AI provider's servers and data centres for your chat requests. Your own servers, database and hosting are not included.";

/** Loads one estimate. The default goes to the server; tests inject their own. */
export type AICarbonEstimateLoader = (
    request: AICarbonEstimateRequest,
    signal: AbortSignal,
) => Promise<AICarbonEstimateResult>;

/**
 * The "CO2" tab of Umbraco.AI's Analytics workspace. Owns loading and the estimate/error/loading
 * state, and renders one body per `selectViewState` result under an always-visible header.
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

    @state()
    private _range: EstimateRange = loadDateRange();

    override connectedCallback() {
        super.connectedCallback();
        void this.#load();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.#abortController?.abort();
        this._loading = false;
    }

    async #load() {
        this.#abortController?.abort();
        const abortController = new AbortController();
        this.#abortController = abortController;

        this._loading = true;
        // A retry starts from a clean slate; figures already on screen stay (dimmed) until replaced.
        this._error = undefined;
        const { from, to, granularity } = alignedWindow(this._range);
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
        // The error box is replaced by the loader, so hand focus to the body rather than lose it.
        await this.updateComplete;
        this.shadowRoot?.querySelector<HTMLElement>("#body")?.focus();
    }

    #onRangeChange(event: CustomEvent<EstimateRange>) {
        this._range = event.detail;
        saveDateRange(this._range);
        void this.#load();
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

    #renderContent(estimate: EstimateResponseModel) {
        return html`
            <div class="sections">
                <section id="summary">
                    <aicarbon-summary-cards .estimate=${estimate}></aicarbon-summary-cards>
                </section>
                ${estimate.total.equivalent
                    ? html`<section id="equivalent">
                          <aicarbon-equivalent-strip .equivalent=${estimate.total.equivalent}></aicarbon-equivalent-strip>
                      </section>`
                    : nothing}
                <section id="trend">
                    <aicarbon-trend-chart
                        .points=${estimate.timeSeries}
                        .granularity=${estimate.granularity}
                    ></aicarbon-trend-chart>
                </section>
                <section id="by-model">
                    <aicarbon-model-table .rows=${estimate.byModel}></aicarbon-model-table>
                </section>
                <section id="by-feature">
                    <aicarbon-feature-table
                        .byFeature=${estimate.byFeature}
                        .analyticsEnabled=${estimate.method.analyticsEnabled}
                    ></aicarbon-feature-table>
                </section>
            </div>
        `;
    }

    #renderMessage(headline: string, detail?: string) {
        return html`<div class="message">
            <strong>${headline}</strong>
            ${detail ? html`<p>${detail}</p>` : nothing}
        </div>`;
    }

    #renderBody(state: ViewState) {
        switch (state) {
            case "loading":
                return html`<uui-box>
                    <uui-loader-bar></uui-loader-bar>
                    <p class="loading-text">${this.#t("aiCarbon_loading", "Loading the estimate…")}</p>
                </uui-box>`;
            case "content":
                return this._estimate ? this.#renderContent(this._estimate) : nothing;
            case "empty":
                return html`<uui-box>
                    ${this.#renderMessage(
                        this.#t("aiCarbon_empty_headline", "No AI usage in this period yet"),
                        this.#t("aiCarbon_empty_hint", "Pick a longer time range to look further back."),
                    )}
                </uui-box>`;
            case "analyticsDisabled":
                return html`<uui-box>
                    ${this.#renderMessage(
                        this.#t("aiCarbon_analyticsDisabled_headline", "Umbraco.AI analytics are switched off"),
                        this.#t(
                            "aiCarbon_analyticsDisabled_body",
                            "There is no usage recorded, so there is nothing to estimate. To turn analytics on, set Umbraco:AI:Analytics:Enabled to true in appsettings.json.",
                        ),
                    )}
                </uui-box>`;
            case "forbidden":
                return html`<uui-box>
                    ${this.#renderMessage(this.#t("aiCarbon_forbidden", "You need access to the AI section to see this."))}
                </uui-box>`;
            case "error":
                return html`<uui-box class="error" role="alert">
                    ${this.#renderMessage(
                        this.#t("aiCarbon_loadFailed", "The estimate couldn't be loaded."),
                        this.#t("aiCarbon_loadFailed_hint", "Check your connection and try again."),
                    )}
                    <uui-button
                        look="primary"
                        label=${this.#t("aiCarbon_retry", "Retry")}
                        @click=${this.#onRetry}
                    ></uui-button>
                </uui-box>`;
        }
    }

    override render() {
        const state = selectViewState({
            estimate: this._estimate,
            // 0 marks a failure with no HTTP status (e.g. offline): still an error, not forbidden.
            errorStatus: this._error ? (this._error.status ?? 0) : undefined,
        });
        // Reloading: figures from the previous range stay visible, dimmed, until the new ones arrive.
        const reloading = this._loading && state !== "loading";
        return html`
            <div class="layout">
                <div class="page-header">
                    <div class="page-title">
                        <h3>${this.#t("aiCarbon_headline", "Estimated CO2e from AI Inference")}</h3>
                        <p class="scope">${this.#t("aiCarbon_scope", SCOPE_FALLBACK)}</p>
                    </div>
                    <aicarbon-header
                        .range=${this._range}
                        .method=${this._estimate?.method}
                        @range-change=${this.#onRangeChange}
                        @method-open=${this.#onMethodOpen}
                    ></aicarbon-header>
                </div>
                ${reloading ? html`<uui-loader-bar></uui-loader-bar>` : nothing}
                <div
                    id="body"
                    tabindex="-1"
                    class=${reloading ? "reloading" : ""}
                    aria-busy=${this._loading ? "true" : "false"}
                >
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

            #body.reloading {
                opacity: 0.5;
                pointer-events: none;
            }

            .message {
                text-align: center;
                padding: var(--uui-size-space-6);
            }

            .loading-text {
                text-align: center;
                color: var(--uui-color-text-alt);
            }

            .error uui-button {
                display: block;
                width: fit-content;
                margin: 0 auto;
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
