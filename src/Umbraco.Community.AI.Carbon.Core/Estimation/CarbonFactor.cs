namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <summary>
/// The estimated impact of one model, as a per-output-token and a per-request component. EcoLogits'
/// model is linear in output tokens and requests, so one factor can be multiplied by aggregated usage.
/// </summary>
/// <param name="Co2ePerOutputToken">kg CO2e for each output token.</param>
/// <param name="Co2ePerRequest">kg CO2e for each request (time to first token), independent of output length.</param>
/// <param name="EnergyPerOutputToken">kWh for each output token.</param>
/// <param name="EnergyPerRequest">kWh for each request, independent of output length.</param>
internal sealed record CarbonFactor(
    RangeValue Co2ePerOutputToken,
    RangeValue Co2ePerRequest,
    RangeValue EnergyPerOutputToken,
    RangeValue EnergyPerRequest)
{
    /// <summary>Applies the factor to usage.</summary>
    /// <param name="outputTokens">Total output tokens.</param>
    /// <param name="requests">Total requests.</param>
    /// <returns>The estimated impact of that usage.</returns>
    public CarbonImpact Apply(long outputTokens, long requests)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(outputTokens);
        ArgumentOutOfRangeException.ThrowIfNegative(requests);

        return new CarbonImpact(
            Scale(Co2ePerOutputToken, outputTokens, Co2ePerRequest, requests),
            Scale(EnergyPerOutputToken, outputTokens, EnergyPerRequest, requests));
    }

    private static RangeValue Scale(RangeValue perToken, long tokens, RangeValue perRequest, long requests)
        => new(
            (perToken.Min * tokens) + (perRequest.Min * requests),
            (perToken.Max * tokens) + (perRequest.Max * requests));
}
