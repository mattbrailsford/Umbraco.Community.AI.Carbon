import { css, customElement, html, nothing, property, query } from "@umbraco-cms/backoffice/external/lit";
import type { PropertyValues } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UauiPaletteStyles } from "@umbraco/analytics-ui";
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
import { buildTrendChartConfig, type TrendChartConfiguration } from "./trend-chart-config.js";
import { describeTrend } from "./trend-format.js";

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

    #buildConfig(points: EstimateTimeSeriesPointModel[], colors: UauiChartColors = uauiChartColors(this)): TrendChartConfiguration {
        return buildTrendChartConfig(
            points,
            this.granularity,
            colors,
            uauiChartOptions(this, "bar", colors),
            (unit) => this.localize.termOrDefault("aiCarbon_trend_axis", "{unit} CO2e").replace("{unit}", unit),
            {
                range: this.localize.termOrDefault("aiCarbon_trend_legendRange", "Likely range"),
                middle: this.localize.termOrDefault("aiCarbon_trend_legendMiddle", "Middle estimate"),
                comparison: this.localize.termOrDefault("aiCarbon_trend_legendComparison", "Comparison"),
            },
            this.comparePoints,
            this.timeZone,
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
            <uui-box headline=${t("aiCarbon_trend_headline", "Estimated CO2e Over Time")}>
                <div class="chart-container" aria-busy=${this.loading ? "true" : "false"}>
                    ${hasPoints && this.loading ? html`<uui-loader-bar></uui-loader-bar>` : nothing}
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
