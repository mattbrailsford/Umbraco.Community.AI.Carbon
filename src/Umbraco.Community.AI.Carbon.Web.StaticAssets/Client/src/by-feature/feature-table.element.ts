import { css, customElement, html, nothing, property, repeat } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateFeatureBreakdownModel } from "../api/types.gen.js";
import { buildFeatureRows, type FeatureRowViewModel } from "./feature-table-model.js";

/**
 * The "By Feature" table. Renders from the `byFeature` property, in the order given; it never fetches.
 * - Analytics switched off: renders nothing, because the whole-view message (T19) covers it.
 * - Breakdown unavailable (analytics on): a short note pointing at the Umbraco.AI setting.
 * - Available but no items: renders nothing, the empty page state belongs to the view.
 * There is deliberately no share-of-total column: a percentage of a range would imply precision the
 * estimate doesn't have.
 */
@customElement("aicarbon-feature-table")
export class AICarbonFeatureTableElement extends UmbLitElement {
    @property({ attribute: false })
    byFeature?: EstimateFeatureBreakdownModel;

    /** From the estimate's method info. Unknown (not loaded yet) renders nothing. */
    @property({ attribute: false })
    analyticsEnabled?: boolean;

    #renderRow(row: FeatureRowViewModel) {
        const label = row.labelKey ? this.localize.termOrDefault(row.labelKey, row.fallbackLabel) : row.fallbackLabel;
        return html`<uui-table-row>
            <uui-table-cell class="feature">${label}</uui-table-cell>
            <uui-table-cell class="number">${row.requests}</uui-table-cell>
            <uui-table-cell class="number">
                <div class="central">${row.co2e}</div>
                ${row.co2eRange ? html`<div class="range">${row.co2eRange}</div>` : nothing}
            </uui-table-cell>
        </uui-table-row>`;
    }

    override render() {
        if (!this.analyticsEnabled || !this.byFeature) return nothing;
        const t = (key: string, fallback: string) => this.localize.termOrDefault(key, fallback);
        const headline = t("aiCarbon_byFeature_headline", "By Feature");

        if (!this.byFeature.available) {
            return html`<uui-box headline=${headline}>
                <p class="note">
                    ${t(
                        "aiCarbon_byFeature_switchedOff",
                        "Feature breakdown is switched off in Umbraco.AI analytics settings.",
                    )}
                </p>
            </uui-box>`;
        }
        if (this.byFeature.items.length === 0) return nothing;

        return html`
            <uui-box class="flush" headline=${headline}>
            <div class="table-scroll">
            <uui-table>
                <uui-table-head>
                    <uui-table-head-cell>${t("aiCarbon_byFeature_feature", "Feature")}</uui-table-head-cell>
                    <uui-table-head-cell class="number">${t("aiCarbon_byFeature_requests", "Requests")}</uui-table-head-cell>
                    <uui-table-head-cell class="number">${t("aiCarbon_byFeature_co2e", "Estimated CO2e")}</uui-table-head-cell>
                </uui-table-head>
                ${repeat(buildFeatureRows(this.byFeature.items), (row) => row.key, (row) => this.#renderRow(row))}
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

            .note {
                margin: 0;
                color: var(--uui-color-text-alt);
            }

            uui-table-head-cell,
            uui-table-cell {
                height: auto;
            }

            .number {
                text-align: right;
            }

            .central,
            .range {
                white-space: nowrap;
            }

            .range {
                font-size: var(--uui-type-small-size);
                color: var(--uui-color-text-alt);
            }

            uui-table-row:nth-child(even) {
                background-color: var(--uui-color-surface-emphasis);
            }
        `,
    ];
}

export default AICarbonFeatureTableElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-feature-table": AICarbonFeatureTableElement;
    }
}
