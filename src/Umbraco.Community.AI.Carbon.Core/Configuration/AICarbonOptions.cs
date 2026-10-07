using System.Collections.ObjectModel;

namespace Umbraco.Community.AI.Carbon.Core.Configuration;

/// <summary>
/// Settings for Umbraco AI Carbon, bound from the <c>AICarbon</c> configuration section.
/// </summary>
public sealed class AICarbonOptions
{
    /// <summary>The configuration section the options are bound from.</summary>
    public const string SectionName = "AICarbon";

    /// <summary>
    /// The provider mappings shipped with the package (Umbraco.AI provider id to EcoLogits provider).
    /// Configuration entries add to or replace these.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> DefaultProviderMappings
        = new ReadOnlyDictionary<string, string>(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["openai"] = "openai",
            ["anthropic"] = "anthropic",
            ["google"] = "google_genai",
            ["mistral"] = "mistralai",
            ["huggingface"] = "huggingface_hub",
        });

    private Dictionary<string, string> _modelMappings = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, string> _providerMappings = new(DefaultProviderMappings, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Gets or sets the ISO 3166-1 alpha-3 electricity zone (for example <c>SWE</c> or <c>WOR</c>) used for
    /// every estimate. When <c>null</c>, each EcoLogits provider's default zone is used.
    /// </summary>
    public string? ElectricityZone { get; set; }

    /// <summary>
    /// Gets or sets whether the estimate includes an everyday equivalent (smartphone charges, car or flight
    /// kilometres) of the top of the range. On by default; set to <c>false</c> to hide it. Read on every estimate,
    /// so changes apply without a restart.
    /// </summary>
    public bool ShowEquivalents { get; set; } = true;

    /// <summary>
    /// Gets or sets explicit model mappings: an Umbraco.AI model id to <c>ecologitsProvider/modelName</c>
    /// (for example <c>"my-gpt-deployment": "openai/gpt-4o"</c>). Keys are case-insensitive:
    /// assigning a dictionary copies it into a case-insensitive one.
    /// <para>
    /// .NET configuration treats <c>:</c> as a section separator, so a key containing one (a Bedrock id such as
    /// <c>meta.llama3-1-70b-instruct-v1:0</c>) is silently dropped when bound from JSON or environment variables.
    /// Leave the <c>:N</c> suffix off the key (<c>meta.llama3-1-70b-instruct-v1</c>); a lookup that misses the
    /// exact id retries with the version suffix removed, then with every hosting decoration removed.
    /// </para>
    /// </summary>
    public Dictionary<string, string> ModelMappings
    {
        get => _modelMappings;
        set => _modelMappings = new(value ?? new(), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Gets or sets the mapping from an Umbraco.AI provider id to an EcoLogits provider. Starts with
    /// <see cref="DefaultProviderMappings"/>; configuration entries add to or replace them. Keys are case-insensitive.
    /// </summary>
    public Dictionary<string, string> ProviderMappings
    {
        get => _providerMappings;
        set => _providerMappings = new(value ?? new(), StringComparer.OrdinalIgnoreCase);
    }
}
