// Vitest stand-in for "@umbraco/analytics-ui/external/chart.js" (types only on npm; see analytics-ui.stub.ts).
// Chart and the registerables are inert fakes: no canvas is needed, and nothing is drawn.
import type * as Real from "@umbraco/analytics-ui/external/chart.js";

export class Chart {
    static register(..._items: unknown[]): void {}
    update(): void {}
    destroy(): void {}
}

export class BarController {}
export class BarElement {}
export class LineController {}
export class LineElement {}
export class PointElement {}
export class CategoryScale {}
export class LinearScale {}
export class Legend {}
export class Tooltip {}

// Distinct, recognisable values so tests can tell which palette slot a chart used.
const shades = (name: string) => ({ line: `${name}-line`, fill: `${name}-fill`, bar: `${name}-bar` });

export const stubColors: ReturnType<typeof Real.uauiChartColors> = {
    compare: "compare",
    compareBar: "compare-bar",
    fontFamily: "font",
    grid: "grid",
    // Slot 1's bar is a real rgb() so the tests can check the alpha we derive from it.
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => (slot === 1 ? { ...shades("series-1"), bar: "rgb(10, 20, 30)" } : shades(`series-${slot}`))),
    status: {
        default: shades("default"),
        positive: shades("positive"),
        warning: shades("warning"),
        danger: shades("danger"),
    },
    surface: "surface",
    text: "text",
};

export const uauiChartColors: typeof Real.uauiChartColors = () => stubColors;
// A cut-down look: the keys our chart builds on (axis ticks, legend labels) with a marker the tests can check survives.
export const uauiChartOptions: typeof Real.uauiChartOptions = () =>
    ({
        plugins: { legend: { display: false, labels: { color: "text" } }, tooltip: { titleFont: { family: "font" } } },
        scales: { x: { grid: { display: false }, ticks: { color: "text" } }, y: { grid: { color: "grid" }, ticks: { color: "text" } } },
    }) as never;
export const uauiWatchTheme: typeof Real.uauiWatchTheme = () => () => {};
