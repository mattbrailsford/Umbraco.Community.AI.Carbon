import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateResponseModel } from "../api/types.gen.js";
import { buildSummaryCards, type SummaryCardKind } from "./summary-cards-model.js";
import "./summary-card.element.js";

const LABELS: Record<SummaryCardKind, { label: string; description: string }> = {
    co2e: { label: "Estimated CO2e", description: "Estimated emissions as a low-to-high range." },
    energy: { label: "Estimated Energy", description: "Estimated energy used as a low-to-high range." },
    requests: { label: "Requests Estimated", description: "Successful chat requests included in the estimate." },
    notEstimated: { label: "Models Not Estimated", description: "Models with no estimate data, so not counted." },
};

/** The four summary cards. Renders from the `estimate` property; it never fetches. */
@customElement("aicarbon-summary-cards")
export class AICarbonSummaryCardsElement extends UmbLitElement {
    @property({ type: Object })
    estimate?: EstimateResponseModel;

    override render() {
        if (!this.estimate) return nothing;
        return html`<div class="grid">${buildSummaryCards(this.estimate).map((card) => {
            const text = LABELS[card.kind];
            return html`<aicarbon-summary-card
                icon=${card.icon}
                value=${card.value}
                unit=${card.unit}
                label=${this.localize.termOrDefault(`aiCarbon_card_${card.kind}_label`, text.label)}
                description=${this.localize.termOrDefault(`aiCarbon_card_${card.kind}_description`, text.description)}
                ?warning=${card.warning}
            ></aicarbon-summary-card>`;
        })}</div>`;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
                container-type: inline-size;
            }

            /* Four cards: 4 across, then 2 x 2, then 1 column. Never 3 + 1. Gap is Usage's. */
            .grid {
                display: grid;
                grid-template-columns: 1fr;
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
