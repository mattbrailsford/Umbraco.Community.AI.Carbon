namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The top of the estimate expressed as one everyday activity, to give the figure a sense of scale.
/// </summary>
/// <param name="Kind">The unit the amount is in.</param>
/// <param name="Amount">How many of <paramref name="Kind"/> the emissions equal. Not rounded; the UI rounds it.</param>
/// <param name="BasisCo2eGrams">The emissions (grams CO2e) the amount was worked out from: the top of the estimated range.</param>
/// <param name="Source">The publisher of the conversion factor used.</param>
/// <param name="SourceYear">The edition (year) of the conversion factor used.</param>
public sealed record AICarbonEquivalent(
    AICarbonEquivalentKind Kind,
    double Amount,
    double BasisCo2eGrams,
    string Source,
    int SourceYear);
