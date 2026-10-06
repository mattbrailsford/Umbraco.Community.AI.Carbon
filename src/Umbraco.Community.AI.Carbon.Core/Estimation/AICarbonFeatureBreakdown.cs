namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The estimate split by Umbraco.AI feature type.
/// </summary>
/// <param name="Available">Whether the split could be made (Umbraco.AI's feature type dimension is on).</param>
/// <param name="Items">The split; empty when not available.</param>
public sealed record AICarbonFeatureBreakdown(bool Available, IReadOnlyList<AICarbonFeatureEstimate> Items);
