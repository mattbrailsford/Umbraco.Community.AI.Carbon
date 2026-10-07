import { css, customElement, html, nothing, property, repeat } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { AiCarbonEstimateStatus, EstimateModelRowModel } from "../api/types.gen.js";
import { describeWarning } from "../estimate/warning-text.js";
import { buildModelRows, type ModelRowViewModel } from "./model-table-model.js";

/** Why a row has no estimate, as a localization key and its English default. */
const NOT_ESTIMATED_REASON: Partial<Record<AiCarbonEstimateStatus, { key: string; fallback: string }>> = {
    UnknownModel: {
        key: "aiCarbon_byModel_unknownModel_detail",
        fallback: "Unknown model \u2014 EcoLogits doesn't know this model.",
    },
    UnsupportedCapability: {
        key: "aiCarbon_byModel_unsupported_detail",
        fallback: "Not supported \u2014 only chat (text generation) is estimated.",
    },
};

/**
 * The "By Model" table. Renders from the `rows` property, in the order given; it never fetches.
 * Renders nothing when there are no rows: the empty page state belongs to the view (T19), and a
 * second "no models" line here would repeat it.
 */
@customElement("aicarbon-model-table")
export class AICarbonModelTableElement extends UmbLitElement {
    @property({ type: Array })
    rows?: EstimateModelRowModel[];

    #renderWarnings(row: ModelRowViewModel) {
        if (row.warnings.length === 0) return nothing;
        const text = row.warnings
            .map((code) => describeWarning(code, (key, fallback) => this.localize.termOrDefault(key, fallback)))
            .join("\n");
        return html`<span class="warnings" role="img" tabindex="0" title=${text} aria-label=${text}>
            <uui-icon name="icon-info"></uui-icon>
        </span>`;
    }

    #renderCo2e(row: ModelRowViewModel) {
        if (row.status === "Estimated") {
            return html`<div class="figure">
                <div class="figure-text">
                    <div class="central">${row.co2e}</div>
                    ${row.co2eRange ? html`<div class="range">${row.co2eRange}</div>` : nothing}
                </div>
                ${this.#renderWarnings(row)}
            </div>`;
        }
        const reason = NOT_ESTIMATED_REASON[row.status];
        const detail = reason ? this.localize.termOrDefault(reason.key, reason.fallback) : undefined;
        return html`<div class="figure">
            <span class="not-estimated" title=${detail ?? nothing}>
                ${this.localize.termOrDefault("aiCarbon_byModel_notEstimated", "Not estimated")}
            </span>
            ${detail ? html`<span class="sr-only">${detail}</span>` : nothing}
            ${this.#renderWarnings(row)}
        </div>`;
    }

    #renderRow(row: ModelRowViewModel) {
        return html`<uui-table-row>
            <uui-table-cell>
                <div class="model">
                    <span class="model-id">${row.modelId}</span>
                    <span class="provider">${row.providerId}</span>
                </div>
            </uui-table-cell>
            <uui-table-cell>${row.matchedAs}</uui-table-cell>
            <uui-table-cell>${row.zone}</uui-table-cell>
            <uui-table-cell class="number">${row.requests}</uui-table-cell>
            <uui-table-cell class="number">${row.outputTokens}</uui-table-cell>
            <uui-table-cell class="number co2e">${this.#renderCo2e(row)}</uui-table-cell>
        </uui-table-row>`;
    }

    override render() {
        if (!this.rows || this.rows.length === 0) return nothing;
        const t = (key: string, fallback: string) => this.localize.termOrDefault(key, fallback);
        return html`
            <uui-box class="flush" headline=${t("aiCarbon_byModel_headline", "By Model")}>
            <div class="table-scroll">
            <uui-table>
                <uui-table-head>
                    <uui-table-head-cell>${t("aiCarbon_byModel_model", "Model")}</uui-table-head-cell>
                    <uui-table-head-cell>${t("aiCarbon_byModel_matchedAs", "Matched As")}</uui-table-head-cell>
                    <uui-table-head-cell>${t("aiCarbon_byModel_zone", "Zone")}</uui-table-head-cell>
                    <uui-table-head-cell class="number">${t("aiCarbon_byModel_requests", "Requests")}</uui-table-head-cell>
                    <uui-table-head-cell class="number">${t("aiCarbon_byModel_outputTokens", "Output Tokens")}</uui-table-head-cell>
                    <uui-table-head-cell class="number">${t("aiCarbon_byModel_co2e", "Estimated CO2e")}</uui-table-head-cell>
                </uui-table-head>
                ${repeat(buildModelRows(this.rows), (row) => row.key, (row) => this.#renderRow(row))}
            </uui-table>
            </div>
            </uui-box>
        `;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
            }

            /* Tables run edge to edge inside the box: no box padding, no inset table border. */
            uui-box.flush {
                --uui-box-default-padding: 0;
            }

            uui-table {
                border: 0;
                border-radius: 0;
            }

            .table-scroll {
                overflow-x: auto;
            }

            uui-table-head-cell,
            uui-table-cell {
                height: auto;
            }

            .number {
                text-align: right;
            }

            .co2e {
                white-space: nowrap;
            }

            uui-table-row:nth-child(even) {
                background-color: var(--uui-color-surface-emphasis);
            }

            .model {
                display: flex;
                flex-direction: column;
            }

            .provider {
                font-size: var(--uui-type-small-size);
                color: var(--uui-color-text-alt);
            }

            /* The tooltip is hover-only; this keeps the explanation for keyboard, touch and screen readers. */
            .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                margin: -1px;
                padding: 0;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }

            .figure {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: var(--uui-size-space-2);
            }

            .central,
            .range,
            .not-estimated {
                white-space: nowrap;
            }

            .range,
            .not-estimated {
                color: var(--uui-color-text-alt);
            }

            .range {
                font-size: var(--uui-type-small-size);
            }

            .warnings {
                display: inline-flex;
                color: var(--uui-color-warning-standalone);
                cursor: help;
            }
        `,
    ];
}

export default AICarbonModelTableElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-model-table": AICarbonModelTableElement;
    }
}
