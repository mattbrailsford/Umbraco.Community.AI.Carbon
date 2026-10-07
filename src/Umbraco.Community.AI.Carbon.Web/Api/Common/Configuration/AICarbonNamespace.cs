namespace Umbraco.Community.AI.Carbon.Web.Api.Common.Configuration;

/// <summary>
/// Decides whether a namespace belongs to this package: the root itself or anything beneath it, never a
/// sibling that merely shares the prefix (e.g. <c>Umbraco.Community.AI.CarbonOther</c>).
/// </summary>
internal static class AICarbonNamespace
{
    /// <summary>Returns <c>true</c> when <paramref name="ns"/> is this package's root namespace or one beneath it.</summary>
    public static bool Owns(string? ns)
        => ns is not null
           && (ns == Constants.NamespaceRoot || ns.StartsWith(Constants.NamespaceRoot + ".", StringComparison.Ordinal));
}
