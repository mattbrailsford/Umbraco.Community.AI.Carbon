import { css, customElement, html, nothing, repeat } from "@umbraco-cms/backoffice/external/lit";
import { UmbModalBaseElement } from "@umbraco-cms/backoffice/modal";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { buildMethodPanelModel, type MethodZoneView } from "./method-panel-model.js";
import type { AICarbonMethodPanelModalData } from "./method-panel-modal.token.js";

const elementName = "aicarbon-method-panel";

const ECOLOGITS_SITE = "https://ecologits.ai";
const ECOLOGITS_REPO = "https://github.com/mlco2/ecologits";

/** Read-only sidebar explaining how the estimate is worked out. All wording is localized. */
@customElement(elementName)
export class AICarbonMethodPanelModalElement extends UmbModalBaseElement<AICarbonMethodPanelModalData, never> {
    #t(key: string, fallback: string, replacements: Record<string, string> = {}) {
        return Object.entries(replacements).reduce(
            (text, [name, value]) => text.replace(`{${name}}`, () => value),
            this.localize.termOrDefault(key, fallback),
        );
    }

    #renderZone(zone: MethodZoneView) {
        switch (zone.kind) {
            case "override":
                return html`<p>${this.#t("aiCarbon_method_zoneOverride", "Zone used: {zone}. This is set in AICarbon:ElectricityZone.", { zone: zone.zone })}</p>`;
            case "shared":
                return html`<p>${this.#t("aiCarbon_method_zoneShared", "Zone used: {zone}. This is the default for the data centres of the models that were estimated.", { zone: zone.zone })}</p>`;
            case "mixed":
                return html`<p>${this.#t("aiCarbon_method_zoneMixed", "Each model uses its provider's default data centre location, so more than one zone was used:")}</p>
                    <ul class="zones">
                        ${repeat(zone.zones, (z) => z, (z) => html`<li>${z}</li>`)}
                    </ul>`;
            case "none":
                return html`<p>${this.#t("aiCarbon_method_zoneNone", "No models were estimated, so no electricity zone was used.")}</p>`;
        }
    }

    override render() {
        const method = this.data?.method;
        const model = method ? buildMethodPanelModel(method) : undefined;
        return html`
            <umb-body-layout headline=${this.#t("aiCarbon_method_headline", "How is this calculated?")}>
                <div id="main">
                    <uui-box headline=${this.#t("aiCarbon_method_counted_headline", "What is counted")}>
                        <p>${this.#t("aiCarbon_method_counted", "The output tokens of text generation (chat), and the number of successful chat requests.")}</p>
                    </uui-box>
                    <uui-box headline=${this.#t("aiCarbon_method_notCounted_headline", "What is not counted")}>
                        <p>${this.#t("aiCarbon_method_notCounted", "Input tokens, embeddings, image generation, speech, model training, the network and your own devices. Models EcoLogits doesn't know are listed as not estimated.")}</p>
                    </uui-box>
                    <uui-box headline=${this.#t("aiCarbon_method_how_headline", "How the estimate is made")}>
                        <p>${this.#t("aiCarbon_method_how", "Using EcoLogits' method, the GPU and server energy is worked out for each model based on its size (number of parameters). That is multiplied by the data centre's overhead (PUE) and the CO2e per kWh of the electricity mix, and a share of the hardware's manufacturing footprint is added.")}</p>
                        <p>${this.#t("aiCarbon_method_howCap", "EcoLogits normally limits the modelled generation time to how long each request actually took. Umbraco.AI does not record each request's duration, so that limit is not applied here. It rarely changes the result, and leaving it out can only make the estimate higher, not lower.")}</p>
                    </uui-box>
                    <uui-box headline=${this.#t("aiCarbon_method_zone_headline", "Electricity zone")}>
                        ${model ? this.#renderZone(model.zone) : nothing}
                        ${model?.zone.kind === "override" ? nothing : html`<p>${this.#t("aiCarbon_method_zoneHow", "If you know where your AI provider runs the models (for example an Azure region in Sweden), set AICarbon:ElectricityZone in appsettings.json to that country's code, for example \"SWE\". Only set it to where the models really run.")}</p>`}
                    </uui-box>
                    <uui-box headline=${this.#t("aiCarbon_method_ranges_headline", "Why the ranges are wide")}>
                        <p>${this.#t("aiCarbon_method_ranges", "Ranges are widest for closed models, whose sizes are not published, so their size is estimated.")}</p>
                    </uui-box>
                    <uui-box headline=${this.#t("aiCarbon_method_credit_headline", "Credit")}>
                        <p>${this.#t("aiCarbon_method_credit", "Figures use EcoLogits (data version {dataVersion}), licensed under MPL-2.0. EcoLogits is part of the CodeCarbon non-profit and was started by GenAI Impact.", { dataVersion: model?.dataVersion ?? "" })}</p>
                        <ul class="links">
                            <li><a href=${ECOLOGITS_SITE} target="_blank" rel="noopener noreferrer">${ECOLOGITS_SITE}</a></li>
                            <li><a href=${ECOLOGITS_REPO} target="_blank" rel="noopener noreferrer">${ECOLOGITS_REPO}</a></li>
                        </ul>
                    </uui-box>
                    <p class="notice">${this.#t("aiCarbon_method_notice", "This is an unofficial community package. It is not made or endorsed by Umbraco HQ. The figures are estimates, not claims by Umbraco.")}</p>
                </div>
                <uui-button slot="actions" label=${this.localize.term("general_close")} @click=${this._rejectModal}>
                    ${this.localize.term("general_close")}
                </uui-button>
            </umb-body-layout>
        `;
    }

    static override styles = [
        UmbTextStyles,
        css`
            #main {
                display: flex;
                flex-direction: column;
                gap: var(--uui-size-space-4);
            }
            p {
                margin: 0 0 var(--uui-size-space-3);
            }
            p:last-child {
                margin-bottom: 0;
            }
            ul {
                margin: 0;
                padding-left: var(--uui-size-space-5);
            }
            .notice {
                color: var(--uui-color-text-alt);
            }
        `,
    ];
}

export { AICarbonMethodPanelModalElement as element };
export default AICarbonMethodPanelModalElement;

declare global {
    interface HTMLElementTagNameMap {
        [elementName]: AICarbonMethodPanelModalElement;
    }
}
