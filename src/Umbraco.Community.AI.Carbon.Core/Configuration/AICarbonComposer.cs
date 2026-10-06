using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Community.AI.Carbon.Extensions;

namespace Umbraco.Community.AI.Carbon.Core.Configuration;

/// <summary>
/// Composer that registers Umbraco AI Carbon's services into the Umbraco builder.
/// </summary>
public class AICarbonComposer : IComposer
{
    /// <inheritdoc />
    public void Compose(IUmbracoBuilder builder) => builder.AddAICarbon();
}
