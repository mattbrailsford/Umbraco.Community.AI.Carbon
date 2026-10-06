using System.Diagnostics.CodeAnalysis;

namespace Umbraco.Community.AI.Carbon.Core.Configuration;

/// <summary>
/// A parsed <c>ecologitsProvider/modelName</c> model mapping value.
/// </summary>
/// <param name="Provider">The EcoLogits provider key.</param>
/// <param name="Name">The EcoLogits model name (may itself contain <c>/</c>).</param>
internal readonly record struct ModelMappingTarget(string Provider, string Name)
{
    /// <summary>Parses a mapping value, splitting at the first <c>/</c> and trimming whitespace around both parts.</summary>
    /// <param name="value">The raw configuration value.</param>
    /// <param name="target">The parsed target when this returns <c>true</c>.</param>
    /// <returns><c>true</c> when both parts are present.</returns>
    public static bool TryParse(string? value, [NotNullWhen(true)] out ModelMappingTarget target)
    {
        target = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var separator = value.IndexOf('/');
        if (separator < 0)
        {
            return false;
        }

        var provider = value[..separator].Trim();
        var name = value[(separator + 1)..].Trim();
        if (provider.Length == 0 || name.Length == 0)
        {
            return false;
        }

        target = new ModelMappingTarget(provider, name);
        return true;
    }
}
