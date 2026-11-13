// Vitest stand-in for "@umbraco/analytics-ui". The npm package ships types only; the runtime comes from the
// Umbraco.Analytics.UI NuGet package through the backoffice import map. Typed from the real .d.ts, so a
// signature change shows up at build time. Behaviour is deliberately minimal: extend it when a test needs more.
import { css } from "@umbraco-cms/backoffice/external/lit";
import type * as Real from "@umbraco/analytics-ui";

export const UAUI_TABLE_CELL: typeof Real.UAUI_TABLE_CELL = {
    text: "uaui-text-cell",
    link: "uaui-link-cell",
    number: "uaui-number-cell",
    percent: "uaui-percent-cell",
    share: "uaui-share-cell",
    status: "uaui-status-cell",
    date: "uaui-date-cell",
    progress: "uaui-progress-cell",
};

export const UauiPaletteStyles: typeof Real.UauiPaletteStyles = css``;

export const uauiPresetRange: typeof Real.uauiPresetRange = () => undefined;
export const uauiCompareFor: typeof Real.uauiCompareFor = () => undefined;
export const uauiPreviousPeriod: typeof Real.uauiPreviousPeriod = () => undefined;
export const uauiFormatDateRange: typeof Real.uauiFormatDateRange = (_localize, range) => `${range.from} - ${range.to}`;
export const uauiDaysIn: typeof Real.uauiDaysIn = () => [];
export const uauiBucketsFor: typeof Real.uauiBucketsFor = () => [];
