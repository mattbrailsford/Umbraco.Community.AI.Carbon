import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";

/** One figure with a label and a short description. Styled after Umbraco.AI's Usage summary card. */
@customElement("aicarbon-summary-card")
export class AICarbonSummaryCardElement extends UmbLitElement {
    @property({ type: String })
    icon = "icon-activity";

    @property({ type: String })
    value = "";

    @property({ type: String })
    label = "";

    @property({ type: String })
    description = "";

    @property({ type: Boolean, reflect: true })
    warning = false;

    override render() {
        return html`<uui-card class="summary-card">
            <div class="card-icon"><uui-icon .name=${this.icon}></uui-icon></div>
            <div class="card-content">
                <div class="card-value">${this.value}</div>
                <div class="card-label">${this.label}</div>
                ${this.description ? html`<div class="card-description">${this.description}</div>` : nothing}
            </div>
        </uui-card>`;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
            }

            .summary-card {
                display: flex;
                gap: var(--uui-size-space-2);
                padding: var(--uui-size-space-5);
            }

            .card-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
            }

            .card-icon uui-icon {
                font-size: 1.5rem;
                color: var(--uui-color-current);
            }

            :host([warning]) .card-icon uui-icon,
            :host([warning]) .card-value {
                color: var(--uui-color-warning-standalone);
            }

            .card-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: var(--uui-size-space-1);
            }

            .card-value {
                font-size: var(--uui-type-h3-size);
                font-weight: 700;
                line-height: 1;
            }

            .card-label {
                font-size: var(--uui-type-small-size);
                color: var(--uui-color-text-alt);
                font-weight: 500;
            }

            .card-description {
                font-size: var(--uui-type-small-size);
                color: var(--uui-color-text-alt);
            }
        `,
    ];
}

export default AICarbonSummaryCardElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-summary-card": AICarbonSummaryCardElement;
    }
}
