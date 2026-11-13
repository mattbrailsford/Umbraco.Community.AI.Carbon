import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
// Loads Analytics.UI at runtime, which registers `uaui-kpi-tile`.
import "@umbraco/analytics-ui";
import type { EstimateResponseModel } from "../api/types.gen.js";
import { buildSummaryCards, type SummaryCardKind, type SummaryCardModel } from "./summary-cards-model.js";

const LABELS: Record<SummaryCardKind, { label: string; detail?: string }> = {
    co2e: { label: "Estimated CO2e" },
    energy: { label: "Estimated Energy" },
    requests: { label: "Requests Estimated", detail: "Successful chat requests" },
    notEstimated: { label: "Not Estimated", detail: "Models not in the totals" },
};

/** The four summary tiles. Renders from the `estimate` property; it never fetches. */
@customElement("aicarbon-summary-cards")
export class AICarbonSummaryCardsElement extends UmbLitElement {
    @property({ type: Object })
    estimate?: EstimateResponseModel;

    /** The second line: the likely range for the estimated figures, a short note for the counts. */
    #detail(card: SummaryCardModel): string | undefined {
        if (card.range) {
            return this.localize
                .termOrDefault("aiCarbon_card_range", "Likely {range}")
                .replace("{range}", () => card.range);
        }
        const fallback = LABELS[card.kind].detail;
        return fallback ? this.localize.termOrDefault(`aiCarbon_card_${card.kind}_detail`, fallback) : undefined;
    }

    override render() {
        if (!this.estimate) return nothing;
        return html`<div class="grid">${buildSummaryCards(this.estimate).map(
            (card) => html`<uaui-kpi-tile
                label=${this.localize.termOrDefault(`aiCarbon_card_${card.kind}_label`, LABELS[card.kind].label)}
                icon=${card.icon}
                .value=${card.value}
                .current=${card.current}
                .detail=${this.#detail(card)}
                .color=${card.status}
            ></uaui-kpi-tile>`,
        )}</div>`;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
                container-type: inline-size;
            }

            /* Four tiles: 4 across, then 2 x 2, then 1 column. Never 3 + 1. Gap is Usage's. */
            .grid {
                display: grid;
                grid-template-columns: 1fr;
                align-items: stretch;
                gap: var(--uui-size-space-5);
            }

            @container (min-width: 500px) {
                .grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }

            @container (min-width: 960px) {
                .grid {
                    grid-template-columns: repeat(4, 1fr);
                }
            }
        `,
    ];
}

export default AICarbonSummaryCardsElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-summary-cards": AICarbonSummaryCardsElement;
    }
}
