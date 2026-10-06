import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateResponseModel } from "../api/types.gen.js";
import { buildSummaryCards, type SummaryCardKind } from "./summary-cards-model.js";
import "./summary-card.element.js";

const LABELS: Record<SummaryCardKind, { label: string; description: string }> = {
    co2e: { label: "Estimated CO2e", description: "Estimated emissions as a low-to-high range." },
    energy: { label: "Estimated energy", description: "Estimated energy used as a low-to-high range." },
    requests: { label: "Requests estimated", description: "Successful chat requests included in the estimate." },
    notEstimated: { label: "Models not estimated", description: "Models with no estimate data, so not counted." },
};

/** The four summary cards. Renders from the `estimate` property; it never fetches. */
@customElement("aicarbon-summary-cards")
export class AICarbonSummaryCardsElement extends UmbLitElement {
    @property({ type: Object })
    estimate?: EstimateResponseModel;

    override render() {
        if (!this.estimate) return nothing;
        return html`${buildSummaryCards(this.estimate).map((card) => {
            const text = LABELS[card.kind];
            return html`<aicarbon-summary-card
                icon=${card.icon}
                value=${card.value}
                label=${this.localize.termOrDefault(`aiCarbon_card_${card.kind}_label`, text.label)}
                description=${this.localize.termOrDefault(`aiCarbon_card_${card.kind}_description`, text.description)}
                ?warning=${card.warning}
            ></aicarbon-summary-card>`;
        })}`;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: var(--uui-size-space-5);
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
