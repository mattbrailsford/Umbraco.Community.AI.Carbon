namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>Unit conversions between EcoLogits' figures and the ones the API reports.</summary>
internal static class MetricUnits
{
    /// <summary>The factor is in kg and kWh; the API reports grams and Wh.</summary>
    public const double PerKilo = 1000;
}
