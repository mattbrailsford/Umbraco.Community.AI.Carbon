namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Whether usage of a model could be turned into a CO2e estimate.
/// </summary>
public enum AICarbonEstimateStatus
{
    /// <summary>The model was matched to EcoLogits data and an estimate was made.</summary>
    Estimated,

    /// <summary>No EcoLogits model could be matched (or its data could not be used), so there is no estimate.</summary>
    UnknownModel,

    /// <summary>The usage is not text generation (for example embeddings or images), which is not estimated.</summary>
    UnsupportedCapability,
}
