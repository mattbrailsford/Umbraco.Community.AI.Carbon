using Microsoft.Extensions.Options;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// Resolves a model by exact name (or EcoLogits alias) under the EcoLogits provider that
/// <c>AICarbon:ProviderMappings</c> maps the Umbraco.AI provider id to.
/// </summary>
public sealed class DirectProviderResolver : IAICarbonModelResolver
{
    private readonly IEcoLogitsDataRepository _data;
    private readonly IOptions<AICarbonOptions> _options;

    /// <summary>Initializes a new instance of the <see cref="DirectProviderResolver"/> class.</summary>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="options">The package options.</param>
    public DirectProviderResolver(IEcoLogitsDataRepository data, IOptions<AICarbonOptions> options)
    {
        _data = data;
        _options = options;
    }

    /// <inheritdoc />
    public EcoLogitsModel? Resolve(AICarbonModelResolutionContext context)
    {
        if (string.IsNullOrWhiteSpace(context.ProviderId)
            || string.IsNullOrWhiteSpace(context.ModelId)
            || !_options.Value.ProviderMappings.TryGetValue(context.ProviderId, out var ecoLogitsProvider)
            || string.IsNullOrWhiteSpace(ecoLogitsProvider))
        {
            return null;
        }

        return _data.GetModel(ecoLogitsProvider, context.ModelId.Trim());
    }
}
