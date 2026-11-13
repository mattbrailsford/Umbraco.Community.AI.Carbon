import { afterEach, describe, expect, it } from "vitest";
import { AICarbonCo2eCellElement, type Co2eCellItem } from "./co2e-cell.element.js";
import type { Co2eColumnOptions } from "./co2e-cell.name.js";

async function render(item: Co2eCellItem, column?: Co2eColumnOptions) {
    const element = new AICarbonCo2eCellElement();
    if (column) element.column = { key: "co2eMid", label: "", ...column };
    element.item = item as Record<string, unknown>;
    document.body.appendChild(element);
    await element.updateComplete;
    return element.shadowRoot!;
}

describe("Feature: aicarbon-co2e-cell element", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("shows an estimated row's central figure with its range on a second line", async () => {
        const root = await render({ status: "Estimated", co2e: "≈ 60 g CO2e", co2eRange: "48–72 g CO2e" });
        expect([root.querySelector(".central")!.textContent, root.querySelector(".range")!.textContent]).toEqual([
            "≈ 60 g CO2e",
            "48–72 g CO2e",
        ]);
    });

    it("treats a row with no status as estimated, and shows no range line when there is none", async () => {
        const root = await render({ co2e: "3 g CO2e", co2eRange: "" });
        expect(root.querySelector(".central")!.textContent).toBe("3 g CO2e");
        expect(root.querySelector(".range")).toBeNull();
        expect(root.querySelector(".not-estimated")).toBeNull();
    });

    it.each([
        ["UnknownModel", "Unknown model — EcoLogits doesn't know this model."],
        ["UnsupportedCapability", "Not supported — only chat (text generation) is estimated."],
    ] as const)("shows %s rows as Not estimated with the reason as tooltip and assistive text", async (status, reason) => {
        const root = await render({ status, co2e: "—", co2eRange: "" });
        const label = root.querySelector(".not-estimated")!;
        expect(label.textContent!.trim()).toBe("Not estimated");
        expect(label.getAttribute("title")).toBe(reason);
        expect(root.querySelector(".sr-only")!.textContent).toBe(reason);
        expect(root.querySelector(".central")).toBeNull();
    });

    it("shows a warning icon with plain-English text only for a row with warnings", async () => {
        const without = await render({ status: "Estimated", co2e: "1 g CO2e", co2eRange: "" });
        expect(without.querySelector(".warnings")).toBeNull();
        document.body.innerHTML = "";
        const withWarning = await render({
            status: "Estimated",
            co2e: "1 g CO2e",
            co2eRange: "",
            warnings: ["model-arch-not-released"],
        });
        expect(withWarning.querySelector(".warnings")!.getAttribute("title")).toMatch(/size isn.t published.*wide/i);
    });

    it("keeps the warning icon on a row that is not estimated", async () => {
        const root = await render({ status: "UnknownModel", warnings: ["invalid-model-data"] });
        expect(root.querySelector(".warnings")).not.toBeNull();
    });

    it("renders figures as text, not markup", async () => {
        const root = await render({ status: "Estimated", co2e: "<img src=x onerror=alert(1)>", co2eRange: "" });
        expect(root.querySelector("img")).toBeNull();
    });

    it("gives screen readers a link word before the range, and hides the bare range from them", async () => {
        const root = await render({ status: "Estimated", co2e: "≈ 60 g CO2e", co2eRange: "48–72 g CO2e" });
        expect(root.querySelector(".sr-only")!.textContent).toBe("Likely 48–72 g CO2e");
        expect(root.querySelector(".range")!.getAttribute("aria-hidden")).toBe("true");
    });

    it("reserves the warning icon's space in every row when the column asks for it, so figures share a right edge", async () => {
        const root = await render({ status: "Estimated", co2e: "1 g CO2e", co2eRange: "" }, { reserveWarningSpace: true });
        expect(root.querySelectorAll(".warnings-slot")).toHaveLength(1);
        expect(root.querySelector(".warnings")).toBeNull();
        document.body.innerHTML = "";
        const notEstimated = await render({ status: "UnknownModel" }, { reserveWarningSpace: true });
        expect(notEstimated.querySelectorAll(".warnings-slot")).toHaveLength(1);
        document.body.innerHTML = "";
        const withWarning = await render(
            { status: "Estimated", co2e: "1 g CO2e", co2eRange: "", warnings: ["model-arch-not-released"] },
            { reserveWarningSpace: true },
        );
        expect(withWarning.querySelector(".warnings-slot .warnings")).not.toBeNull();
    });

    it("reserves no space when the column does not ask for it", async () => {
        const root = await render({ status: "Estimated", co2e: "1 g CO2e", co2eRange: "" });
        expect(root.querySelector(".warnings-slot")).toBeNull();
    });

    describe("Scenario: the table is loading", () => {
        async function renderLoading(align?: "end") {
            const element = new AICarbonCo2eCellElement();
            if (align) element.column = { key: "co2eMid", label: "", align };
            element.loading = true;
            document.body.appendChild(element);
            await element.updateComplete;
            return element.shadowRoot!;
        }

        it("draws the table's two-line skeleton cell, on the column's side, instead of a figure", async () => {
            const root = await renderLoading("end");
            const skeleton = root.querySelector("uaui-table-skeleton-cell")!;
            expect([skeleton.getAttribute("align"), skeleton.getAttribute("lines")]).toEqual(["end", "2"]);
            expect(root.querySelector(".central, .not-estimated")).toBeNull();
        });

        it("draws the figure again once loading stops", async () => {
            const element = new AICarbonCo2eCellElement();
            element.loading = true;
            element.item = { co2e: "3 g CO2e" };
            document.body.appendChild(element);
            await element.updateComplete;
            element.loading = false;
            await element.updateComplete;
            expect(element.shadowRoot!.querySelector("uaui-table-skeleton-cell")).toBeNull();
            expect(element.shadowRoot!.querySelector(".central")!.textContent).toBe("3 g CO2e");
        });
    });
});
