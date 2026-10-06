using System.Collections.ObjectModel;
using System.Text.Json;

namespace Umbraco.Community.AI.Carbon.Core.EcoLogits;

/// <summary>
/// <see cref="IEcoLogitsDataRepository"/> backed by the EcoLogits JSON files embedded in this assembly.
/// </summary>
internal sealed class EcoLogitsDataRepository : IEcoLogitsDataRepository
{
    private const string ModelsResource = "Umbraco.Community.AI.Carbon.Core.Data.EcoLogits.models.json";
    private const string ElectricityMixesResource = "Umbraco.Community.AI.Carbon.Core.Data.EcoLogits.electricity_mixes.json";

    private static readonly Lazy<EcoLogitsDataRepository> Embedded = new(LoadFromResources);
    private static readonly Lazy<IReadOnlyDictionary<string, ElectricityMix>> EmbeddedMixes
        = new(() => ParseElectricityMixes(ReadResource(ElectricityMixesResource)));

    private readonly ReadOnlyCollection<EcoLogitsModel> _models;
    private readonly Dictionary<(string Provider, string Name), EcoLogitsModel> _byKey;
    private readonly IReadOnlyDictionary<string, ElectricityMix> _mixes;

    private EcoLogitsDataRepository(
        IReadOnlyList<EcoLogitsModel> models,
        IEnumerable<(string Provider, string Alias, string Name)> aliases,
        IReadOnlyDictionary<string, ElectricityMix> mixes)
    {
        _mixes = mixes;
        var all = new List<EcoLogitsModel>(models);
        _byKey = new Dictionary<(string, string), EcoLogitsModel>(KeyComparer.Instance);
        foreach (var model in all)
        {
            _byKey.TryAdd((model.Provider, model.Name), model);
        }

        // Same semantics as EcoLogits' model_repository.py: "alias" is the name listed in models.json and
        // "name" is a new entry that copies it under that name, so the Name always matches the lookup.
        foreach (var (provider, alias, name) in aliases)
        {
            if (_byKey.TryGetValue((provider, alias), out var target) && !_byKey.ContainsKey((provider, name)))
            {
                var copy = target with { Name = name };
                _byKey.Add((provider, name), copy);
                all.Add(copy);
            }
        }

        _models = all.AsReadOnly();
    }

    /// <inheritdoc />
    public string DataVersion => "0.11.2";

    /// <summary>Gets the repository over the embedded EcoLogits data (parsed once).</summary>
    /// <returns>The shared repository instance.</returns>
    public static EcoLogitsDataRepository LoadEmbedded() => Embedded.Value;

    /// <summary>
    /// Creates an in-memory repository over the given models. Electricity mixes and provider configs
    /// still come from the embedded data so estimates can be calculated.
    /// </summary>
    /// <param name="models">The models to expose.</param>
    /// <returns>The repository.</returns>
    public static EcoLogitsDataRepository FromModels(params EcoLogitsModel[] models)
        => new(models.ToArray(), [], EmbeddedMixes.Value);

    /// <inheritdoc />
    public IReadOnlyList<EcoLogitsModel> GetModels() => _models;

    /// <inheritdoc />
    public EcoLogitsModel? GetModel(string provider, string name)
        => string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(name)
            ? null
            : _byKey.GetValueOrDefault((provider, name));

    /// <inheritdoc />
    public IReadOnlyList<EcoLogitsModel> FindModelsByName(string name)
        => _models
            .Where(model => string.Equals(model.Name, name, StringComparison.OrdinalIgnoreCase)
                            || string.Equals(LastSegment(model.Name), name, StringComparison.OrdinalIgnoreCase))
            .OrderBy(model => model.Provider, StringComparer.OrdinalIgnoreCase)
            .ThenBy(model => model.Name, StringComparer.OrdinalIgnoreCase)
            .ToList()
            .AsReadOnly();

    /// <inheritdoc />
    public ElectricityMix? GetElectricityMix(string zone)
        => string.IsNullOrWhiteSpace(zone) ? null : _mixes.GetValueOrDefault(zone);

    /// <inheritdoc />
    public EcoLogitsProviderConfig? GetProviderConfig(string ecoLogitsProvider)
        => string.IsNullOrWhiteSpace(ecoLogitsProvider) ? null : EcoLogitsProviderConfigs.All.GetValueOrDefault(ecoLogitsProvider);

    /// <inheritdoc />
    public bool ProviderExists(string ecoLogitsProvider)
        => !string.IsNullOrWhiteSpace(ecoLogitsProvider) && EcoLogitsProviderConfigs.All.ContainsKey(ecoLogitsProvider);

    private static string LastSegment(string name)
    {
        var slash = name.LastIndexOf('/');
        return slash < 0 ? name : name[(slash + 1)..];
    }

    private static EcoLogitsDataRepository LoadFromResources()
    {
        using var doc = JsonDocument.Parse(ReadResource(ModelsResource));
        var root = doc.RootElement;

        var models = new List<EcoLogitsModel>();
        foreach (var element in root.GetProperty("models").EnumerateArray())
        {
            var model = ParseModel(element);
            if (model is not null)
            {
                models.Add(model);
            }
        }

        var aliases = new List<(string, string, string)>();
        if (root.TryGetProperty("aliases", out var aliasArray) && aliasArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var element in aliasArray.EnumerateArray())
            {
                aliases.Add((
                    element.GetProperty("provider").GetString()!,
                    element.GetProperty("alias").GetString()!,
                    element.GetProperty("name").GetString()!));
            }
        }

        return new EcoLogitsDataRepository(models, aliases, EmbeddedMixes.Value);
    }

    private static EcoLogitsModel? ParseModel(JsonElement element)
    {
        var provider = element.GetProperty("provider").GetString()!;
        var name = element.GetProperty("name").GetString()!;
        var architecture = element.GetProperty("architecture");
        var parameters = architecture.GetProperty("parameters");

        RangeValue active;
        RangeValue total;
        switch (architecture.GetProperty("type").GetString())
        {
            case "dense":
                active = total = ParseRange(parameters);
                break;
            case "moe":
                total = ParseRange(parameters.GetProperty("total"));
                active = ParseRange(parameters.GetProperty("active"));
                break;
            default:
                return null; // e.g. video models: not part of the text estimation
        }

        double? tps = null;
        double? ttft = null;
        if (element.TryGetProperty("deployment", out var deployment) && deployment.ValueKind == JsonValueKind.Object)
        {
            tps = ReadOptionalDouble(deployment, "tps");
            ttft = ReadOptionalDouble(deployment, "ttft");
        }

        return new EcoLogitsModel(provider, name, active, total, tps, ttft, ReadWarnings(element));
    }

    private static IReadOnlyDictionary<string, ElectricityMix> ParseElectricityMixes(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var mixes = new Dictionary<string, ElectricityMix>(StringComparer.OrdinalIgnoreCase);
        foreach (var element in doc.RootElement.GetProperty("electricity_mixes").EnumerateArray())
        {
            var zone = element.GetProperty("name").GetString()!;
            mixes[zone] = new ElectricityMix(zone, element.GetProperty("gwp").GetDouble(), ReadWarnings(element));
        }

        return mixes;
    }

    private static RangeValue ParseRange(JsonElement element)
        => element.ValueKind == JsonValueKind.Object
            ? new RangeValue(element.GetProperty("min").GetDouble(), element.GetProperty("max").GetDouble())
            : RangeValue.Of(element.GetDouble());

    private static double? ReadOptionalDouble(JsonElement element, string property)
        => element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.Number
            ? value.GetDouble()
            : null;

    private static IReadOnlyList<string> ReadWarnings(JsonElement element)
        => element.TryGetProperty("warnings", out var warnings) && warnings.ValueKind == JsonValueKind.Array
            ? warnings.EnumerateArray().Select(w => w.GetString()!).ToList().AsReadOnly()
            : [];

    private static string ReadResource(string resourceName)
    {
        using var stream = typeof(EcoLogitsDataRepository).Assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource '{resourceName}' was not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private sealed class KeyComparer : IEqualityComparer<(string Provider, string Name)>
    {
        public static readonly KeyComparer Instance = new();

        public bool Equals((string Provider, string Name) x, (string Provider, string Name) y)
            => string.Equals(x.Provider, y.Provider, StringComparison.OrdinalIgnoreCase)
               && string.Equals(x.Name, y.Name, StringComparison.OrdinalIgnoreCase);

        public int GetHashCode((string Provider, string Name) obj)
            => HashCode.Combine(
                StringComparer.OrdinalIgnoreCase.GetHashCode(obj.Provider),
                StringComparer.OrdinalIgnoreCase.GetHashCode(obj.Name));
    }
}
