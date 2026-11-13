import { describe, expect, it } from "vitest";
import { UAUI_TABLE_CELL } from "@umbraco/analytics-ui";
import { Chart, uauiChartColors } from "@umbraco/analytics-ui/external/chart.js";

// Guards the vitest.config.ts aliases: without them the imports fail, as the npm package has no runtime JS.
describe("analytics-ui test aliases", () => {
    it("resolves @umbraco/analytics-ui to the local stub", () => {
        expect(UAUI_TABLE_CELL.text).toBe("uaui-text-cell");
    });

    it("resolves @umbraco/analytics-ui/external/chart.js to the local stub", () => {
        expect(typeof Chart.register).toBe("function");
        expect(uauiChartColors(document.body).series).toHaveLength(8);
    });
});
