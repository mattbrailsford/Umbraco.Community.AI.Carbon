import { css, customElement, html, nothing, property } from "@umbraco-cms/backoffice/external/lit";
import type { CSSResultGroup } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UauiPaletteStyles } from "@umbraco/analytics-ui";
import type { TrendTooltipModel } from "./trend-chart-config.js";

/**
 * The hover tooltip of the trend chart. Local to the trend chart (not exported). Its look and layout are copied from
 * Analytics.UI's internal `chart-tooltip.element.ts` and `chart-tooltip-surface.css.ts`, which are not exported, so
 * it reads like the Usage chart's: dark in every theme, bold values with muted labels, small rounded swatches, a
 * divider before the comparison, and the comparison's change badge with its own date underneath.
 * The chart places it (it has no position of its own) and it is hidden from assistive technology: the canvas carries the text summary.
 */
@customElement("aicarbon-trend-tooltip")
export class AICarbonTrendTooltipElement extends UmbLitElement {
    @property({ attribute: false })
    model?: TrendTooltipModel;

    #likely(range: string) {
        return this.localize.termOrDefault("aiCarbon_card_range", "Likely {range}").replace("{range}", () => range);
    }

    override render() {
        const model = this.model;
        if (!model) return nothing;
        const { middle, compare } = model;
        return html`<div class="tooltip-date">${model.heading}</div>
            <div class="tooltip-row">
                <span class="swatch swatch-square"></span>
                <span class="tooltip-value">${middle.text}</span>
                <span class="tooltip-label">${this.localize.termOrDefault("aiCarbon_trend_legendMiddle", "Middle estimate")}</span>
            </div>
            ${middle.range ? html`<div class="tooltip-sub">${this.#likely(middle.range)}</div>` : nothing}
            ${compare
                ? html`<div class="tooltip-compare">
                      <div class="tooltip-row">
                          <span class="swatch swatch-compare"></span>
                          <span class="tooltip-value">${compare.text}</span>
                          <!-- A fall in CO2e is good. The change is between the two middle estimates. -->
                          <uaui-delta-badge size="sm" .current=${compare.current} .previous=${compare.previous} .lowerIsBetter=${true}></uaui-delta-badge>
                      </div>
                      <div class="tooltip-sub">${compare.date}</div>
                      ${compare.range ? html`<div class="tooltip-sub">${this.#likely(compare.range)}</div>` : nothing}
                  </div>`
                : nothing}`;
    }

    // Adapted from Umbraco.Analytics.UI's chart-tooltip-surface.css.ts and chart-tooltip.element.ts.
    static override styles: CSSResultGroup = [
        UauiPaletteStyles,
        css`
            :host {
                position: absolute;
                z-index: 2;
                display: block;
                box-sizing: border-box;
                min-width: 96px;
                max-width: 260px;
                padding: var(--uui-size-space-2) var(--uui-size-space-3);
                border: 1px solid color-mix(in srgb, var(--uui-palette-white) 18%, transparent);
                border-radius: var(--uui-border-radius);
                background: var(--uui-palette-space-cadet);
                box-shadow: var(--uui-shadow-depth-3);
                color: var(--uui-palette-white);
                color-scheme: dark;
                font-size: 12px;
                pointer-events: none;
            }

            .tooltip-date {
                margin-bottom: 2px;
                font-size: 11px;
                font-weight: 700;
                color: var(--uui-palette-spanish-pink);
            }

            .tooltip-row {
                display: flex;
                align-items: center;
                gap: var(--uui-size-space-2);
                line-height: 1.6;
            }

            .swatch {
                flex: none;
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }

            .swatch-square {
                border-radius: 2px;
                background: var(--uaui-color-bar-default);
            }

            /* A short dashed line, as the comparison is drawn on the chart. */
            .swatch-compare {
                height: 2px;
                border-radius: 0;
                background: repeating-linear-gradient(90deg, var(--uaui-color-compare) 0 3px, transparent 3px 5px);
            }

            .tooltip-value {
                font-size: 13px;
                font-weight: 700;
                white-space: nowrap;
            }

            .tooltip-label {
                min-width: 0;
                overflow-wrap: anywhere;
                color: color-mix(in srgb, var(--uui-palette-white) 82%, transparent);
            }

            /* Indented under the value, past the swatch and its gap. */
            .tooltip-sub {
                margin: -2px 0 2px calc(8px + var(--uui-size-space-2));
                font-size: 11px;
                white-space: nowrap;
                color: color-mix(in srgb, var(--uui-palette-white) 70%, transparent);
            }

            /* A hairline above the comparison, as the Usage tooltip draws before its total. */
            .tooltip-compare {
                margin-top: 4px;
                padding-top: 4px;
                border-top: 1px solid color-mix(in srgb, var(--uui-palette-white) 18%, transparent);
            }

            /* The tooltip is dark in every theme: the badge reads its dark branch and ignores product overrides here.
               The tints are 15%: jungle green on a 20% tint of itself over space cadet is 4.47:1, under 4.5:1. */
            uaui-delta-badge {
                margin-left: auto;
                white-space: nowrap;
                --_uaui-tooltip-tint: 15%;
                --uui-color-scheme: dark;
                --uaui-text-positive: initial;
                --uaui-text-negative: initial;
                --uaui-text-neutral: var(--uui-palette-white);
                --uaui-tint-positive: color-mix(in srgb, var(--uui-palette-jungle-green) var(--_uaui-tooltip-tint), transparent);
                --uaui-tint-negative: color-mix(in srgb, var(--uui-palette-spanish-pink) var(--_uaui-tooltip-tint), transparent);
                --uaui-tint-neutral: color-mix(in srgb, var(--uui-palette-white) var(--_uaui-tooltip-tint), transparent);
            }
        `,
    ];
}

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-trend-tooltip": AICarbonTrendTooltipElement;
    }
}
