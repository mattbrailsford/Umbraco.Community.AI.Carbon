import { css, customElement, html, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateRange } from "../estimate/index.js";

const RANGE_OPTIONS: ReadonlyArray<{ value: EstimateRange; key: string; fallback: string }> = [
    { value: "last24h", key: "aiCarbon_range_last24h", fallback: "Last 24 hours" },
    { value: "last7d", key: "aiCarbon_range_last7d", fallback: "Last 7 days" },
    { value: "last30d", key: "aiCarbon_range_last30d", fallback: "Last 30 days" },
];

function isEstimateRange(value: unknown): value is EstimateRange {
    return RANGE_OPTIONS.some((option) => option.value === value);
}

/**
 * Header controls for the CO2 view: the date-range select, plus the spot for the "How is this
 * calculated?" button (T18). Dispatches `range-change` with the chosen range in `detail`.
 */
@customElement("aicarbon-header")
export class AICarbonHeaderElement extends UmbLitElement {
    @property({ type: String })
    range: EstimateRange = "last7d";

    #onChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        if (!isEstimateRange(value)) return;
        this.dispatchEvent(new CustomEvent<EstimateRange>("range-change", { detail: value }));
    }

    override render() {
        const options = RANGE_OPTIONS.map((option) => ({
            name: this.localize.termOrDefault(option.key, option.fallback),
            value: option.value,
            selected: option.value === this.range,
        }));
        return html`
            <uui-select
                label=${this.localize.termOrDefault("aiCarbon_range_label", "Time range")}
                .options=${options}
                @change=${this.#onChange}
            ></uui-select>
            <!-- T18: the "How is this calculated?" button goes here. -->
        `;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: flex;
                align-items: center;
                gap: var(--uui-size-space-3);
            }
        `,
    ];
}

export default AICarbonHeaderElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-header": AICarbonHeaderElement;
    }
}
