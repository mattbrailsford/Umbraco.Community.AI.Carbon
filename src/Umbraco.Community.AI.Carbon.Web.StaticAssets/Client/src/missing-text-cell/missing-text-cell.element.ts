import { customElement, html, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import type { UauiTableCellElement, UauiTableColumn } from "@umbraco/analytics-ui";
import { NO_VALUE } from "../estimate/no-value.js";
import { MISSING_TEXT_CELL } from "./missing-text-cell.name.js";

/**
 * A plain text cell that shows "—" when the row has no value. The row keeps the value undefined, so the
 * table sorts it last in both directions (the built-in text cell would show nothing).
 */
@customElement(MISSING_TEXT_CELL)
export class AICarbonMissingTextCellElement extends UmbLitElement implements UauiTableCellElement {
    @property({ attribute: false })
    column: UauiTableColumn = { key: "value", label: "" };

    @property({ attribute: false })
    item: Record<string, unknown> = {};

    @property({ attribute: false })
    value: unknown;

    override render() {
        return html`${typeof this.value === "string" && this.value !== "" ? this.value : NO_VALUE}`;
    }
}

export default AICarbonMissingTextCellElement;

declare global {
    interface HTMLElementTagNameMap {
        [MISSING_TEXT_CELL]: AICarbonMissingTextCellElement;
    }
}
