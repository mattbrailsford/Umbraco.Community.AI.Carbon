/** The tag of the estimated CO2e cell. Kept apart from the element so plain modules can name it. */
export const CO2E_CELL = "aicarbon-co2e-cell";

/** A CO2e column. `reserveWarningSpace` keeps room at the right of each figure for the warnings icon, so rows that can have warnings line up. */
export type Co2eColumnOptions = { reserveWarningSpace?: boolean };
