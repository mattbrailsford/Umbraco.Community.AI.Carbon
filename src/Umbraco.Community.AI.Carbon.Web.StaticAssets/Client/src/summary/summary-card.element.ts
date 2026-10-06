import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";

/** One figure with a label; the description is the hover tooltip. Styled after Umbraco.AI's Usage summary card. */
@customElement("aicarbon-summary-card")
export class AICarbonSummaryCardElement extends UmbLitElement {
    @property({ type: String })
    icon = "icon-activity";

    @property({ type: String })
    value = "";

    /** Smaller text after the value (e.g. "g CO2e"), so a long range doesn't wrap in a card of Usage's width. */
    @property({ type: String })
    unit = "";

    @property({ type: String })
    label = "";

    @property({ type: String })
    description = "";

    @property({ type: Boolean, reflect: true })
    warning = false;

    override render() {
        return html`<uui-card class="summary-card" title=${this.description || nothing}>
            <div class="card-icon"><uui-icon .name=${this.icon}></uui-icon></div>
            <div class="card-content">
                <div class="card-value">
                    <span class="card-number">${this.value}</span>${this.unit
                        ? html`<span class="card-unit"> ${this.unit}</span>`
                        : nothing}
                </div>
                <div class="card-label">${this.label}</div>
                ${this.description ? html`<div class="sr-only">${this.description}</div>` : nothing}
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
                color: var(--uui-color-default-emphasis, #2d42ab);
            }

            :host([warning]) .card-icon uui-icon,
            :host([warning]) .card-value {
                color: var(--uui-color-warning-standalone);
            }

            .card-content {
                flex: 1;
                display: flex;
                flex-direction: column;
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

            /* Hover shows the description as a tooltip; this keeps it for keyboard, touch and screen readers. */
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

            .card-number {
                white-space: nowrap;
            }

            .card-unit {
                font-size: var(--uui-type-default-size);
                white-space: nowrap;
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
