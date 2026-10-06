namespace Umbraco.Community.AI.Carbon.Core.EcoLogits;

/// <summary>
/// EcoLogits' assumptions about a provider's data centres.
/// </summary>
/// <param name="Zone">ISO 3166-1 alpha-3 electricity zone of the provider's data centres.</param>
/// <param name="Pue">Power usage effectiveness.</param>
/// <param name="Wue">Water usage effectiveness.</param>
public sealed record EcoLogitsProviderConfig(string Zone, RangeValue Pue, RangeValue Wue);
