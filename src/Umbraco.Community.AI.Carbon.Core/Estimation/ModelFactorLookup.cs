using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The outcome of finding the <see cref="CarbonFactor"/> for an Umbraco.AI model.
/// </summary>
/// <param name="Model">The matched EcoLogits model, or <c>null</c> when none matched.</param>
/// <param name="Factor">The factor, or <c>null</c> when the model is unknown or its data cannot be used.</param>
/// <param name="Warnings">Warning codes to report with the model.</param>
internal sealed record ModelFactorLookup(EcoLogitsModel? Model, CarbonFactor? Factor, IReadOnlyList<string> Warnings)
{
    /// <summary>Warning code for a matched model whose reference data the calculator rejected.</summary>
    public const string InvalidModelDataWarning = "invalid-model-data";

    /// <summary>Warning code for a matched model whose provider has no data centre assumptions or electricity mix.</summary>
    public const string MissingProviderDataWarning = "missing-provider-data";

    /// <summary>The lookup for a model no resolver recognised.</summary>
    public static ModelFactorLookup Unknown { get; } = new(null, null, []);

    /// <summary>Gets the matched model as <c>provider/name</c>, or <c>null</c> when none matched.</summary>
    public string? MatchedAs => Model is null ? null : $"{Model.Provider}/{Model.Name}";
}
