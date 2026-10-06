import { css, customElement, html, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { EstimateMethodModel } from "../api/types.gen.js";
import type { EstimateRange } from "../estimate/index.js";

const RANGE_OPTIONS: ReadonlyArray<{ value: EstimateRange; key: string; fallback: string }> = [
    { value: "last24h", key: "aiCarbon_range_last24h", fallback: "Last 24 Hours" },
    { value: "last7d", key: "aiCarbon_range_last7d", fallback: "Last 7 Days" },
    { value: "last30d", key: "aiCarbon_range_last30d", fallback: "Last 30 Days" },
];

function isEstimateRange(value: unknown): value is EstimateRange {
    return RANGE_OPTIONS.some((option) => option.value === value);
}

/**
 * Header controls for the CO2 view: the date-range select and the icon-only "How is this calculated?" button.
 * Dispatches `range-change` with the chosen range in `detail`, and `method-open` when the button is
 * clicked (the button stays disabled until `method` is set, i.e. an estimate has loaded).
 */
@customElement("aicarbon-header")
export class AICarbonHeaderElement extends UmbLitElement {
    @property({ type: String })
    range?: EstimateRange;

    @property({ attribute: false })
    method?: EstimateMethodModel;

    #onChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        if (!isEstimateRange(value)) return;
        this.dispatchEvent(new CustomEvent<EstimateRange>("range-change", { detail: value }));
    }

    #onMethodClick() {
        this.dispatchEvent(new CustomEvent("method-open"));
    }

    override render() {
        const options = RANGE_OPTIONS.map((option) => ({
            name: this.localize.termOrDefault(option.key, option.fallback),
            value: option.value,
            selected: option.value === this.range,
        }));
        const methodLabel = this.localize.termOrDefault("aiCarbon_method_button", "How is this calculated?");
        return html`
            <uui-select
                label=${this.localize.termOrDefault("aiCarbon_range_label", "Time Range")}
                .options=${options}
                @change=${this.#onChange}
            ></uui-select>
            <uui-button
                look="default"
                compact
                label=${methodLabel}
                title=${methodLabel}
                ?disabled=${!this.method}
                @click=${this.#onMethodClick}
            >
                <uui-icon name="icon-info"></uui-icon>
            </uui-button>
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
