import { css, customElement, html, property } from "@umbraco-cms/backoffice/external/lit";
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

    /** The compared period's estimate. With it the tiles show how each figure changed; unset shows no change. */
    @property({ type: Object })
    compare?: EstimateResponseModel;

    /** The estimate is being loaded: tiles with no figures yet draw a skeleton, tiles with figures stay as they are. */
    @property({ type: Boolean })
    loading = false;

    /** The load failed: every tile shows its error dash. Wins over `loading` and `noData`. */
    @property({ type: Boolean })
    error = false;

    /** There is no usage in the period: every tile shows "no data" instead of a zero. */
    @property({ type: Boolean, attribute: "no-data" })
    noData = false;

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
        return html`<div class="grid">${buildSummaryCards(this.estimate, this.compare).map(
            (card) => html`<uaui-kpi-tile
                label=${this.localize.termOrDefault(`aiCarbon_card_${card.kind}_label`, LABELS[card.kind].label)}
                icon=${card.icon}
                .value=${card.value}
                .current=${card.current}
                .previous=${card.previous}
                .lowerIsBetter=${card.lowerIsBetter}
                .detail=${this.#detail(card)}
                .color=${card.status}
                ?loading=${this.loading}
                ?error=${this.error}
                ?no-data=${this.noData || card.noData}
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

            /* Four tiles: 4 across, then 2 x 2, then 1 column. Never 3 + 1. Same gap as Usage's tiles. */
            .grid {
                display: grid;
                grid-template-columns: 1fr;
                align-items: stretch;
                gap: var(--uui-size-space-4);
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
