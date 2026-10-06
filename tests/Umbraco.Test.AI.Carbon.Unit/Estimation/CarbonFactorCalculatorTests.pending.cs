// S1 (AC5, AC6, AC8) — Carbon factor calculator. Task: T3.
// Reference values from EcoLogits 0.11.2 llm_impacts(...) with request_latency=1e9 (latency cap
// disabled, matching ARCHITECTURE.md), one request.
using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Estimation;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class CarbonFactorCalculatorTests
{
    private const double Tolerance = 0.01; // 1%

    private static CarbonImpact Estimate(string provider, string model, long outputTokens, string? zone = null)
    {
        var data = EcoLogitsDataRepository.LoadEmbedded();
        var ecoModel = data.GetModel(provider, model)!;
        var providerConfig = data.GetProviderConfig(provider)!;
        var mix = data.GetElectricityMix(zone ?? providerConfig.Zone)!;
        return new CarbonFactorCalculator().Calculate(ecoModel, providerConfig, mix).Apply(outputTokens, requests: 1);
    }

    [TestFixture]
    public class GivenAClosedModelWithARangeOfSizes
    {
        private CarbonImpact _impact = null!;

        [SetUp]
        public void SetUp() => _impact = Estimate("anthropic", "claude-sonnet-4-5", 1000);

        [Test]
        public void MinCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Min, Is.EqualTo(0.0006062703470487128).Within(Tolerance).Percent);

        [Test]
        public void MaxCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Max, Is.EqualTo(0.0009825580144095147).Within(Tolerance).Percent);

        [Test]
        public void MinEnergyMatchesEcoLogits()
            => Assert.That(_impact.EnergyKwh.Min, Is.EqualTo(0.001415223268265973).Within(Tolerance).Percent);

        [Test]
        public void MaxEnergyMatchesEcoLogits()
            => Assert.That(_impact.EnergyKwh.Max, Is.EqualTo(0.002394119385229558).Within(Tolerance).Percent);

        [Test]
        public void MinIsNotAboveMax()
            => Assert.That(_impact.Co2eKg.Min, Is.LessThanOrEqualTo(_impact.Co2eKg.Max));
    }

    [TestFixture]
    public class GivenASmallMultimodalModel
    {
        private CarbonImpact _impact = null!;

        [SetUp]
        public void SetUp() => _impact = Estimate("openai", "gpt-4o-mini", 500);

        [Test]
        public void MinCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Min, Is.EqualTo(1.4635746977076385e-05).Within(Tolerance).Percent);

        [Test]
        public void MaxCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Max, Is.EqualTo(1.726233935536862e-05).Within(Tolerance).Percent);
    }

    [TestFixture]
    public class GivenAModelWithAPublishedSize
    {
        private CarbonImpact _impact = null!;

        [SetUp]
        public void SetUp() => _impact = Estimate("mistralai", "mistral-small-latest", 2000);

        [Test]
        public void Co2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Min, Is.EqualTo(8.272834480967063e-05).Within(Tolerance).Percent);

        [Test]
        public void RangeCollapsesToOneValue()
            => Assert.That(_impact.Co2eKg.Max, Is.EqualTo(_impact.Co2eKg.Min).Within(1e-12));
    }

    [TestFixture]
    public class GivenAnOverriddenElectricityZone
    {
        private CarbonImpact _impact = null!;

        [SetUp]
        public void SetUp() => _impact = Estimate("anthropic", "claude-sonnet-4-5", 1000, zone: "SWE");

        [Test]
        public void MinCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Min, Is.EqualTo(0.00011215929516633093).Within(Tolerance).Percent);

        [Test]
        public void MaxCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Max, Is.EqualTo(0.00014667517225046693).Within(Tolerance).Percent);
    }

    [TestFixture]
    public class GivenTheFactorIsAppliedToAggregatedUsage
    {
        private CarbonFactor _factor = null!;

        [SetUp]
        public void SetUp()
        {
            var data = EcoLogitsDataRepository.LoadEmbedded();
            var config = data.GetProviderConfig("anthropic")!;
            _factor = new CarbonFactorCalculator().Calculate(
                data.GetModel("anthropic", "claude-sonnet-4-5")!, config, data.GetElectricityMix(config.Zone)!);
        }

        [Test]
        public void DoublingOutputTokensAndRequestsDoublesCo2e()
            => Assert.That(
                _factor.Apply(2000, 2).Co2eKg.Max,
                Is.EqualTo(_factor.Apply(1000, 1).Co2eKg.Max * 2).Within(1e-12));

        [Test]
        public void ZeroUsageIsZeroCo2e()
            => Assert.That(_factor.Apply(0, 0).Co2eKg.Max, Is.EqualTo(0));
    }
}
