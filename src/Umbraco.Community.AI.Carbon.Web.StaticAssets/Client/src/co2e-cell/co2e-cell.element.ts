import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { UauiTableCellElement, UauiTableColumn } from "@umbraco/analytics-ui";
import type { AiCarbonEstimateStatus } from "../api/types.gen.js";
import { CO2E_CELL, type Co2eColumnOptions } from "./co2e-cell.name.js";
import { describeWarning } from "../estimate/warning-text.js";

/** Why a row has no estimate, as a localization key and its English default. */
const NOT_ESTIMATED_REASON: Partial<Record<AiCarbonEstimateStatus, { key: string; fallback: string }>> = {
    UnknownModel: {
        key: "aiCarbon_byModel_unknownModel_detail",
        fallback: "Unknown model — EcoLogits doesn't know this model.",
    },
    UnsupportedCapability: {
        key: "aiCarbon_byModel_unsupported_detail",
        fallback: "Not supported — only chat (text generation) is estimated.",
    },
};

/** The row fields this cell reads. The column's own value is the midpoint, which is for sorting only. */
export interface Co2eCellItem {
    /** Left out for rows that are always estimated (the feature table). */
    status?: AiCarbonEstimateStatus;
    /** The headline figure with its unit, e.g. "≈ 5 g CO2e". */
    co2e?: string;
    /** The range as small text; empty when there is none. */
    co2eRange?: string;
    /** Raw warning codes; the cell turns them into text. */
    warnings?: readonly string[];
}

/**
 * The estimated CO2e cell for a `uaui-data-table`: the headline figure with its likely range on a second
 * line, a warnings icon for rows that have warnings, and "Not estimated" with the reason for rows that
 * have no figure. It reads everything from the row (`item`).
 */
@customElement(CO2E_CELL)
export class AICarbonCo2eCellElement extends UmbLitElement implements UauiTableCellElement {
    @property({ attribute: false })
    column: UauiTableColumn & Co2eColumnOptions = { key: "value", label: "" };

    @property({ attribute: false })
    item: Record<string, unknown> = {};

    @property({ attribute: false })
    value: unknown;

    /** With `reserveWarningSpace`, always renders the slot, so figures line up on one right edge whether or not a row has a warning. */
    #renderWarnings(warnings: readonly string[]) {
        if (warnings.length === 0) return this.column.reserveWarningSpace ? html`<span class="warnings-slot"></span>` : nothing;
        const text = warnings
            .map((code) => describeWarning(code, (key, fallback) => this.localize.termOrDefault(key, fallback)))
            .join("\n");
        return html`<span class="warnings-slot">
            <span class="warnings" role="img" tabindex="0" title=${text} aria-label=${text}>
                <uui-icon name="icon-info"></uui-icon>
            </span>
        </span>`;
    }

    /** The range with a link word for screen readers ("Likely 1.2–8.4 g CO2e"); the visible line stays the bare range. */
    #renderRange(range: string) {
        const spoken = this.localize.termOrDefault("aiCarbon_card_range", "Likely {range}").replace("{range}", () => range);
        return html`<div class="range" aria-hidden="true">${range}</div><span class="sr-only">${spoken}</span>`;
    }

    override render() {
        const { status = "Estimated", co2e, co2eRange, warnings = [] } = this.item as Co2eCellItem;
        if (status === "Estimated") {
            return html`<div class="figure">
                <div class="figure-text">
                    <div class="central">${co2e}</div>
                    ${co2eRange ? this.#renderRange(co2eRange) : nothing}
                </div>
                ${this.#renderWarnings(warnings)}
            </div>`;
        }
        const reason = NOT_ESTIMATED_REASON[status];
        const detail = reason ? this.localize.termOrDefault(reason.key, reason.fallback) : undefined;
        return html`<div class="figure">
            <span class="not-estimated" title=${detail ?? nothing}>
                ${this.localize.termOrDefault("aiCarbon_byModel_notEstimated", "Not estimated")}
            </span>
            ${detail ? html`<span class="sr-only">${detail}</span>` : nothing}
            ${this.#renderWarnings(warnings)}
        </div>`;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
            }

            .figure {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: var(--uui-size-space-2);
            }

            .figure-text {
                text-align: right;
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

            .warnings-slot {
                display: inline-flex;
                flex: 0 0 1.25em;
                justify-content: center;
            }

            .warnings {
                display: inline-flex;
                color: var(--uui-color-warning-standalone);
                cursor: help;
            }
        `,
    ];
}

export default AICarbonCo2eCellElement;

declare global {
    interface HTMLElementTagNameMap {
        [CO2E_CELL]: AICarbonCo2eCellElement;
    }
}
