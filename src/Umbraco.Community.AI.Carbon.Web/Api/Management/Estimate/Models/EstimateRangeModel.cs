using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// A low and high estimate.
/// </summary>
public class EstimateRangeModel
{
    /// <summary>
    /// The lower bound.
    /// </summary>
    [Required]
    public double Min { get; set; }

    /// <summary>
    /// The upper bound.
    /// </summary>
    [Required]
    public double Max { get; set; }
}
