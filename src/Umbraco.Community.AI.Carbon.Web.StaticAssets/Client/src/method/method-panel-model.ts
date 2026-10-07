import type { EstimateMethodModel } from "../api/types.gen.js";

/** Which electricity zone(s) the estimate used, in the four shapes the panel explains. */
export type MethodZoneView =
    | { kind: "override"; zone: string }
    | { kind: "shared"; zone: string }
    | { kind: "mixed"; zones: string[] }
    | { kind: "none" };

export interface MethodPanelViewModel {
    dataVersion: string;
    zone: MethodZoneView;
}

/**
 * Turns the estimate's method info into what the panel shows. The server sets `electricityZone` to
 * the override, else the single shared zone, else null (models use different zones, or none were
 * estimated), so `electricityZones` is only listed when `electricityZone` is empty.
 */
export function buildMethodPanelModel(method: EstimateMethodModel): MethodPanelViewModel {
    const zone = method.electricityZone?.trim();
    if (zone) {
        return {
            dataVersion: method.dataVersion,
            zone: method.zoneIsOverride ? { kind: "override", zone } : { kind: "shared", zone },
        };
    }
    return {
        dataVersion: method.dataVersion,
        zone: method.electricityZones.length > 0 ? { kind: "mixed", zones: [...method.electricityZones] } : { kind: "none" },
    };
}
