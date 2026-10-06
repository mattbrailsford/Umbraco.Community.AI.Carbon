namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Turns grams of CO2e into one everyday equivalent. The factors are fixed here (no network) so every figure can
/// be traced to a published source; update them, and the year, when the sources publish a new edition.
/// </summary>
internal static class AICarbonEquivalents
{
    /// <summary>Emissions below this many grams are shown as smartphone charges.</summary>
    public const double PhoneChargesBelowGrams = 250;

    /// <summary>Emissions below this many grams (and not below <see cref="PhoneChargesBelowGrams"/>) are shown as car kilometres.</summary>
    public const double CarKmBelowGrams = 50_000;

    /// <summary>
    /// Grams of CO2 per smartphone charged. US EPA Greenhouse Gas Equivalencies Calculator: 1.24 x 10^-5 metric
    /// tons CO2 per smartphone charged (revision of October 2024). The EPA figure is CO2 only, but it is compared
    /// against CO2e here.
    /// </summary>
    public const double PhoneChargeGrams = 12.4;

    /// <summary>
    /// Grams of CO2e per kilometre in an average car. UK DESNZ Greenhouse gas reporting: conversion factors 2025
    /// (condensed set), Passenger vehicles, Average car, Unknown fuel, km: 0.16725 kg CO2e.
    /// </summary>
    public const double CarKmGrams = 167.25;

    /// <summary>
    /// Grams of CO2e per passenger-kilometre on a short-haul flight. UK DESNZ Greenhouse gas reporting: conversion
    /// factors 2025 (condensed set), Business travel - air, Short-haul to/from UK, Average passenger, with radiative
    /// forcing: 0.12786 kg CO2e.
    /// </summary>
    public const double FlightKmGrams = 127.86;

    /// <summary>The publisher of <see cref="PhoneChargeGrams"/>.</summary>
    public const string PhoneChargeSource = "US EPA Greenhouse Gas Equivalencies Calculator";

    /// <summary>The edition of <see cref="PhoneChargeGrams"/>.</summary>
    public const int PhoneChargeSourceYear = 2024;

    /// <summary>The publisher of <see cref="CarKmGrams"/> and <see cref="FlightKmGrams"/>.</summary>
    public const string DesnzSource = "UK Government GHG Conversion Factors for Company Reporting (condensed set)";

    /// <summary>The edition of <see cref="CarKmGrams"/> and <see cref="FlightKmGrams"/>.</summary>
    public const int DesnzSourceYear = 2025;

    /// <summary>Gets the equivalent of <paramref name="co2eGrams"/>.</summary>
    /// <param name="co2eGrams">The emissions in grams CO2e; the top of the estimated range.</param>
    /// <returns>The equivalent, or <c>null</c> when there are no emissions to compare.</returns>
    public static AICarbonEquivalent? Create(double co2eGrams)
    {
        if (!(co2eGrams > 0) || double.IsInfinity(co2eGrams))
        {
            return null;
        }

        if (co2eGrams < PhoneChargesBelowGrams)
        {
            return new AICarbonEquivalent(
                AICarbonEquivalentKind.PhoneCharges, co2eGrams / PhoneChargeGrams, co2eGrams, PhoneChargeSource, PhoneChargeSourceYear);
        }

        return co2eGrams < CarKmBelowGrams
            ? new AICarbonEquivalent(AICarbonEquivalentKind.CarKm, co2eGrams / CarKmGrams, co2eGrams, DesnzSource, DesnzSourceYear)
            : new AICarbonEquivalent(AICarbonEquivalentKind.FlightKm, co2eGrams / FlightKmGrams, co2eGrams, DesnzSource, DesnzSourceYear);
    }
}
