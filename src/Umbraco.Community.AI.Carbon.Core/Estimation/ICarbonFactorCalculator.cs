using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// Turns an EcoLogits model, its provider's data centre assumptions and an electricity mix into a <see cref="CarbonFactor"/>.
/// </summary>
internal interface ICarbonFactorCalculator
{
    /// <summary>Calculates the factor for one model.</summary>
    /// <param name="model">The EcoLogits model.</param>
    /// <param name="providerConfig">The data centre assumptions (PUE) to use.</param>
    /// <param name="mix">The electricity mix of the zone the model runs in.</param>
    /// <returns>The factor.</returns>
    CarbonFactor Calculate(EcoLogitsModel model, EcoLogitsProviderConfig providerConfig, ElectricityMix mix);
}
