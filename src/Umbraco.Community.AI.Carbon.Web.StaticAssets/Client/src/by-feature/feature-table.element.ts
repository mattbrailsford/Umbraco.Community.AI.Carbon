import { css, customElement, html, nothing, property, state, type PropertyValues } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
// Loads Analytics.UI at runtime, which registers `uaui-data-table`.
import "@umbraco/analytics-ui";
import type { UauiTableColumn } from "@umbraco/analytics-ui";
import type { EstimateFeatureBreakdownModel } from "../api/types.gen.js";
import "../co2e-cell/index.js";
import {
    buildFeatureColumns,
    buildFeatureRows,
    FEATURE_TABLE_DEFAULT_SORT,
    withFeatureNames,
    type FeatureRowViewModel,
} from "./feature-table-model.js";

/** One shared empty list, so an unavailable breakdown doesn't look like new data on every update. */
const NO_ITEMS: EstimateFeatureBreakdownModel["items"] = [];

/**
 * The "By Feature" table. Renders from the `byFeature` property; it never fetches. The table sorts the rows
 * itself. There is no search field: the table has about five rows.
 * - Analytics switched off (or not known yet): renders nothing, because the whole-view message (T19) covers it.
 * - Breakdown unavailable (analytics on): the table's empty state, pointing at the Umbraco.AI setting.
 * - Available but no items: renders nothing (all usage is from models that aren't estimated).
 * There is deliberately no share-of-total column: a percentage of a range would imply precision the
 * estimate doesn't have.
 */
@customElement("aicarbon-feature-table")
export class AICarbonFeatureTableElement extends UmbLitElement {
    @property({ attribute: false })
    byFeature?: EstimateFeatureBreakdownModel;

    /** From the estimate's method info. Unknown (not loaded yet) renders nothing. */
    @property({ attribute: false })
    analyticsEnabled?: boolean;

    // The table needs stable arrays: it starts over when it is handed a new one. They are rebuilt with the
    // input, or when the labels or feature names change (the language changed, or translations loaded after first paint).
    @state()
    private _columns: UauiTableColumn[] = [];

    @state()
    private _tableRows: FeatureRowViewModel[] = [];

    #labels = "";
    #names = "";
    #items?: readonly unknown[];

    #t = (key: string, fallback: string) => this.localize.termOrDefault(key, fallback);

    protected override willUpdate(changed: PropertyValues<this>) {
        super.willUpdate(changed);
        const columns = buildFeatureColumns(this.#t);
        const labels = JSON.stringify(columns.map((column) => column.label));
        if (labels !== this.#labels) {
            this.#labels = labels;
            this._columns = columns;
        }
        const items = this.byFeature?.available ? this.byFeature.items : NO_ITEMS;
        const rows = withFeatureNames(buildFeatureRows(items), this.#t);
        const names = JSON.stringify(rows.map((row) => row.feature));
        if (items !== this.#items || names !== this.#names) {
            this.#items = items;
            this.#names = names;
            this._tableRows = rows;
        }
    }

    override render() {
        // Switched off (or not known yet) is the whole-view message's job; the breakdown being available with no
        // items means all usage is from models that aren't estimated, which the By Model table shows.
        if (!this.analyticsEnabled || !this.byFeature) return nothing;
        if (this.byFeature.available && this.byFeature.items.length === 0) return nothing;
        const headline = this.#t("aiCarbon_byFeature_headline", "By Feature");
        return html`
            <uui-box class="flush" headline=${headline}>
                <uaui-data-table
                    label=${headline}
                    row-key="key"
                    empty-headline=${this.#t(
                        "aiCarbon_byFeature_switchedOff",
                        "Feature breakdown is switched off in Umbraco.AI analytics settings.",
                    )}
                    empty-description=${this.#t(
                        "aiCarbon_byFeature_switchedOffHint",
                        "Turn on the feature type breakdown in the Umbraco.AI analytics settings to see this.",
                    )}
                    .columns=${this._columns}
                    .rows=${this._tableRows}
                    .sort=${FEATURE_TABLE_DEFAULT_SORT}
                ></uaui-data-table>
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

export default AICarbonFeatureTableElement;

declare global {
    interface HTMLElementTagNameMap {
        "aicarbon-feature-table": AICarbonFeatureTableElement;
    }
}
