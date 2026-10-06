using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// The estimated impact of everything that could be estimated.
/// </summary>
public class EstimateTotalModel
{
    /// <summary>
    /// Estimated emissions in grams CO2e.
    /// </summary>
    [Required]
    public EstimateRangeModel Co2eGrams { get; set; } = new();

    /// <summary>
    /// Estimated energy in watt hours.
    /// </summary>
    [Required]
    public EstimateRangeModel EnergyWh { get; set; } = new();

    /// <summary>
    /// The successful chat requests included in the estimate.
    /// </summary>
    [Required]
    public long Requests { get; set; }

    /// <summary>
    /// The output tokens included in the estimate.
    /// </summary>
    [Required]
    public long OutputTokens { get; set; }

    /// <summary>
    /// The top of the emissions as an everyday equivalent; <c>null</c> when switched off or there are no emissions.
    /// </summary>
    public EstimateEquivalentModel? Equivalent { get; set; }
}
