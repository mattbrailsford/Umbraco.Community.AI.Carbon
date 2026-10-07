using System.Text.RegularExpressions;

namespace Umbraco.Community.AI.Carbon.Core.Resolution;

/// <summary>
/// The result of stripping hosting decorations from a model id.
/// </summary>
/// <param name="Name">The id with the decorations removed.</param>
/// <param name="VendorHint">The vendor a stripped prefix named (for example <c>anthropic</c>), if any.</param>
internal readonly record struct StrippedModelId(string Name, string? VendorHint);

/// <summary>
/// Small, ordered rules that remove the decorations hosting providers add to a vendor's model id
/// (Bedrock region and vendor prefixes, gateway <c>vendor/</c> prefixes, version suffixes, date stamps).
/// </summary>
internal static partial class ModelIdDecorations
{
    private static readonly string[] RegionPrefixes = ["us", "us-gov", "eu", "apac", "ap", "jp", "au", "ca", "global"];

    private delegate StrippedModelId Rule(string name);

    // Order matters: the region comes off before the vendor that follows it.
    private static readonly Rule[] Rules =
    [
        StripRegionPrefix,
        StripSlashVendorPrefix,
        StripDottedVendorPrefix,
        StripVersionSuffix,
    ];

    /// <summary>Applies every decoration rule in order.</summary>
    /// <param name="modelId">The model id as Umbraco.AI recorded it.</param>
    /// <returns>The stripped id and any vendor hint.</returns>
    public static StrippedModelId Strip(string modelId)
    {
        var name = modelId.Trim();
        string? hint = null;
        foreach (var rule in Rules)
        {
            var result = rule(name);
            name = result.Name;
            hint ??= result.VendorHint;
        }

        return new StrippedModelId(name, hint);
    }

    /// <summary>Removes a trailing <c>-YYYYMMDD</c> or <c>-YYYY-MM-DD</c> date stamp.</summary>
    /// <param name="name">The model name.</param>
    /// <returns>The name without the date stamp, or the same name when it has none.</returns>
    public static string StripDateStamp(string name) => DateStampPattern().Replace(name, string.Empty);

    /// <summary>Removes a Bedrock cross-region prefix such as <c>us.</c> or <c>eu.</c>.</summary>
    /// <param name="name">The model id.</param>
    /// <returns>The stripped id (never a vendor hint).</returns>
    public static StrippedModelId StripRegionPrefix(string name)
    {
        var dot = name.IndexOf('.', StringComparison.Ordinal);
        if (dot > 0 && dot < name.Length - 1
            && RegionPrefixes.Contains(name[..dot], StringComparer.OrdinalIgnoreCase))
        {
            return new StrippedModelId(name[(dot + 1)..], null);
        }

        return new StrippedModelId(name, null);
    }

    /// <summary>Removes a <c>vendor/</c> prefix and returns the vendor as the hint.</summary>
    /// <param name="name">The model id.</param>
    /// <returns>The stripped id and the vendor hint.</returns>
    public static StrippedModelId StripSlashVendorPrefix(string name)
    {
        var slash = name.IndexOf('/', StringComparison.Ordinal);
        if (slash > 0 && slash < name.Length - 1)
        {
            return new StrippedModelId(name[(slash + 1)..], name[..slash].ToLowerInvariant());
        }

        return new StrippedModelId(name, null);
    }

    /// <summary>Removes a letters-only <c>vendor.</c> prefix (Bedrock style) and returns the vendor as the hint.</summary>
    /// <param name="name">The model id.</param>
    /// <returns>The stripped id and the vendor hint.</returns>
    public static StrippedModelId StripDottedVendorPrefix(string name)
    {
        var match = DottedVendorPattern().Match(name);
        return match.Success
            ? new StrippedModelId(match.Groups["rest"].Value, match.Groups["vendor"].Value.ToLowerInvariant())
            : new StrippedModelId(name, null);
    }

    /// <summary>Removes a Bedrock-style version suffix such as <c>-v1:0</c> or <c>:0</c>.</summary>
    /// <param name="name">The model id.</param>
    /// <returns>The stripped id (never a vendor hint).</returns>
    public static StrippedModelId StripVersionSuffix(string name)
        => new(VersionSuffixPattern().Replace(name, string.Empty), null);

    /// <summary>Removes only a trailing <c>:N</c> (<c>...-v1:0</c> to <c>...-v1</c>), the part configuration keys cannot hold.</summary>
    /// <param name="name">The model id.</param>
    /// <returns>The id without the colon suffix, or the same id when it has none.</returns>
    public static string StripColonSuffix(string name) => ColonSuffixPattern().Replace(name, string.Empty);

    /// <summary>Replaces dots between digits with hyphens (<c>claude-sonnet-4.5</c> to <c>claude-sonnet-4-5</c>), as gateways such as OpenRouter write versions. A fallback only: <c>gpt-4.1</c> is a real name.</summary>
    /// <param name="name">The model name.</param>
    /// <returns>The name with version dots replaced, or the same name when it has none.</returns>
    public static string ReplaceVersionDotsWithHyphens(string name) => VersionDotPattern().Replace(name, "-");

    /// <summary>Removes a trailing <c>-Turbo</c> (a hosting-tier suffix such as Together's). A fallback only: <c>gpt-4-turbo</c> is a real name.</summary>
    /// <param name="name">The model name.</param>
    /// <returns>The name without the suffix, or the same name when it has none.</returns>
    public static string StripTurboSuffix(string name) => TurboSuffixPattern().Replace(name, string.Empty);

    [GeneratedRegex(@"-(\d{8}|\d{4}-\d{2}-\d{2})$", RegexOptions.CultureInvariant)]
    private static partial Regex DateStampPattern();

    [GeneratedRegex(@"^(?<vendor>[A-Za-z]+)\.(?<rest>.+)$", RegexOptions.CultureInvariant)]
    private static partial Regex DottedVendorPattern();

    [GeneratedRegex(@"(-v\d+)?:\d+$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex VersionSuffixPattern();

    [GeneratedRegex(@":\d+$", RegexOptions.CultureInvariant)]
    private static partial Regex ColonSuffixPattern();

    [GeneratedRegex(@"(?<=\d)\.(?=\d)", RegexOptions.CultureInvariant)]
    private static partial Regex VersionDotPattern();

    [GeneratedRegex(@"-turbo$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex TurboSuffixPattern();
}
