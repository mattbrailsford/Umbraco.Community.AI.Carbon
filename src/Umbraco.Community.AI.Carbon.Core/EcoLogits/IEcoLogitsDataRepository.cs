namespace Umbraco.Community.AI.Carbon.Core.EcoLogits;

/// <summary>
/// Read access to the EcoLogits reference data (model sizes, electricity mixes, provider assumptions).
/// </summary>
public interface IEcoLogitsDataRepository
{
    /// <summary>The EcoLogits release the data was taken from.</summary>
    string DataVersion { get; }

    /// <summary>Gets every model in the data set.</summary>
    /// <returns>The models.</returns>
    IReadOnlyList<EcoLogitsModel> GetModels();

    /// <summary>Gets a model by exact provider and name (or EcoLogits alias), ignoring case.</summary>
    /// <param name="provider">The EcoLogits provider key.</param>
    /// <param name="name">The model name or alias.</param>
    /// <returns>The model, or <c>null</c> when not found.</returns>
    EcoLogitsModel? GetModel(string provider, string name);

    /// <summary>
    /// Finds models across all providers by full name, alias, or the last path segment of the name
    /// (so <c>gpt-oss-120b</c> finds <c>openai/gpt-oss-120b</c>), ignoring case.
    /// </summary>
    /// <param name="name">The model name.</param>
    /// <returns>The matching models, possibly empty.</returns>
    IReadOnlyList<EcoLogitsModel> FindModelsByName(string name);

    /// <summary>Gets the electricity mix for a zone.</summary>
    /// <param name="zone">ISO 3166-1 alpha-3 zone code.</param>
    /// <returns>The mix, or <c>null</c> when the zone is unknown.</returns>
    ElectricityMix? GetElectricityMix(string zone);

    /// <summary>Gets EcoLogits' data centre assumptions for a provider.</summary>
    /// <param name="ecoLogitsProvider">The EcoLogits provider key.</param>
    /// <returns>The config, or <c>null</c> when the provider is unknown.</returns>
    EcoLogitsProviderConfig? GetProviderConfig(string ecoLogitsProvider);

    /// <summary>Checks whether a provider key is one EcoLogits knows.</summary>
    /// <param name="ecoLogitsProvider">The EcoLogits provider key.</param>
    /// <returns><c>true</c> when known.</returns>
    bool ProviderExists(string ecoLogitsProvider);
}
