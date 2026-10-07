import { describe, expect, it } from "vitest";
import type { EstimateMethodModel } from "../api/types.gen.js";
import { buildMethodPanelModel } from "./method-panel-model.js";

const method = (overrides: Partial<EstimateMethodModel>): EstimateMethodModel => ({
    source: "ecologits",
    dataVersion: "0.9.2",
    electricityZone: null,
    electricityZones: [],
    zoneIsOverride: false,
    analyticsEnabled: true,
    ...overrides,
});

describe("Feature: method panel view-model", () => {
    it("reports an override zone", () => {
        const model = buildMethodPanelModel(method({ electricityZone: "SWE", electricityZones: ["SWE"], zoneIsOverride: true }));
        expect(model.zone).toEqual({ kind: "override", zone: "SWE" });
    });

    it("reports a single shared zone that is not an override", () => {
        const model = buildMethodPanelModel(method({ electricityZone: "USA", electricityZones: ["USA"] }));
        expect(model.zone).toEqual({ kind: "shared", zone: "USA" });
    });

    it("lists the zones when models use different ones", () => {
        const model = buildMethodPanelModel(method({ electricityZones: ["SWE", "USA"] }));
        expect(model.zone).toEqual({ kind: "mixed", zones: ["SWE", "USA"] });
    });

    it("reports none when no models were estimated", () => {
        expect(buildMethodPanelModel(method({})).zone).toEqual({ kind: "none" });
    });

    it("carries the data version", () => {
        expect(buildMethodPanelModel(method({ dataVersion: "1.2.3" })).dataVersion).toBe("1.2.3");
    });
});
