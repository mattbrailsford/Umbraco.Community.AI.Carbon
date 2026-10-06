// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.
//
// Ported from EcoLogits 0.11.2 ecologits/impacts/llm.py (and the range arithmetic in
// ecologits/utils/range_value.py).
// Source: https://github.com/genai-impact/ecologits/blob/0.11.2/ecologits/impacts/llm.py
//
// Changes: only energy and GWP are ported (not water, ADPe or primary energy); the measured
// request latency cap is dropped; the model is expressed per output token and per request.

using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Core.Estimation;

/// <inheritdoc />
internal sealed class CarbonFactorCalculator : ICarbonFactorCalculator
{
    private const int ModelQuantizationBits = 16;

    private const double GpuEnergyAlpha = 1.1665273170451914e-06;
    private const double GpuEnergyBeta = -0.011205921025579175;
    private const double GpuEnergyGamma = 4.052928146734005e-05;

    private const double LatencyAlpha = 0.0006785088094353663;
    private const double LatencyBeta = 0.0003119310311688259;
    private const double LatencyGamma = 0.019473717579473387;

    private const double GpuMemoryGb = 80;
    private const double GpuEmbodiedGwp = 273;

    private const double ServerGpus = 8;
    private const double ServerPowerKw = 1.2;
    private const double ServerEmbodiedGwp = 5700;

    private const double HardwareLifespanSeconds = 3 * 365 * 24 * 60 * 60;

    private const double BatchSize = 64;

    /// <inheritdoc />
    public CarbonFactor Calculate(EcoLogitsModel model, EcoLogitsProviderConfig providerConfig, ElectricityMix mix)
    {
        ArgumentNullException.ThrowIfNull(model);
        ArgumentNullException.ThrowIfNull(providerConfig);
        ArgumentNullException.ThrowIfNull(mix);
        Validate(model, providerConfig, mix);

        // EcoLogits evaluates the model at two corners, (min active, min total) and (max active, max
        // total). The lower bound of every output comes from the first corner (and the lower PUE), the
        // upper bound from the second (and the upper PUE).
        var low = CalculateCorner(model.ActiveParameters.Min, model.TotalParameters.Min, model.Tps, model.Ttft);
        var high = CalculateCorner(model.ActiveParameters.Max, model.TotalParameters.Max, model.Tps, model.Ttft);
        var pue = providerConfig.Pue;

        return new CarbonFactor(
            Co2ePerOutputToken: new RangeValue(
                (pue.Min * low.EnergyPerOutputToken * mix.Gwp) + low.EmbodiedPerOutputToken,
                (pue.Max * high.EnergyPerOutputToken * mix.Gwp) + high.EmbodiedPerOutputToken),
            Co2ePerRequest: new RangeValue(
                (pue.Min * low.EnergyPerRequest * mix.Gwp) + low.EmbodiedPerRequest,
                (pue.Max * high.EnergyPerRequest * mix.Gwp) + high.EmbodiedPerRequest),
            EnergyPerOutputToken: new RangeValue(
                pue.Min * low.EnergyPerOutputToken,
                pue.Max * high.EnergyPerOutputToken),
            EnergyPerRequest: new RangeValue(
                pue.Min * low.EnergyPerRequest,
                pue.Max * high.EnergyPerRequest));
    }

    // EcoLogitsModel is public and resolvers can hand-build one, so reject values the formula cannot
    // handle. The negated comparisons also reject NaN.
    private static void Validate(EcoLogitsModel model, EcoLogitsProviderConfig providerConfig, ElectricityMix mix)
    {
        if (model.Tps is { } tps && !(tps > 0))
        {
            throw new ArgumentOutOfRangeException(nameof(model), tps, "Tps must be greater than zero when set.");
        }

        if (model.Ttft is { } ttft && !(ttft >= 0))
        {
            throw new ArgumentOutOfRangeException(nameof(model), ttft, "Ttft must not be negative when set.");
        }

        ValidatePositiveRange(model.ActiveParameters, nameof(model.ActiveParameters));
        ValidatePositiveRange(model.TotalParameters, nameof(model.TotalParameters));
        ValidatePositiveRange(providerConfig.Pue, nameof(providerConfig.Pue));

        if (!(mix.Gwp >= 0))
        {
            throw new ArgumentOutOfRangeException(nameof(mix), mix.Gwp, "Gwp must not be negative.");
        }
    }

    private static void ValidatePositiveRange(RangeValue range, string name)
    {
        if (!(range.Min > 0) || !(range.Max > 0) || !(range.Min <= range.Max))
        {
            throw new ArgumentOutOfRangeException(
                name, range, $"{name} must be positive with Min not above Max.");
        }
    }

    private static Corner CalculateCorner(double activeParameters, double totalParameters, double? tps, double? ttft)
    {
        var gpuCount = GetRequiredGpuCount(totalParameters);

        // gpu_energy: kWh for one GPU per output token.
        var gpuEnergyPerToken =
            ((GpuEnergyAlpha * Math.Exp(GpuEnergyBeta * BatchSize) * activeParameters) + GpuEnergyGamma) / 1000;

        // generation_latency = outputTokens * latencyPerToken + requests * ttft (cap on measured latency dropped).
        var latencyPerToken = tps is null
            ? (LatencyAlpha * activeParameters) + (LatencyBeta * BatchSize) + LatencyGamma
            : 1 / tps.Value;
        var latencyPerRequest = ttft ?? 0;

        // server_energy per second of latency (kWh), GPUs excluded.
        var serverEnergyPerSecond = 1.0 / 3600 * ServerPowerKw * (gpuCount / ServerGpus) * (1 / BatchSize);

        // server_gpu_embodied_gwp / (lifetime * batch size): kg CO2e per second of latency.
        var embodiedPerSecond =
            (((gpuCount / ServerGpus) * ServerEmbodiedGwp) + (gpuCount * GpuEmbodiedGwp))
            / (HardwareLifespanSeconds * BatchSize);

        return new Corner(
            EnergyPerOutputToken: (serverEnergyPerSecond * latencyPerToken) + (gpuCount * gpuEnergyPerToken),
            EnergyPerRequest: serverEnergyPerSecond * latencyPerRequest,
            EmbodiedPerOutputToken: latencyPerToken * embodiedPerSecond,
            EmbodiedPerRequest: latencyPerRequest * embodiedPerSecond);
    }

    private static double GetRequiredGpuCount(double totalParameters)
    {
        // model_required_memory and gpu_required_count: round up to a power of two.
        var requiredMemory = 1.2 * totalParameters * ModelQuantizationBits / 8;
        var gpus = Math.Ceiling(requiredMemory / GpuMemoryGb);
        if (gpus < 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(totalParameters), totalParameters, "A model must have a positive total parameter count.");
        }

        return Math.Pow(2, Math.Ceiling(Math.Log2(gpus)));
    }

    /// <summary>Impact components at one parameter-count corner, before PUE and the electricity mix.</summary>
    private readonly record struct Corner(
        double EnergyPerOutputToken,
        double EnergyPerRequest,
        double EmbodiedPerOutputToken,
        double EmbodiedPerRequest);
}
