using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// Maps an Umbraco.AI provider and model id to the EcoLogits model used to estimate its footprint.
/// Resolvers are chained (see <see cref="AICarbonModelResolverCollection"/>): the first one to return
/// a model wins, so a resolver should return <c>null</c> for anything it does not recognise.
/// </summary>
public interface IAICarbonModelResolver
{
    /// <summary>Tries to resolve the model.</summary>
    /// <param name="context">The Umbraco.AI provider and model id.</param>
    /// <returns>The EcoLogits model, or <c>null</c> when this resolver does not recognise it.</returns>
    EcoLogitsModel? Resolve(AICarbonModelResolutionContext context);
}
