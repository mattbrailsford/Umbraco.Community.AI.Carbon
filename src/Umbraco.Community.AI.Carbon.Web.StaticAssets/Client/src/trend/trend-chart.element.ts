import { css, customElement, html, nothing, property, query } from "@umbraco-cms/backoffice/external/lit";
import type { PropertyValues } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UMB_THEME_CONTEXT } from "@umbraco-cms/backoffice/themes";
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
} from "chart.js";
import type { AiUsagePeriod, EstimateTimeSeriesPointModel } from "../api/types.gen.js";
import { buildTrendChartConfig, resolveTrendColors, type TrendChartColors, type TrendChartConfiguration } from "./trend-chart-config.js";
import { describeTrend } from "./trend-format.js";

// Only what a bar chart with a line on top uses, so the rest of Chart.js stays out of the bundle.
Chart.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Legend, Tooltip);

/** The part of a Chart.js chart this element uses; lets tests swap in a stand-in (a canvas is not always available). */
export interface TrendChart {
    data: TrendChartConfiguration["data"];
    options: TrendChartConfiguration["options"];
    update(): void;
    destroy(): void;
}

export type TrendChartFactory = (canvas: HTMLCanvasElement, config: TrendChartConfiguration) => TrendChart | undefined;

/** About 2 seconds at 60fps: how long to keep re-resolving colours after a theme change. */
const THEME_SETTLE_MAX_FRAMES = 120;
/** Consecutive unchanged frames, after at least one change, that mean the theme has finished loading. */
const THEME_SETTLE_STABLE_FRAMES = 6;

const createChart: TrendChartFactory = (canvas, config) => {
    const context = canvas.getContext("2d");
    return context ? new Chart(context, config) : undefined;
};

/**
 * The estimated CO2e trend: floating bars for each bucket's likely range (min to max) with a line through the middle estimate. Renders from the
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
    #themeAlias?: string;
    #themeFrame?: number;
    #appliedColors?: string;
    #headObserver?: MutationObserver;
    #watchedLinks = new Set<HTMLLinkElement>();

    constructor() {
        super();
        // Absent in tests (and outside the backoffice), where the chart simply keeps its first colours.
        this.consumeContext(UMB_THEME_CONTEXT, (context) => {
            if (!context) return;
            this.observe(context.theme, (alias) => this.#onThemeChanged(alias), "_observeTheme");
        });
    }

    override connectedCallback() {
        super.connectedCallback();
        this.#observeThemeStylesheets();
        // A moved or cached element had its chart destroyed on disconnect; update again to rebuild it.
        this.requestUpdate();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.#cancelThemeRefresh();
        this.#stopObservingThemeStylesheets();
        this.#themeAlias = undefined;
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
            this.#applyConfig();
        }
    }

    #buildConfig(points: EstimateTimeSeriesPointModel[]): TrendChartConfiguration {
        const colors = this.#resolveColors();
        this.#appliedColors = JSON.stringify(colors);
        return buildTrendChartConfig(points, this.granularity, colors, (unit) =>
                this.localize.termOrDefault("aiCarbon_trend_axis", "{unit} CO2e").replace("{unit}", unit),
            {
                range: this.localize.termOrDefault("aiCarbon_trend_legendRange", "Likely range"),
                middle: this.localize.termOrDefault("aiCarbon_trend_legendMiddle", "Middle estimate"),
            },
        );
    }

    /** Resolves UUI theme variables to colours the canvas can use, so light and dark follow the backoffice theme. */
    #resolveColors(): TrendChartColors {
        const style = getComputedStyle(this);
        return resolveTrendColors((name) => style.getPropertyValue(name));
    }

    /**
     * The CMS removes the old theme stylesheet at once and adds the new one later, so colours can pass through
     * an intermediate state (e.g. light between dark and high contrast). Keep re-resolving each frame for a
     * settle window, applying whenever they differ from what the chart shows, and stop early once they have
     * been stable for a few frames after a change. Slower loads are caught by the stylesheet `load` listener.
     */
    #onThemeChanged(alias: string | undefined) {
        // The first emission is the current theme, already used to build the chart.
        if (this.#themeAlias === undefined) {
            this.#themeAlias = alias;
            return;
        }
        if (alias === this.#themeAlias) return;
        this.#themeAlias = alias;
        this.#cancelThemeRefresh();
        let frames = 0;
        let stableFrames = 0;
        let changed = false;
        const tick = () => {
            this.#themeFrame = requestAnimationFrame(() => {
                frames++;
                if (this.#refreshColors()) {
                    changed = true;
                    stableFrames = 0;
                } else if (changed) {
                    stableFrames++;
                }
                if (frames >= THEME_SETTLE_MAX_FRAMES || (changed && stableFrames >= THEME_SETTLE_STABLE_FRAMES)) {
                    this.#themeFrame = undefined;
                } else {
                    tick();
                }
            });
        };
        tick();
    }

    /** Re-resolves the colours and updates the chart only if they differ from the last applied ones. */
    #refreshColors(): boolean {
        if (JSON.stringify(this.#resolveColors()) === this.#appliedColors) return false;
        this.#applyConfig();
        return true;
    }

    #cancelThemeRefresh() {
        if (this.#themeFrame !== undefined) cancelAnimationFrame(this.#themeFrame);
        this.#themeFrame = undefined;
    }

    /** Catches theme stylesheets that finish loading after the settle window. */
    #observeThemeStylesheets() {
        if (this.#headObserver) return;
        this.#headObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLLinkElement && node.rel === "stylesheet" && !this.#watchedLinks.has(node)) {
                        this.#watchedLinks.add(node);
                        node.addEventListener("load", this.#onStylesheetLoaded, { once: true });
                    }
                });
            }
        });
        this.#headObserver.observe(document.head, { childList: true });
    }

    #stopObservingThemeStylesheets() {
        this.#headObserver?.disconnect();
        this.#headObserver = undefined;
        this.#watchedLinks.forEach((link) => link.removeEventListener("load", this.#onStylesheetLoaded));
        this.#watchedLinks.clear();
    }

    #onStylesheetLoaded = (event: Event) => {
        this.#watchedLinks.delete(event.target as HTMLLinkElement);
        this.#refreshColors();
    };

    #applyConfig() {
        if (!this.#chart || !this.points || this.points.length === 0) return;
        const config = this.#buildConfig(this.points);
        this.#chart.data = config.data;
        this.#chart.options = config.options;
        this.#chart.update();
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
            <uui-box headline=${t("aiCarbon_trend_headline", "CO2e Over Time")}>
                <div class="chart-container">
                    <canvas role="img" aria-label=${summary}></canvas>
                </div>
            </uui-box>
        `;
    }

    static override styles = [
        UmbTextStyles,
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
        `,
    ];
}

export default AICarbonTrendChartElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-trend-chart": AICarbonTrendChartElement;
    }
}
