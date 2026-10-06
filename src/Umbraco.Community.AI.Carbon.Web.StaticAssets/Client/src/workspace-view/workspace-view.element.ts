import { css, html, customElement, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateResponseModel } from "../api/types.gen.js";
import {
    alignedWindow,
    AICarbonEstimateRepository,
    type AICarbonEstimateError,
    type EstimateRange,
} from "../estimate/index.js";
import "../by-model/index.js";
import "../header/index.js";
import "../summary/index.js";

/**
 * The "CO2" tab of Umbraco.AI's Analytics workspace. Owns loading and the estimate/error/loading
 * state; the sections below are the seams where the header (T14), cards (T14), chart (T16),
 * tables (T15, T17) and method panel (T18) plug in, and T19 adds the state selection.
 */
@customElement("aicarbon-workspace-view")
export class AICarbonWorkspaceViewElement extends UmbLitElement {
    #repository = new AICarbonEstimateRepository(this);
    #abortController?: AbortController;

    @state()
    private _estimate?: EstimateResponseModel;

    @state()
    private _error?: AICarbonEstimateError;

    @state()
    private _loading = false;

    @state()
    private _range: EstimateRange = "last7d";

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
        const { from, to, granularity } = alignedWindow(this._range);
        const { data, error } = await this.#repository.requestEstimate({ from, to, granularity }, abortController.signal);

        // A newer load, or leaving the tab, supersedes this one.
        if (abortController.signal.aborted || error?.isAborted) return;

        this._estimate = data;
        this._error = error;
        this._loading = false;
    }

    #onRangeChange(event: CustomEvent<EstimateRange>) {
        this._range = event.detail;
        void this.#load();
    }

    #renderSummary() {
        if (this._error) {
            return html`<p>${this._error.isForbidden
                ? this.localize.termOrDefault("aiCarbon_forbidden", "You need access to the AI section to see this.")
                : this.localize.termOrDefault("aiCarbon_loadFailed", "The estimate could not be loaded.")}</p>`;
        }
        return html`<aicarbon-summary-cards .estimate=${this._estimate}></aicarbon-summary-cards>`;
    }

    override render() {
        return html`
            <uui-box>
                <div slot="headline">${this.localize.termOrDefault("aiCarbon_headline", "Estimated CO2 emissions")}</div>
                <aicarbon-header
                    slot="header-actions"
                    .range=${this._range}
                    @range-change=${this.#onRangeChange}
                ></aicarbon-header>
                ${this._loading ? html`<uui-loader-bar></uui-loader-bar>` : nothing}
                <section id="summary">${this.#renderSummary()}</section>
                <section id="trend"></section>
                <section id="by-model">
                    <aicarbon-model-table .rows=${this._estimate?.byModel}></aicarbon-model-table>
                </section>
                <section id="by-feature"></section>
            </uui-box>
        `;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
                padding: var(--uui-size-layout-1);
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
