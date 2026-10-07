using Umbraco.AI.Core;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The Umbraco.AI feature types that run chat completions, in the order the feature split lists them.
/// Feature types are open strings, so usage under any other value is reported as <c>other</c>.
/// </summary>
/// <remarks>
/// Sources: <c>agent</c> is set by Umbraco.AI.Agent (<c>ScopedAIAgent</c>) and <c>prompt</c> by Umbraco.AI.Prompt
/// (<c>AIPromptService</c>), both as literals; the inline types are <see cref="Constants.FeatureTypes"/>
/// (<c>InlineChat</c> and <c>InlineAgent</c> exist since 18.0.0). The other inline types (embedding, image
/// generation, speech to text) are not chat, so they are never estimated and are left out.
/// </remarks>
internal static class KnownChatFeatureTypes
{
    /// <summary>The known chat feature types, in display order.</summary>
    public static IReadOnlyList<string> All { get; } =
    [
        "agent",
        "prompt",
        Constants.FeatureTypes.InlineChat,
        Constants.FeatureTypes.InlineAgent,
    ];

    /// <summary>The feature type reported for usage that is not one of <see cref="All"/>.</summary>
    public const string Other = "other";
}
