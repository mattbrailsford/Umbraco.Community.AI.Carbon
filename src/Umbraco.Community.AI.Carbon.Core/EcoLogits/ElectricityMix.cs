namespace Umbraco.Community.AI.Carbon.Core.EcoLogits;

/// <summary>
/// The electricity mix of one zone.
/// </summary>
/// <param name="Zone">ISO 3166-1 alpha-3 zone code (or <c>WOR</c> for the world average).</param>
/// <param name="Gwp">Global warming potential in kg CO2e per kWh.</param>
/// <param name="Warnings">EcoLogits warning codes attached to the mix.</param>
public sealed record ElectricityMix(string Zone, double Gwp, IReadOnlyList<string> Warnings);
