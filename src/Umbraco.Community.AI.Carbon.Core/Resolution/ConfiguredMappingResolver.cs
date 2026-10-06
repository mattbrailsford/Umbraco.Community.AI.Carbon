using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// Resolves a model id through the explicit <c>AICarbon:ModelMappings</c> setting
/// (<c>"my-deployment": "openai/gpt-4o"</c>). A mapping that cannot be used is reported once and ignored.
/// </summary>
public sealed class ConfiguredMappingResolver : IAICarbonModelResolver
{
    private readonly IEcoLogitsDataRepository _data;
    private readonly IOptions<AICarbonOptions> _options;
    private readonly ILogger<ConfiguredMappingResolver> _logger;
    private readonly ConcurrentDictionary<string, byte> _reported = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Initializes a new instance of the <see cref="ConfiguredMappingResolver"/> class.</summary>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="options">The package options.</param>
    /// <param name="logger">The logger bad mappings are reported to.</param>
    public ConfiguredMappingResolver(
        IEcoLogitsDataRepository data,
        IOptions<AICarbonOptions> options,
        ILogger<ConfiguredMappingResolver> logger)
    {
        _data = data;
        _options = options;
        _logger = logger;
    }

    /// <inheritdoc />
    public EcoLogitsModel? Resolve(AICarbonModelResolutionContext context)
    {
        if (string.IsNullOrWhiteSpace(context.ModelId)
            || !TryFindMapping(context.ModelId.Trim(), out var key, out var value))
        {
            return null;
        }

        if (!ModelMappingTarget.TryParse(value, out var target))
        {
            ReportOnce(
                key,
                "AICarbon:ModelMappings '{Key}' has value '{Value}', which is not in 'provider/model' form. The mapping is ignored.",
                value);
            return null;
        }

        var model = _data.GetModel(target.Provider, target.Name);
        if (model is null)
        {
            ReportOnce(
                key,
                "AICarbon:ModelMappings '{Key}' maps to '{Value}', which is not a model EcoLogits knows. The mapping is ignored.",
                value);
        }

        return model;
    }

    // Configuration keys cannot contain ':', so a Bedrock id like "...-v1:0" can only be mapped without its
    // suffix. Try the id as given, then without ':N', then without the whole version suffix, then fully stripped.
    private bool TryFindMapping(string modelId, out string key, out string? value)
    {
        var mappings = _options.Value.ModelMappings;
        string[] candidates =
        [
            modelId,
            ModelIdDecorations.StripColonSuffix(modelId),
            ModelIdDecorations.StripVersionSuffix(modelId).Name,
            ModelIdDecorations.Strip(modelId).Name,
        ];

        foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (candidate.Length > 0 && mappings.TryGetValue(candidate, out value))
            {
                key = candidate;
                return true;
            }
        }

        key = modelId;
        value = null;
        return false;
    }

    private void ReportOnce(string key, string message, string? value)
    {
        if (_reported.TryAdd(key, 0))
        {
            _logger.LogWarning(message, key, value);
        }
    }
}
