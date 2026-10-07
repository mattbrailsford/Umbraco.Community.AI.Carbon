namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// How the estimate was calculated.
/// </summary>
/// <param name="Source">The methodology the figures are based on.</param>
/// <param name="DataVersion">The version of the reference data used.</param>
/// <param name="ElectricityZone">
/// The single electricity zone behind the figures: the configured override when there is a valid one, otherwise the
/// zone every estimated model shares. <c>null</c> when the models used different provider default zones (see
/// <paramref name="ElectricityZones"/>) or when nothing was estimated and there is no valid override.
/// </param>
/// <param name="ElectricityZones">The distinct zones actually used by estimated models, sorted; empty when nothing was estimated.</param>
/// <param name="ZoneIsOverride">Whether <paramref name="ElectricityZone"/> is a valid configured override rather than provider defaults.</param>
/// <param name="AnalyticsEnabled">Whether Umbraco.AI usage analytics are switched on.</param>
public sealed record AICarbonMethod(
    string Source,
    string DataVersion,
    string? ElectricityZone,
    IReadOnlyList<string> ElectricityZones,
    bool ZoneIsOverride,
    bool AnalyticsEnabled)
{
    /// <summary>The <see cref="Source"/> value for figures based on EcoLogits.</summary>
    public const string EcoLogitsSource = "EcoLogits";
}
