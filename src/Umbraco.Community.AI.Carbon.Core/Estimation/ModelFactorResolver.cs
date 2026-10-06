using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Resolution;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Turns an Umbraco.AI provider and model id into a <see cref="CarbonFactor"/>: resolve the EcoLogits
/// model, then calculate with that model's provider data centre assumptions and an electricity mix (the
/// configured zone override when it is valid, otherwise the provider's default zone). This is the single place
/// the zone is chosen.
/// </summary>
internal sealed class ModelFactorResolver
{
    private readonly AICarbonModelResolverCollection _resolvers;
    private readonly IEcoLogitsDataRepository _data;
    private readonly ICarbonFactorCalculator _calculator;
    private readonly IOptionsMonitor<AICarbonOptions> _options;
    private readonly ILogger<ModelFactorResolver> _logger;
    private readonly ConcurrentDictionary<string, byte> _warnedZones = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Initializes a new instance of the <see cref="ModelFactorResolver"/> class.</summary>
    /// <param name="resolvers">The model resolver chain.</param>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="calculator">The factor calculator.</param>
    /// <param name="options">The options, read on every use so configuration reloads apply.</param>
    /// <param name="logger">The logger.</param>
    public ModelFactorResolver(
        AICarbonModelResolverCollection resolvers,
        IEcoLogitsDataRepository data,
        ICarbonFactorCalculator calculator,
        IOptionsMonitor<AICarbonOptions> options,
        ILogger<ModelFactorResolver> logger)
    {
        _resolvers = resolvers;
        _data = data;
        _calculator = calculator;
        _options = options;
        _logger = logger;
    }

    /// <summary>
    /// Gets the configured electricity zone override as the canonical zone code from the reference data.
    /// A blank setting counts as unset. An unknown zone is ignored and logged once per distinct value per process
    /// (the startup validator already warns at boot), so provider defaults apply.
    /// </summary>
    /// <returns>The canonical zone code, or <c>null</c> when there is no valid override.</returns>
    public string? GetZoneOverride()
    {
        var configured = _options.CurrentValue.ElectricityZone;
        if (string.IsNullOrWhiteSpace(configured))
        {
            return null;
        }

        var mix = _data.GetElectricityMix(configured);
        if (mix is null && _warnedZones.TryAdd(configured, 0))
        {
            _logger.LogWarning(
                "AICarbon:ElectricityZone '{Zone}' is not a known EcoLogits electricity zone. Each provider's default zone is used instead.",
                configured);
        }

        return mix?.Zone;
    }

    /// <summary>Gets the factor for a model, calculating it once per resolved model and zone in <paramref name="cache"/>.</summary>
    /// <param name="providerId">The Umbraco.AI provider id.</param>
    /// <param name="modelId">The model id the provider reported.</param>
    /// <param name="zoneOverride">The valid override from <see cref="GetZoneOverride"/>, or <c>null</c> to use the provider's default zone.</param>
    /// <param name="cache">A per-estimate cache keyed by resolved model and zone, so a problem is also logged once per estimate.</param>
    /// <returns>The lookup outcome; never throws for bad model data.</returns>
    public ModelFactorLookup Resolve(string providerId, string modelId, string? zoneOverride, IDictionary<string, ModelFactorLookup> cache)
    {
        var model = _resolvers.Resolve(providerId, modelId);
        if (model is null)
        {
            return ModelFactorLookup.Unknown;
        }

        var key = $"{model.Provider}/{model.Name}";
        var providerConfig = _data.GetProviderConfig(model.Provider);
        var zone = zoneOverride ?? providerConfig?.Zone;

        var cacheKey = $"{key}|{zone}";
        if (!cache.TryGetValue(cacheKey, out var lookup))
        {
            lookup = CalculateLookup(model, key, providerConfig, zone);
            cache[cacheKey] = lookup;
        }

        return lookup;
    }

    private ModelFactorLookup CalculateLookup(EcoLogitsModel model, string key, EcoLogitsProviderConfig? providerConfig, string? zone)
    {
        var mix = zone is null ? null : _data.GetElectricityMix(zone);
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
            return new ModelFactorLookup(model, _calculator.Calculate(model, providerConfig, mix), Array.AsReadOnly(model.Warnings.ToArray()), mix.Zone);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            _logger.LogWarning(ex, "AICarbon cannot estimate {Model}: its reference data was rejected by the calculator.", key);
            return Failed(model, ModelFactorLookup.InvalidModelDataWarning);
        }
    }

    private static ModelFactorLookup Failed(EcoLogitsModel model, string warning)
        => new(model, null, Array.AsReadOnly([.. model.Warnings, warning]), null);
}
