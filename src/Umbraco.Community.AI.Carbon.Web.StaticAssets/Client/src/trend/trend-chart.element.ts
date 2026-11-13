import { css, customElement, html, nothing, property, query, state } from "@umbraco-cms/backoffice/external/lit";
import type { PropertyValues } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UauiPaletteStyles, uauiFormatDateRange } from "@umbraco/analytics-ui";
import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    LinearScale,
    Legend,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
    uauiChartColors,
    uauiChartOptions,
    uauiWatchTheme,
} from "@umbraco/analytics-ui/external/chart.js";
import type { UauiChartColors } from "@umbraco/analytics-ui/external/chart.js";
import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { buildTrendChartConfig, type TrendChartConfiguration, type TrendIncomplete, type TrendTooltipModel } from "./trend-chart-config.js";
import "./trend-tooltip.element.js";
import type { AICarbonTrendTooltipElement } from "./trend-tooltip.element.js";
import { describeTrend, formatIsoDay, incompleteBucketIndex } from "./trend-format.js";

// The Chart.js copy is shared with Analytics.UI and every other product, so register only what a bar chart with a
// line on top uses (registering again is harmless) and never change Chart.defaults.
Chart.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Legend, Tooltip);

/** The part of a Chart.js chart this element uses; lets tests swap in a stand-in (a canvas is not always available). */
export interface TrendChart {
    data: TrendChartConfiguration["data"];
    options: TrendChartConfiguration["options"];
    update(): void;
    destroy(): void;
}

export type TrendChartFactory = (canvas: HTMLCanvasElement, config: TrendChartConfiguration) => TrendChart | undefined;

/** Starts following the backoffice theme for a chart; `onChange` gets the new palette. Returns a function that stops it. */
export type TrendThemeWatcher = (chart: TrendChart, onChange: (colors: UauiChartColors) => void) => () => void;

const createChart: TrendChartFactory = (canvas, config) => {
    const context = canvas.getContext("2d");
    return context ? new Chart(context, config) : undefined;
};

/**
 * The estimated CO2e trend: floating bars for each bucket's likely range (min to max) with a line through the middle estimate. Renders from the
 * `points` and `granularity` properties; it never fetches. Does nothing without points, unless `loading` (the empty
 * page state belongs to the view). Times and days are shown in the viewer's local zone (see trend-format.ts).
 * @slot header-actions - Controls for the right of the box heading, such as the method button.
 */
@customElement("aicarbon-trend-chart")
export class AICarbonTrendChartElement extends UmbLitElement {
    @property({ type: Array })
    points?: EstimateTimeSeriesPointModel[];

    @property({ type: String })
    granularity: AiUsagePeriod = "Daily";

    /** The zone Daily buckets were counted in (`UTC` when the server could not use the viewer's). Unset means the viewer's zone. */
    @property({ attribute: false })
    timeZone?: string;

    /** The compared period's points, drawn as a dashed line lined up by position. Unset draws no comparison. */
    @property({ type: Array })
    comparePoints?: EstimateTimeSeriesPointModel[];

    /**
     * The estimate is being loaded. With no points yet the box keeps its heading and height and shows a placeholder where
     * the chart goes; with points the chart stays under a loading bar.
     */
    @property({ type: Boolean })
    loading = false;

    /** Test seam: how the Chart.js chart is created. */
    chartFactory: TrendChartFactory = createChart;

    /** Test seam: how the chart follows theme changes. */
    themeWatcher: TrendThemeWatcher = (chart, onChange) =>
        uauiWatchTheme(this, chart as unknown as Chart, (colors) => onChange(colors));

    @query("canvas")
    private _canvas?: HTMLCanvasElement;

    #chart?: TrendChart;
    #stopWatchingTheme?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        // A moved or cached element had its chart destroyed on disconnect; update again to rebuild it.
        this.requestUpdate();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.#destroyChart();
    }

    override updated(changed: PropertyValues) {
        super.updated(changed);
        if (changed.has("_tooltip")) void this.#placeTooltip();
        if (!this.points || this.points.length === 0) {
            this.#destroyChart();
            return;
        }
        if (!this.#chart) {
            if (this._canvas) {
                this.#chart = this.chartFactory(this._canvas, this.#buildConfig(this.points));
                if (this.#chart) this.#stopWatchingTheme = this.themeWatcher(this.#chart, (colors) => this.#applyConfig(colors));
            }
        } else if (changed.has("points") || changed.has("granularity") || changed.has("comparePoints") || changed.has("timeZone")) {
            this.#applyConfig();
        }
    }

    /** Test seam: the current moment, which decides the incomplete bucket. */
    now: () => Date = () => new Date();

    /** The hovered bucket's tooltip, or none. */
    @state()
    private _tooltip?: TrendTooltipModel;

    @query("aicarbon-trend-tooltip")
    private _tooltipElement?: AICarbonTrendTooltipElement;

    #showTooltip = (tooltip?: TrendTooltipModel) => {
        const shown = this._tooltip;
        // Chart.js calls this on every pointer move; only a different tooltip needs a redraw (a data refresh can change the figures under the same bucket).
        if (shown && tooltip && JSON.stringify(shown) === JSON.stringify(tooltip)) return;
        this._tooltip = tooltip;
    };

    /** Puts the tooltip beside the hovered bucket, on the side with room, kept inside the chart (as Analytics.UI's chart does). */
    async #placeTooltip() {
        const tip = this._tooltipElement;
        const canvas = this._canvas;
        const tooltip = this._tooltip;
        if (!tip || !canvas || !tooltip) return;
        await tip.updateComplete;
        if (this._tooltip !== tooltip || !tip.isConnected) return;
        const container = tip.offsetParent as HTMLElement | null;
        if (!container) return;
        const gap = 14;
        const { offsetWidth: width, offsetHeight: height } = tip;
        const x = canvas.offsetLeft + tooltip.x;
        const y = canvas.offsetTop + tooltip.y;
        const left = x + gap + width > container.clientWidth ? x - gap - width : x + gap;
        tip.style.left = `${Math.max(left, 0)}px`;
        tip.style.top = `${Math.min(Math.max(y - height - 8, 0), Math.max(container.clientHeight - height, 0))}px`;
        tip.style.visibility = "visible";
    }

    #incomplete(points: EstimateTimeSeriesPointModel[]): TrendIncomplete | undefined {
        const from = incompleteBucketIndex(
            points.map((p) => p.timestamp),
            this.granularity,
            this.now(),
            this.timeZone,
        );
        if (from === undefined) return undefined;
        const hourly = this.granularity === "Hourly";
        // The same wording as the Usage chart: "(incomplete)", and at hour level "(now, incomplete)" for the hour that is now, where it also draws the now line.
        return {
            from,
            title: (title, isNow) =>
                isNow
                    ? (this.localize.termOrDefault("uauiAnalytics_chartNowIncompleteDate", null, title) ?? `${title} (now, incomplete)`)
                    : (this.localize.termOrDefault("uauiAnalytics_chartIncompleteDate", null, title) ?? `${title} (incomplete)`),
            nowLabel: hourly ? this.localize.termOrDefault("uauiAnalytics_chartNow", "Now") : undefined,
        };
    }

    /** The compared period's date range, as the Usage chart labels its comparison ("Oct 31, 2026 to Nov 6, 2026"). */
    #comparisonLabel(points: EstimateTimeSeriesPointModel[]): string {
        const shown = (this.comparePoints ?? []).slice(0, points.length);
        if (shown.length === 0) return this.localize.termOrDefault("aiCarbon_trend_legendComparison", "Comparison");
        const zone = this.granularity === "Daily" ? this.timeZone : undefined;
        return uauiFormatDateRange(this.localize, { from: formatIsoDay(shown[0].timestamp, zone), to: formatIsoDay(shown[shown.length - 1].timestamp, zone) });
    }

    #buildConfig(points: EstimateTimeSeriesPointModel[], colors: UauiChartColors = uauiChartColors(this)): TrendChartConfiguration {
        return buildTrendChartConfig(
            points,
            this.granularity,
            colors,
            uauiChartOptions(this, "bar", colors),
            {
                yAxisTitle: (unit) => this.localize.termOrDefault("aiCarbon_trend_axis", "{unit} CO2e").replace("{unit}", unit),
                legendLabels: {
                    range: this.localize.termOrDefault("aiCarbon_trend_legendRange", "Likely range"),
                    middle: this.localize.termOrDefault("aiCarbon_trend_legendMiddle", "Middle estimate"),
                    comparison: this.#comparisonLabel(points),
                },
                comparePoints: this.comparePoints,
                dayTimeZone: this.timeZone,
                incomplete: this.#incomplete(points),
                onTooltip: this.#showTooltip,
            },
        );
    }

    #applyConfig(colors?: UauiChartColors) {
        if (!this.#chart || !this.points || this.points.length === 0) return;
        const config = this.#buildConfig(this.points, colors);
        this.#chart.data = config.data;
        this.#chart.options = config.options;
        // On a theme change uauiWatchTheme calls update() itself, right after this.
        if (!colors) this.#chart.update();
    }

    #destroyChart() {
        // chart.destroy() does not tell the tooltip handler, so a hovered tooltip would outlive the chart.
        this._tooltip = undefined;
        this.#stopWatchingTheme?.();
        this.#stopWatchingTheme = undefined;
        this.#chart?.destroy();
        this.#chart = undefined;
    }

    override render() {
        const hasPoints = !!this.points && this.points.length > 0;
        if (!hasPoints && !this.loading) return nothing;
        const t = (key: string, fallback: string) => this.localize.termOrDefault(key, fallback);
        return html`
            <uui-box headline=${t("aiCarbon_trend_headline", "Estimated CO2e Over Time")} headline-variant="h3">
                <slot name="header-actions" slot="header-actions"></slot>
                <div class="chart-container" aria-busy=${this.loading ? "true" : "false"}>
                    ${hasPoints && this.loading ? html`<uui-loader-bar></uui-loader-bar>` : nothing}
                    ${hasPoints && this._tooltip
                        ? html`<aicarbon-trend-tooltip style="visibility:hidden" aria-hidden="true" .model=${this._tooltip}></aicarbon-trend-tooltip>`
                        : nothing}
                    ${hasPoints
                        ? html`<canvas role="img" aria-label=${describeTrend(this.points!, this.granularity, t, this.comparePoints, this.timeZone)}></canvas>`
                        : html`<div class="skeleton" aria-hidden="true"></div>`}
                </div>
            </uui-box>
        `;
    }

    static override styles = [
        UmbTextStyles,
        // The chart colours are read from the palette tokens this defines.
        UauiPaletteStyles,
        css`
            :host {
                display: block;
            }

            /* Same chart sizing as Umbraco.AI's Usage chart box. */
            .chart-container {
                position: relative;
                height: 350px;
                padding: 0 var(--uui-size-space-4);
            }

            uui-loader-bar {
                position: absolute;
                inset: 0 0 auto 0;
            }

            /* The same grey shimmer block Analytics.UI draws for its own charts, at the chart's height. */
            .skeleton {
                height: 100%;
                border-radius: var(--uui-border-radius);
                background-color: var(--uaui-color-tint-neutral);
                background-image: linear-gradient(
                    90deg,
                    transparent 0%,
                    color-mix(in srgb, var(--uui-color-surface) 55%, transparent) 50%,
                    transparent 100%
                );
                background-size: 800px 100%;
                background-repeat: no-repeat;
                animation: shimmer 1.2s linear infinite;
            }

            @keyframes shimmer {
                from {
                    background-position: -800px 0;
                }
                to {
                    background-position: 800px 0;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .skeleton {
                    animation: none;
                    background-image: none;
                }
            }
        `,
    ];
}

export default AICarbonTrendChartElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-trend-chart": AICarbonTrendChartElement;
    }
}
