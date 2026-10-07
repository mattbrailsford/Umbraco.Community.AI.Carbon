namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// What a resolver is asked to resolve: the values exactly as Umbraco.AI recorded them.
/// </summary>
/// <param name="ProviderId">The Umbraco.AI provider id (for example <c>openai</c> or <c>amazon</c>).</param>
/// <param name="ModelId">The model id the provider reported (for example <c>us.anthropic.claude-sonnet-4-5-20250929-v1:0</c>).</param>
public sealed record AICarbonModelResolutionContext(string ProviderId, string ModelId);
