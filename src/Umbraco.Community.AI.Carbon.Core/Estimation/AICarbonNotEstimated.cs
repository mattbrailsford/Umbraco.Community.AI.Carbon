namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Usage that was counted but not estimated, so it is never silently dropped.
/// </summary>
/// <param name="Requests">The successful requests not estimated.</param>
/// <param name="OutputTokens">The output tokens not estimated.</param>
/// <param name="Models">How many provider and model rows were not estimated.</param>
public sealed record AICarbonNotEstimated(long Requests, long OutputTokens, int Models);
