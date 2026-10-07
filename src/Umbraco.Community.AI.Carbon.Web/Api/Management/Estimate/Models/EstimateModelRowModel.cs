using System.ComponentModel.DataAnnotations;
using Umbraco.Community.AI.Carbon.Core.Estimation;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// The estimate, or the reason there is none, for one Umbraco.AI provider and model.
/// </summary>
public class EstimateModelRowModel
{
    /// <summary>
    /// The Umbraco.AI provider id.
    /// </summary>
    [Required]
    public string ProviderId { get; set; } = string.Empty;

    /// <summary>
    /// The model id the provider reported.
    /// </summary>
    [Required]
    public string ModelId { get; set; } = string.Empty;

    /// <summary>
    /// The EcoLogits model used, as <c>provider/name</c>; <c>null</c> when not estimated.
    /// </summary>
    public string? MatchedAs { get; set; }

    /// <summary>
    /// The electricity zone used for this row; <c>null</c> when not estimated.
    /// </summary>
    public string? ElectricityZone { get; set; }

    /// <summary>
    /// <c>Estimated</c>, <c>UnknownModel</c> or <c>UnsupportedCapability</c>.
    /// </summary>
    [Required]
    public AICarbonEstimateStatus Status { get; set; }

    /// <summary>
    /// Estimated emissions in grams CO2e; <c>null</c> when not estimated.
    /// </summary>
    public EstimateRangeModel? Co2eGrams { get; set; }

    /// <summary>
    /// The successful requests counted.
    /// </summary>
    [Required]
    public long Requests { get; set; }

    /// <summary>
    /// The output tokens counted.
    /// </summary>
    [Required]
    public long OutputTokens { get; set; }

    /// <summary>
    /// Warning codes for the matched model or from this package.
    /// </summary>
    [Required]
    public IReadOnlyList<string> Warnings { get; set; } = [];
}
