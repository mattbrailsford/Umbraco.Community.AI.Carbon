import type { EstimateEquivalentModel } from "../api/types.gen.js";
import { ENGLISH_NUMBER_FORMAT } from "./format-count.js";

/**
 * Words the equivalent line. Takes a localizer so the text follows the backoffice language; the default
 * returns the English fallback, which keeps this a pure function.
 */
export type EquivalentTerm = (key: string, fallback: string) => string;

const ENGLISH: EquivalentTerm = (_key, fallback) => fallback;

/**
 * Formats the everyday equivalent, e.g. "Up to about the same as charging a phone 6 times". "Up to" because the amount is worked
 * out from the top of the estimated range.
 *
 * - The amount is rounded UP to two significant figures (6.21 gives "6.3", 12,345 gives "13,000"), so an "up to"
 *   figure is never understated. English thousands separators.
 * - Phone charges below 1 read "Less than charging a phone once"; the singular is used when the shown amount is exactly 1.
 * - Returns null when there is no equivalent (the setting is off) or the amount isn't a positive number.
 */
export function formatEquivalent(
    equivalent: EstimateEquivalentModel | null | undefined,
    term: EquivalentTerm = ENGLISH,
): string | null {
    if (!equivalent || !Number.isFinite(equivalent.amount) || equivalent.amount <= 0) return null;

    const { kind, amount } = equivalent;
    if (kind === "PhoneCharges" && amount < 1) {
        return term("aiCarbon_equivalent_phoneChargesLessThanOne", "Less than charging a phone once");
    }

    const rounded = roundUpToTwoSignificantFigures(amount);
    const text = ENGLISH_NUMBER_FORMAT.format(rounded);
    const fill = (template: string) => template.replace("{amount}", () => text);
    switch (kind) {
        case "PhoneCharges":
            return rounded === 1
                ? fill(term("aiCarbon_equivalent_phoneChargeOne", "Up to about the same as charging a phone once"))
                : fill(term("aiCarbon_equivalent_phoneChargeMany", "Up to about the same as charging a phone {amount} times"));
        case "CarKm":
            return fill(term("aiCarbon_equivalent_carKm", "Up to about the same as driving {amount} km in an average car"));
        case "FlightKm":
            return fill(term("aiCarbon_equivalent_flightKm", "Up to about the same as flying {amount} km (short-haul, per passenger)"));
        default:
            return null;
    }
}

/** Absorbs floating-point noise (1.2 * 10 can come out as 12.000000000000002) so exact values aren't bumped up. */
const CEIL_EPSILON = 1e-9;

function roundUpToTwoSignificantFigures(amount: number): number {
    const exponent = Math.floor(Math.log10(amount));
    // Powers of ten are exact; dividing (rather than multiplying by 0.1, 0.01...) keeps 63 / 10 as 6.3.
    const shift = Math.abs(exponent - 1);
    const scaled = exponent >= 1 ? amount / 10 ** shift : amount * 10 ** shift;
    const rounded = Math.ceil(scaled - CEIL_EPSILON);
    return Number((exponent >= 1 ? rounded * 10 ** shift : rounded / 10 ** shift).toPrecision(12));
}
