import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateEquivalentModel } from "../api/types.gen.js";
import { formatEquivalent } from "../estimate/format-equivalent.js";

/** One quiet line relating the estimate to something everyday. Renders nothing without an equivalent. */
@customElement("aicarbon-equivalent-strip")
export class AICarbonEquivalentStripElement extends UmbLitElement {
    @property({ type: Object })
    equivalent?: EstimateEquivalentModel | null;

    override render() {
        const text = formatEquivalent(this.equivalent, (key, fallback) => this.localize.termOrDefault(key, fallback));
        if (!text) return nothing;
        return html`<div class="strip">
            <uui-icon name="icon-globe" aria-hidden="true"></uui-icon>
            <span class="sr-only">${this.localize.termOrDefault("aiCarbon_equivalent_srPrefix", "Estimated CO2e is ")}</span>
            <span class="text">${text}</span>
        </div>`;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
            }

            .strip {
                display: flex;
                align-items: center;
                gap: var(--uui-size-space-3);
                padding: var(--uui-size-space-3) var(--uui-size-space-5);
                background: var(--uui-color-surface);
                border: 1px solid var(--uui-color-border);
                border-radius: var(--uui-border-radius);
            }

            /* Gives screen readers the context the visible text leaves implicit. */
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

            uui-icon {
                color: var(--uui-color-default-emphasis, #2d42ab);
            }
        `,
    ];
}

export default AICarbonEquivalentStripElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-equivalent-strip": AICarbonEquivalentStripElement;
    }
}
