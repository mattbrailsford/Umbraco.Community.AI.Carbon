import { afterEach, describe, expect, it } from "vitest";
import { AICarbonMissingTextCellElement } from "./missing-text-cell.element.js";

async function render(value: unknown) {
    const element = new AICarbonMissingTextCellElement();
    element.value = value;
    document.body.appendChild(element);
    await element.updateComplete;
    return element.shadowRoot!.textContent!.trim();
}

describe("Feature: aicarbon-missing-text-cell element", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("shows the text", async () => {
        expect(await render("USA")).toBe("USA");
    });

    it.each([undefined, null, ""])("shows an em dash for %s", async (value) => {
        expect(await render(value)).toBe("—");
    });

    it("renders text, not markup", async () => {
        const element = new AICarbonMissingTextCellElement();
        element.value = "<img src=x onerror=alert(1)>";
        document.body.appendChild(element);
        await element.updateComplete;
        expect(element.shadowRoot!.querySelector("img")).toBeNull();
    });

    it("draws the table's skeleton cell, on the column's side, while the table is loading", async () => {
        const element = new AICarbonMissingTextCellElement();
        element.column = { key: "zone", label: "", align: "end" };
        element.loading = true;
        document.body.appendChild(element);
        await element.updateComplete;
        const skeleton = element.shadowRoot!.querySelector("uaui-table-skeleton-cell")!;
        expect(skeleton.getAttribute("align")).toBe("end");
        expect(element.shadowRoot!.textContent).not.toContain("—");
    });
});
