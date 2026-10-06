using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Umbraco.Cms.Core.Composing;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// The ordered chain of <see cref="IAICarbonModelResolver"/>s. Customise it with
/// <c>builder.AICarbonModelResolvers()</c>.
/// </summary>
public sealed class AICarbonModelResolverCollection : BuilderCollectionBase<IAICarbonModelResolver>
{
    private readonly ILogger<AICarbonModelResolverCollection> _logger;
    private readonly ConcurrentDictionary<Type, byte> _reportedFailures = new();

    /// <summary>Initializes a new instance of the <see cref="AICarbonModelResolverCollection"/> class.</summary>
    /// <param name="items">Supplies the resolvers, in order.</param>
    /// <param name="logger">Logs a resolver that throws; omitted logging is discarded.</param>
    public AICarbonModelResolverCollection(
        Func<IEnumerable<IAICarbonModelResolver>> items,
        ILogger<AICarbonModelResolverCollection>? logger = null)
        : base(items)
    {
        _logger = logger ?? NullLogger<AICarbonModelResolverCollection>.Instance;
    }

    /// <summary>Resolves a model with the first resolver that recognises it.</summary>
    /// <param name="providerId">The Umbraco.AI provider id.</param>
    /// <param name="modelId">The model id the provider reported.</param>
    /// <returns>The EcoLogits model, or <c>null</c> when no resolver recognises it (or an input is blank).</returns>
    /// <remarks>A resolver that throws is logged (once per resolver type) and skipped, so one faulty custom resolver cannot stop estimates.</remarks>
    public EcoLogitsModel? Resolve(string providerId, string modelId)
    {
        if (string.IsNullOrWhiteSpace(providerId) || string.IsNullOrWhiteSpace(modelId))
        {
            return null;
        }

        var context = new AICarbonModelResolutionContext(providerId, modelId);
        foreach (var resolver in this)
        {
            var model = ResolveSafely(resolver, context);
            if (model is not null)
            {
                return model;
            }
        }

        return null;
    }

    private EcoLogitsModel? ResolveSafely(IAICarbonModelResolver resolver, AICarbonModelResolutionContext context)
    {
        try
        {
            return resolver.Resolve(context);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
#pragma warning disable CA1031 // A faulty third-party resolver must not stop the rest of the chain.
        catch (Exception ex)
#pragma warning restore CA1031
        {
            if (_reportedFailures.TryAdd(resolver.GetType(), 0))
            {
                _logger.LogWarning(
                    ex,
                    "AICarbon model resolver {Resolver} threw and was skipped. Further failures from it are not logged.",
                    resolver.GetType().FullName);
            }

            return null;
        }
    }
}
