using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// The estimated emissions in one hourly or daily bucket.
/// </summary>
public class EstimateTimeSeriesPointModel
{
    /// <summary>
    /// The UTC start of the bucket.
    /// </summary>
    [Required]
    public DateTime Timestamp { get; set; }

    /// <summary>
    /// Estimated emissions in grams CO2e.
    /// </summary>
    [Required]
    public EstimateRangeModel Co2eGrams { get; set; } = new();
}
