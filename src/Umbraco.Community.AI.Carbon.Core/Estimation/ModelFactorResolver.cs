using Microsoft.Extensions.Logging;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Resolution;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Turns an Umbraco.AI provider and model id into a <see cref="CarbonFactor"/>: resolve the EcoLogits
/// model, then calculate with that model's provider data centre assumptions and electricity mix.
/// </summary>
internal sealed class ModelFactorResolver
{
    private readonly AICarbonModelResolverCollection _resolvers;
    private readonly IEcoLogitsDataRepository _data;
    private readonly ICarbonFactorCalculator _calculator;
    private readonly ILogger<ModelFactorResolver> _logger;

    /// <summary>Initializes a new instance of the <see cref="ModelFactorResolver"/> class.</summary>
    /// <param name="resolvers">The model resolver chain.</param>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="calculator">The factor calculator.</param>
    /// <param name="logger">The logger.</param>
    public ModelFactorResolver(
        AICarbonModelResolverCollection resolvers,
        IEcoLogitsDataRepository data,
        ICarbonFactorCalculator calculator,
        ILogger<ModelFactorResolver> logger)
    {
        _resolvers = resolvers;
        _data = data;
        _calculator = calculator;
        _logger = logger;
    }

    /// <summary>Gets the factor for a model, calculating it once per resolved model in <paramref name="cache"/>.</summary>
    /// <param name="providerId">The Umbraco.AI provider id.</param>
    /// <param name="modelId">The model id the provider reported.</param>
    /// <param name="cache">A per-estimate cache keyed by resolved model, so a problem is also logged once per estimate.</param>
    /// <returns>The lookup outcome; never throws for bad model data.</returns>
    public ModelFactorLookup Resolve(string providerId, string modelId, IDictionary<string, ModelFactorLookup> cache)
    {
        var model = _resolvers.Resolve(providerId, modelId);
        if (model is null)
        {
            return ModelFactorLookup.Unknown;
        }

        var key = $"{model.Provider}/{model.Name}";
        if (!cache.TryGetValue(key, out var lookup))
        {
            lookup = CalculateLookup(model, key);
            cache[key] = lookup;
        }

        return lookup;
    }

    private ModelFactorLookup CalculateLookup(EcoLogitsModel model, string key)
    {
        var providerConfig = _data.GetProviderConfig(model.Provider);
        var mix = providerConfig is null ? null : _data.GetElectricityMix(providerConfig.Zone);
        if (providerConfig is null || mix is null)
        {
            _logger.LogWarning(
                "AICarbon cannot estimate {Model}: EcoLogits provider {Provider} has no data centre assumptions or electricity mix.",
                key,
                model.Provider);
            return Failed(model, ModelFactorLookup.MissingProviderDataWarning);
        }

        try
        {
            return new ModelFactorLookup(model, _calculator.Calculate(model, providerConfig, mix), Array.AsReadOnly(model.Warnings.ToArray()));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            _logger.LogWarning(ex, "AICarbon cannot estimate {Model}: its reference data was rejected by the calculator.", key);
            return Failed(model, ModelFactorLookup.InvalidModelDataWarning);
        }
    }

    private static ModelFactorLookup Failed(EcoLogitsModel model, string warning)
        => new(model, null, Array.AsReadOnly([.. model.Warnings, warning]));
}
