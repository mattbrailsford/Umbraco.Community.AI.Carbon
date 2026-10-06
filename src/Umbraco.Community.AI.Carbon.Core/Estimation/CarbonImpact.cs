namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The estimated impact of some amount of LLM usage, as min/max ranges.
/// </summary>
/// <param name="Co2eKg">Greenhouse gas emissions in kg CO2e (electricity use plus embodied hardware).</param>
/// <param name="EnergyKwh">Energy used in kWh, including data centre overhead (PUE).</param>
internal sealed record CarbonImpact(RangeValue Co2eKg, RangeValue EnergyKwh);
