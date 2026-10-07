using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// How the estimate was calculated.
/// </summary>
public class EstimateMethodModel
{
    /// <summary>
    /// The methodology the figures are based on (<c>EcoLogits</c>).
    /// </summary>
    [Required]
    public string Source { get; set; } = string.Empty;

    /// <summary>
    /// The version of the reference data used.
    /// </summary>
    [Required]
    public string DataVersion { get; set; } = string.Empty;

    /// <summary>
    /// The override, else the one zone every estimated row shares, else <c>null</c> (mixed or nothing estimated).
    /// </summary>
    public string? ElectricityZone { get; set; }

    /// <summary>
    /// The distinct zones actually used, sorted.
    /// </summary>
    [Required]
    public IReadOnlyList<string> ElectricityZones { get; set; } = [];

    /// <summary>
    /// Whether <see cref="ElectricityZone"/> is a configured override rather than provider defaults.
    /// </summary>
    [Required]
    public bool ZoneIsOverride { get; set; }

    /// <summary>
    /// Whether Umbraco.AI usage analytics are switched on.
    /// </summary>
    [Required]
    public bool AnalyticsEnabled { get; set; }
}
