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

const colors: ReturnType<typeof Real.uauiChartColors> = {
    compare: "",
    compareBar: "",
    fontFamily: "",
    grid: "",
    series: [],
    status: {
        default: { line: "", fill: "", bar: "" },
        positive: { line: "", fill: "", bar: "" },
        warning: { line: "", fill: "", bar: "" },
        danger: { line: "", fill: "", bar: "" },
    },
    surface: "",
    text: "",
};

export const uauiChartColors: typeof Real.uauiChartColors = () => colors;
export const uauiChartOptions: typeof Real.uauiChartOptions = () => ({}) as never;
export const uauiWatchTheme: typeof Real.uauiWatchTheme = () => () => {};
