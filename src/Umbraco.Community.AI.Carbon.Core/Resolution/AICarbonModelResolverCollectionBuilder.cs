using Umbraco.Cms.Core.Composing;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// Builds the <see cref="AICarbonModelResolverCollection"/>. Use <c>Insert&lt;T&gt;()</c>,
/// <c>Append&lt;T&gt;()</c> and <c>Remove&lt;T&gt;()</c> to change the chain.
/// </summary>
public sealed class AICarbonModelResolverCollectionBuilder
    : OrderedCollectionBuilderBase<AICarbonModelResolverCollectionBuilder, AICarbonModelResolverCollection, IAICarbonModelResolver>
{
    /// <inheritdoc />
    protected override AICarbonModelResolverCollectionBuilder This => this;
}
