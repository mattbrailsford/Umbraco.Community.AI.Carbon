import { css, customElement, html, nothing, property, state, type PropertyValues } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
// Loads Analytics.UI at runtime, which registers `uaui-data-table` and `uaui-search-field`.
import "@umbraco/analytics-ui";
import type { UauiTableColumn } from "@umbraco/analytics-ui";
import type { EstimateModelRowModel } from "../api/types.gen.js";
import "../co2e-cell/index.js";
import "../missing-text-cell/index.js";
import {
    buildModelColumns,
    buildModelCompareRows,
    buildModelRows,
    MODEL_ROW_KEY,
    MODEL_TABLE_DEFAULT_SORT,
    type ModelRowViewModel,
} from "./model-table-model.js";

/**
 * The "By Model" table. Renders from the `rows` property; it never fetches. The table sorts, searches and
 * pages the rows itself.
 * Renders nothing when there are no rows and nothing is loading: the empty page state belongs to the view, and a
 * second "no models" line here would repeat it. While loading it always renders, so the page keeps its shape.
 */
@customElement("aicarbon-model-table")
export class AICarbonModelTableElement extends UmbLitElement {
    @property({ type: Array })
    rows?: EstimateModelRowModel[];

    /** The compared period's rows. A row with a match (same provider, model and usage) shows a change badge on its CO2e figure. */
    @property({ type: Array })
    compareRows?: EstimateModelRowModel[];

    /** The estimate is being loaded: with no rows yet the table draws skeleton rows, with rows it keeps them under a loading bar. */
    @property({ type: Boolean })
    loading = false;

    // The table needs stable arrays: it starts over when it is handed a new one. Rows change with the input,
    // columns with the input or the labels (the language changed, or translations loaded after first paint).
    @state()
    private _columns: UauiTableColumn[] = [];

    @state()
    private _tableRows: ModelRowViewModel[] = [];

    @state()
    private _compareTableRows: ReturnType<typeof buildModelCompareRows> = [];

    #labels = "";

    protected override willUpdate(changed: PropertyValues<this>) {
        super.willUpdate(changed);
        if (changed.has("rows")) this._tableRows = buildModelRows(this.rows ?? []);
        if (changed.has("compareRows")) this._compareTableRows = buildModelCompareRows(this.compareRows ?? []);
        const columns = buildModelColumns((key, fallback) => this.localize.termOrDefault(key, fallback));
        const labels = JSON.stringify(columns.map((column) => column.label));
        if (labels !== this.#labels) {
            this.#labels = labels;
            this._columns = columns;
        }
    }

    override render() {
        if (this._tableRows.length === 0 && !this.loading) return nothing;
        const headline = this.localize.termOrDefault("aiCarbon_byModel_headline", "By Model");
        return html`
            <uui-box class="flush" headline=${headline}>
                <uaui-data-table
                    label=${headline}
                    .rowKey=${MODEL_ROW_KEY}
                    .columns=${this._columns}
                    .rows=${this._tableRows}
                    .compareRows=${this._compareTableRows}
                    .sort=${MODEL_TABLE_DEFAULT_SORT}
                    ?loading=${this.loading}
                >
                    <div slot="toolbar"><uaui-search-field></uaui-search-field></div>
                </uaui-data-table>
            </uui-box>
        `;
    }

    static override styles = [
        UmbTextStyles,
        css`
            :host {
                display: block;
            }

            /* The table runs edge to edge inside the box, as Umbraco.AI's usage tables do. */
            uui-box.flush {
                --uui-box-default-padding: 0;
            }
        `,
    ];
}

export default AICarbonModelTableElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-model-table": AICarbonModelTableElement;
    }
}
