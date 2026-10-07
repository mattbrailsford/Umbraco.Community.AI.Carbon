using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// Resolves a model by name under whichever EcoLogits provider knows it, whatever the Umbraco.AI provider.
/// It tries the id as given, then with hosting decorations stripped (region and vendor prefixes, version
/// suffixes), and only then without a trailing date stamp. A vendor named by a stripped prefix, then
/// first-party providers, settle names that several EcoLogits providers share; if that still leaves more
/// than one, nothing is returned.
/// </summary>
public sealed class NormalizedNameResolver : IAICarbonModelResolver
{
    private readonly IEcoLogitsDataRepository _data;
    private readonly ILogger<NormalizedNameResolver> _logger;
    private readonly ConcurrentDictionary<string, byte> _reportedAmbiguities = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Initializes a new instance of the <see cref="NormalizedNameResolver"/> class.</summary>
    /// <param name="data">The EcoLogits reference data.</param>
    /// <param name="logger">The logger ambiguous names are reported to.</param>
    public NormalizedNameResolver(IEcoLogitsDataRepository data, ILogger<NormalizedNameResolver> logger)
    {
        _data = data;
        _logger = logger;
    }

    /// <inheritdoc />
    public EcoLogitsModel? Resolve(AICarbonModelResolutionContext context)
    {
        if (string.IsNullOrWhiteSpace(context.ModelId))
        {
            return null;
        }

        var modelId = context.ModelId.Trim();
        var stripped = ModelIdDecorations.Strip(modelId);
        var withoutDate = ModelIdDecorations.StripDateStamp(stripped.Name);

        // Ordered attempts. Everything after the exact names is a fallback, tried only when nothing matched
        // exactly, so a fallback can never override a real name (gpt-4.1 and gpt-4-turbo exist as written).
        // The raw id deliberately goes first, before any vendor hint or first-party preference: an id EcoLogits
        // lists as written is the most specific answer there is.
        var withHyphens = ModelIdDecorations.ReplaceVersionDotsWithHyphens(withoutDate);
        (string Name, string? VendorHint)[] attempts =
        [
            (modelId, null),
            (stripped.Name, stripped.VendorHint),
            (withoutDate, stripped.VendorHint),
            (withHyphens, stripped.VendorHint),
            (ModelIdDecorations.StripTurboSuffix(withoutDate), stripped.VendorHint),
            (ModelIdDecorations.StripTurboSuffix(withHyphens), stripped.VendorHint),
        ];

        IReadOnlyList<EcoLogitsModel>? ambiguous = null;
        foreach (var (name, vendorHint) in attempts.Distinct())
        {
            if (name.Length == 0)
            {
                continue;
            }

            var narrowed = ModelCandidateSelector.Narrow(_data.FindModelsByName(name), vendorHint);
            if (narrowed.Count == 1)
            {
                return narrowed[0];
            }

            if (narrowed.Count > 1)
            {
                ambiguous ??= narrowed;
            }
        }

        if (ambiguous is not null && _reportedAmbiguities.TryAdd(modelId, 0))
        {
            _logger.LogWarning(
                "AICarbon could not choose between EcoLogits models for model id '{ModelId}': {Candidates}. Add an AICarbon:ModelMappings entry to pick one (configuration keys cannot contain ':', so leave a ':0' version suffix off the key).",
                modelId,
                string.Join(", ", ambiguous.Select(model => $"{model.Provider}/{model.Name}")));
        }

        return null;
    }
}
