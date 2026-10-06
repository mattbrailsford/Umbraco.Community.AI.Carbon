import { css, customElement, html, nothing, property, query } from "@umbraco-cms/backoffice/external/lit";
import type { PropertyValues } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import {
    CategoryScale,
    Chart,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
} from "chart.js";
import { color } from "chart.js/helpers";
import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { buildTrendChartConfig, type TrendChartColors, type TrendChartConfiguration } from "./trend-chart-config.js";
import { describeTrend } from "./trend-format.js";

// Only what a line chart with a filled band uses, so the rest of Chart.js stays out of the bundle.
Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip);

/** The part of a Chart.js chart this element uses; lets tests swap in a stand-in (a canvas is not always available). */
export interface TrendChart {
    data: TrendChartConfiguration["data"];
    options: TrendChartConfiguration["options"];
    update(): void;
    destroy(): void;
}

export type TrendChartFactory = (canvas: HTMLCanvasElement, config: TrendChartConfiguration) => TrendChart | undefined;

const createChart: TrendChartFactory = (canvas, config) => {
    const context = canvas.getContext("2d");
    return context ? new Chart(context, config) : undefined;
};

/**
 * The estimated CO2e trend: a shaded band between each bucket's min and max. Renders from the
 * `points` and `granularity` properties; it never fetches. Does nothing without points (the empty
 * page state belongs to the view). Times are shown in UTC, matching the API's buckets.
 */
@customElement("aicarbon-trend-chart")
export class AICarbonTrendChartElement extends UmbLitElement {
    @property({ type: Array })
    points?: EstimateTimeSeriesPointModel[];

    @property({ type: String })
    granularity: AiUsagePeriod = "Daily";

    /** Test seam: how the Chart.js chart is created. */
    chartFactory: TrendChartFactory = createChart;

    @query("canvas")
    private _canvas?: HTMLCanvasElement;

    #chart?: TrendChart;

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
            if (this._canvas) this.#chart = this.chartFactory(this._canvas, this.#buildConfig(this.points));
        } else if (changed.has("points") || changed.has("granularity")) {
            const config = this.#buildConfig(this.points);
            this.#chart.data = config.data;
            this.#chart.options = config.options;
            this.#chart.update();
        }
    }

    #buildConfig(points: EstimateTimeSeriesPointModel[]): TrendChartConfiguration {
        return buildTrendChartConfig(points, this.granularity, this.#resolveColors(), (unit) =>
            this.localize.termOrDefault("aiCarbon_trend_axis", "{unit} CO2e").replace("{unit}", unit),
        );
    }

    /** Resolves UUI theme variables to colours the canvas can use, so light and dark follow the backoffice theme. */
    #resolveColors(): TrendChartColors {
        const style = getComputedStyle(this);
        const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
        const line = read("--uui-color-default", "#283a97");
        return {
            line,
            fill: color(line).alpha(0.25).rgbString(),
            text: read("--uui-color-text-alt", "#68676b"),
            grid: read("--uui-color-border", "#d8d7d9"),
        };
    }

    #destroyChart() {
        this.#chart?.destroy();
        this.#chart = undefined;
    }

    override render() {
        if (!this.points || this.points.length === 0) return nothing;
        const t = (key: string, fallback: string) => this.localize.termOrDefault(key, fallback);
        const summary = describeTrend(this.points, this.granularity, t);
        return html`
            <h3>${t("aiCarbon_trend_headline", "Over time")}</h3>
            <div class="chart-container">
                <canvas role="img" aria-label=${summary}></canvas>
            </div>
        `;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
            }

            h3 {
                margin: 0 0 var(--uui-size-space-4);
            }

            .chart-container {
                position: relative;
                height: 300px;
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
