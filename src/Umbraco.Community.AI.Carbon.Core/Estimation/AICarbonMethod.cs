namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// How the estimate was calculated.
/// </summary>
/// <param name="Source">The methodology the figures are based on.</param>
/// <param name="DataVersion">The version of the reference data used.</param>
/// <param name="ElectricityZone">The electricity zone applied everywhere, or <c>null</c> when each provider's own default was used.</param>
/// <param name="ZoneIsOverride">Whether <paramref name="ElectricityZone"/> came from configuration rather than provider defaults.</param>
/// <param name="AnalyticsEnabled">Whether Umbraco.AI usage analytics are switched on.</param>
public sealed record AICarbonMethod(
    string Source,
    string DataVersion,
    string? ElectricityZone,
    bool ZoneIsOverride,
    bool AnalyticsEnabled)
{
    /// <summary>The <see cref="Source"/> value for figures based on EcoLogits.</summary>
    public const string EcoLogitsSource = "EcoLogits";
}
