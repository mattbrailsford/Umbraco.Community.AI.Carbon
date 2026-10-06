namespace Umbraco.Community.AI.Carbon.Core.EcoLogits;

/// <summary>
/// A model entry from the EcoLogits reference data.
/// </summary>
/// <param name="Provider">The EcoLogits provider key (for example <c>anthropic</c>, <c>google_genai</c>, <c>huggingface_hub</c>).</param>
/// <param name="Name">The model name as listed by EcoLogits (Hugging Face names carry an org prefix).</param>
/// <param name="ActiveParameters">Active parameters, in billions.</param>
/// <param name="TotalParameters">Total parameters, in billions.</param>
/// <param name="Tps">Typical output tokens per second, when EcoLogits knows it.</param>
/// <param name="Ttft">Typical time to first token in seconds, when EcoLogits knows it.</param>
/// <param name="Warnings">EcoLogits warning codes attached to the model.</param>
public sealed record EcoLogitsModel(
    string Provider,
    string Name,
    RangeValue ActiveParameters,
    RangeValue TotalParameters,
    double? Tps,
    double? Ttft,
    IReadOnlyList<string> Warnings)
{
    /// <summary>Creates a dense model with a single fixed parameter count and no deployment data.</summary>
    /// <param name="provider">The EcoLogits provider key.</param>
    /// <param name="name">The model name.</param>
    /// <param name="parameters">Parameter count in billions (used for both active and total).</param>
    /// <returns>The model.</returns>
    public static EcoLogitsModel Dense(string provider, string name, double parameters)
        => new(provider, name, RangeValue.Of(parameters), RangeValue.Of(parameters), null, null, []);
}
