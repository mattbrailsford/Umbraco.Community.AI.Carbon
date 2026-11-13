import type { Plugin } from "@umbraco/analytics-ui/external/chart.js";

/*
 * Adapted from Umbraco.Analytics.UI's internal `incomplete-plugin.ts` (hatch) and `now-plugin.ts` (now line), which
 * are not exported. Local to this chart: pass it in the chart's own `plugins`, never register it globally, since the
 * Chart.js copy is shared with other products. It reads its settings from the chart's options, so a rebuilt
 * config (new data, new theme) reaches it without recreating the plugin.
 */

export const INCOMPLETE_PLUGIN_ID = "aicarbonIncomplete";

/** Where the now line goes. */
export interface IncompleteNow {
    index: number;
    label: string;
    color: string;
    fontFamily: string;
}

/** The plugin's options, set on `options.plugins.aicarbonIncomplete`. */
export interface IncompleteOptions {
    /** The first incomplete bucket: it and every bucket after are hatched. None draws nothing. */
    from?: number;
    /** The hatch stripe colour (a canvas colour, not a CSS variable). */
    hatch?: string;
    now?: IncompleteNow;
}

declare module "chart.js" {
    interface PluginOptionsByType<TType> {
        aicarbonIncomplete?: IncompleteOptions;
    }
}

/** One tile of the hatch, in CSS pixels. */
const TILE = 8;

/** A diagonal hatch tile in `color`, drawn at `ratio` device pixels per CSS pixel so it stays sharp. */
function hatchPattern(ctx: CanvasRenderingContext2D, color: string, ratio: number): CanvasPattern | null {
    const tile = document.createElement("canvas");
    tile.width = tile.height = Math.round(TILE * ratio);
    const g = tile.getContext("2d");
    if (!g) return null;
    g.scale(ratio, ratio);
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    // The diagonal, plus its two corners so the stripes join across tiles.
    g.moveTo(0, TILE);
    g.lineTo(TILE, 0);
    g.moveTo(-2, 2);
    g.lineTo(2, -2);
    g.moveTo(TILE - 2, TILE + 2);
    g.lineTo(TILE + 2, TILE - 2);
    g.stroke();
    const pattern = ctx.createPattern(tile, "repeat");
    pattern?.setTransform(new DOMMatrix().scale(1 / ratio));
    return pattern;
}

/** Hatches the plot from the first incomplete bucket's slot to the right edge, behind the series, and draws the now line when asked. */
export function createIncompletePlugin(): Plugin<"bar" | "line"> {
    let tile: { color: string; ratio: number; pattern: CanvasPattern | null } | undefined;
    return {
        id: INCOMPLETE_PLUGIN_ID,
        beforeDraw: (chart, _args, options: IncompleteOptions) => {
            const { from, hatch } = options;
            const count = chart.data.labels?.length ?? 0;
            if (from === undefined || !hatch || from >= count) return;
            const { ctx, chartArea } = chart;
            // Bars sit in slots of equal width across the plot.
            const left = Math.max(chartArea.left, chart.scales["x"].getPixelForValue(from) - chartArea.width / count / 2);
            const right = chartArea.right;
            if (!Number.isFinite(left) || right <= left) return;

            const ratio = chart.currentDevicePixelRatio || 1;
            if (!tile || tile.color !== hatch || tile.ratio !== ratio) tile = { color: hatch, ratio, pattern: hatchPattern(ctx, hatch, ratio) };
            if (!tile.pattern) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
            ctx.clip();
            ctx.fillStyle = tile.pattern;
            ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
            ctx.restore();
        },
        // Behind the series, above the hatch.
        beforeDatasetsDraw: (chart, _args, options: IncompleteOptions) => {
            const now = options.now;
            if (!now) return;
            const x = chart.scales["x"].getPixelForValue(now.index);
            if (!Number.isFinite(x)) return;
            const { ctx, chartArea } = chart;
            ctx.save();
            ctx.strokeStyle = now.color;
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.beginPath();
            const crisp = Math.round(x) + 0.5;
            ctx.moveTo(crisp, chartArea.top);
            ctx.lineTo(crisp, chartArea.bottom);
            ctx.stroke();
            ctx.fillStyle = now.color;
            ctx.font = `700 11px ${now.fontFamily}`;
            ctx.textBaseline = "bottom";
            ctx.textAlign = "center";
            const half = ctx.measureText(now.label).width / 2;
            ctx.fillText(now.label, Math.min(Math.max(x, half + 1), chart.width - half - 1), chartArea.top - 3);
            ctx.restore();
        },
    };
}
