using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// The estimated emissions of one Umbraco.AI feature type.
/// </summary>
public class EstimateFeatureItemModel
{
    /// <summary>
    /// The feature type, or <c>other</c> for usage not attributed to a known type.
    /// </summary>
    [Required]
    public string FeatureType { get; set; } = string.Empty;

    /// <summary>
    /// Estimated emissions in grams CO2e.
    /// </summary>
    [Required]
    public EstimateRangeModel Co2eGrams { get; set; } = new();

    /// <summary>
    /// The successful chat requests counted.
    /// </summary>
    [Required]
    public long Requests { get; set; }
}
