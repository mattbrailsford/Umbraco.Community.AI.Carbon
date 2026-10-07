using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Community.AI.Carbon.Extensions;

namespace Umbraco.Community.AI.Carbon.Web.Configuration;

/// <summary>
/// Composer that registers the Umbraco AI Carbon Management API into the Umbraco builder.
/// </summary>
public class AICarbonWebComposer : IComposer
{
    /// <inheritdoc />
    public void Compose(IUmbracoBuilder builder) => builder.AddAICarbonWeb();
}
