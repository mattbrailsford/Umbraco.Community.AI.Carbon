using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.AI.Carbon.Web.Api.Management.Estimate.Models;

/// <summary>
/// Usage that was counted but not estimated.
/// </summary>
public class EstimateNotEstimatedModel
{
    /// <summary>
    /// The successful requests not estimated.
    /// </summary>
    [Required]
    public long Requests { get; set; }

    /// <summary>
    /// The output tokens not estimated.
    /// </summary>
    [Required]
    public long OutputTokens { get; set; }

    /// <summary>
    /// How many provider and model rows were not estimated.
    /// </summary>
    [Required]
    public int Models { get; set; }
}
