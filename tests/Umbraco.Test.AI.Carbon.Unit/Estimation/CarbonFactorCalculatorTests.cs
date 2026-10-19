// S1 (AC5, AC6, AC8) — Carbon factor calculator. Task: T3.
// Reference values from EcoLogits 0.11.3 compute_llm_impacts(...) with request_latency=1e9 (latency
// cap disabled, matching ARCHITECTURE.md), one request. The inputs are fixed in this file (they are
// the EcoLogits 0.11.2 figures for each named model), so a reference data update cannot move them.
using NUnit.Framework;
using Umbraco.Community.AI.Carbon.Core;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;
using Umbraco.Community.AI.Carbon.Core.Estimation;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class CarbonFactorCalculatorTests
{
    private const double Tolerance = 0.01; // 1%

    private static readonly ElectricityMix Usa = new("USA", 0.3844, []);
    private static readonly ElectricityMix Sweden = new("SWE", 0.03526, []);

    private static readonly EcoLogitsProviderConfig Anthropic = new("USA", new RangeValue(1.09, 1.14), new RangeValue(0.13, 0.999));
    private static readonly EcoLogitsProviderConfig OpenAi = new("USA", RangeValue.Of(1.20), RangeValue.Of(0.569));
    private static readonly EcoLogitsProviderConfig Mistral = new("SWE", RangeValue.Of(1.16), RangeValue.Of(0.09));

    private static readonly EcoLogitsModel ClaudeSonnet45 = new("anthropic", "claude-sonnet-4-5", new RangeValue(44, 132), RangeValue.Of(440), 44.0, 1.18, []);
    private static readonly EcoLogitsModel Gpt4oMini = new("openai", "gpt-4o-mini", new RangeValue(8, 28), new RangeValue(8, 28), 58.0, 0.53, []);
    private static readonly EcoLogitsModel MistralSmall = new("mistralai", "mistral-small-latest", RangeValue.Of(8), RangeValue.Of(119), null, null, []);
    private static readonly EcoLogitsModel ClaudeHaiku45 = new("anthropic", "claude-haiku-4-5-20251001", new RangeValue(10, 35), new RangeValue(10, 35), 60.0, 0.61, []);
    private static readonly EcoLogitsModel ClaudeOpus48 = new("anthropic", "claude-opus-4-8", new RangeValue(67, 200), RangeValue.Of(670), 108.5, 1.01, []);

    private static CarbonFactor Factor(EcoLogitsModel model, EcoLogitsProviderConfig providerConfig, ElectricityMix mix)
        => new CarbonFactorCalculator().Calculate(model, providerConfig, mix);

    [TestFixture]
    public class GivenAClosedModelWithARangeOfSizes
    {
        private CarbonImpact _impact = null!;

        [SetUp]
        public void SetUp() => _impact = Factor(ClaudeSonnet45, Anthropic, Usa).Apply(1000, requests: 1);

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
        public void SetUp() => _impact = Factor(Gpt4oMini, OpenAi, Usa).Apply(500, requests: 1);

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
        public void SetUp() => _impact = Factor(MistralSmall, Mistral, Sweden).Apply(2000, requests: 1);

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
        public void SetUp() => _impact = Factor(ClaudeSonnet45, Anthropic, Sweden).Apply(1000, requests: 1);

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

    private static CarbonFactor FactorFor(string provider, string model)
    {
        var data = EcoLogitsDataRepository.LoadEmbedded();
        var config = data.GetProviderConfig(provider)!;
        return new CarbonFactorCalculator().Calculate(
            data.GetModel(provider, model)!, config, data.GetElectricityMix(config.Zone)!);
    }

    // Reference: EcoLogits 0.11.3 compute_llm_impacts called once per request (400 + 250 + 900 output
    // tokens) with request_latency=1e9, results summed. ttft is per request, so one call with the
    // summed tokens would differ.
    [TestFixture]
    public class GivenAModelWhoseSizeRangeCrossesAGpuCountBoundaryUsedForSeveralRequests
    {
        private CarbonImpact _impact = null!;

        [SetUp]
        public void SetUp() => _impact = Factor(ClaudeHaiku45, Anthropic, Usa).Apply(1550, requests: 3);

        [Test]
        public void MinCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Min, Is.EqualTo(4.2068120098842286e-05).Within(Tolerance).Percent);

        [Test]
        public void MaxCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Max, Is.EqualTo(0.00010692091414608316).Within(Tolerance).Percent);

        [Test]
        public void MinEnergyMatchesEcoLogits()
            => Assert.That(_impact.EnergyKwh.Min, Is.EqualTo(9.772534973756519e-05).Within(Tolerance).Percent);

        [Test]
        public void MaxEnergyMatchesEcoLogits()
            => Assert.That(_impact.EnergyKwh.Max, Is.EqualTo(0.0002547240448143567).Within(Tolerance).Percent);
    }

    [TestFixture]
    public class GivenAMixtureOfExpertsModelWithATimeToFirstTokenUsedForSeveralRequests
    {
        private CarbonImpact _impact = null!;

        [SetUp]
        public void SetUp() => _impact = Factor(ClaudeOpus48, Anthropic, Usa).Apply(1550, requests: 3);

        [Test]
        public void MinCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Min, Is.EqualTo(0.0018764801941033092).Within(Tolerance).Percent);

        [Test]
        public void MaxCo2eMatchesEcoLogits()
            => Assert.That(_impact.Co2eKg.Max, Is.EqualTo(0.0036044952313103898).Within(Tolerance).Percent);

        [Test]
        public void MinEnergyMatchesEcoLogits()
            => Assert.That(_impact.EnergyKwh.Min, Is.EqualTo(0.00464696717533441).Within(Tolerance).Percent);

        [Test]
        public void MaxEnergyMatchesEcoLogits()
            => Assert.That(_impact.EnergyKwh.Max, Is.EqualTo(0.00914232367171079).Within(Tolerance).Percent);

        [Test]
        public void EnergyMinIsNotAboveMax()
            => Assert.That(_impact.EnergyKwh.Min, Is.LessThanOrEqualTo(_impact.EnergyKwh.Max));
    }

    [TestFixture]
    public class GivenAModelWithATimeToFirstTokenAndNoOutput
    {
        private CarbonFactor _factor = null!;

        [SetUp]
        public void SetUp() => _factor = FactorFor("anthropic", "claude-opus-4-8");

        [Test]
        public void ThreeRequestsCostThreeTimesOneRequest()
            => Assert.That(
                _factor.Apply(0, 3).Co2eKg.Max,
                Is.EqualTo(_factor.Apply(0, 1).Co2eKg.Max * 3).Within(1e-12));

        [Test]
        public void EachRequestCostsSomething()
            => Assert.That(_factor.Apply(0, 1).Co2eKg.Max, Is.GreaterThan(0));
    }

    [TestFixture]
    public class GivenEveryModelInTheReferenceData
    {
        [Test]
        public void NoModelHasMinCo2eAboveMax()
        {
            var data = EcoLogitsDataRepository.LoadEmbedded();
            var calculator = new CarbonFactorCalculator();
            var inverted = data.GetModels()
                .Where(model =>
                {
                    var config = data.GetProviderConfig(model.Provider)!;
                    var impact = calculator.Calculate(model, config, data.GetElectricityMix(config.Zone)!).Apply(1000, 1);
                    return impact.Co2eKg.Min > impact.Co2eKg.Max || impact.EnergyKwh.Min > impact.EnergyKwh.Max;
                })
                .Select(model => $"{model.Provider}/{model.Name}")
                .ToList();

            Assert.That(inverted, Is.Empty);
        }

        [Test]
        public void EveryModelHasAPositiveEstimate()
        {
            var data = EcoLogitsDataRepository.LoadEmbedded();
            var calculator = new CarbonFactorCalculator();
            var notPositive = data.GetModels()
                .Where(model =>
                {
                    var config = data.GetProviderConfig(model.Provider)!;
                    var impact = calculator.Calculate(model, config, data.GetElectricityMix(config.Zone)!).Apply(1000, 1);
                    return !(impact.Co2eKg.Min > 0) || !(impact.EnergyKwh.Min > 0);
                })
                .Select(model => $"{model.Provider}/{model.Name}")
                .ToList();

            Assert.That(notPositive, Is.Empty);
        }
    }

    [TestFixture]
    public class GivenAHandBuiltModelWithInvalidValues
    {
        private EcoLogitsProviderConfig _config = null!;
        private ElectricityMix _mix = null!;

        [SetUp]
        public void SetUp()
        {
            var data = EcoLogitsDataRepository.LoadEmbedded();
            _config = data.GetProviderConfig("anthropic")!;
            _mix = data.GetElectricityMix(_config.Zone)!;
        }

        private TestDelegate Calculate(EcoLogitsModel model)
            => () => new CarbonFactorCalculator().Calculate(model, _config, _mix);

        [Test]
        public void ZeroTpsIsRejected()
            => Assert.That(
                Calculate(EcoLogitsModel.Dense("x", "m", 10) with { Tps = 0 }),
                Throws.TypeOf<ArgumentOutOfRangeException>());

        [Test]
        public void NegativeTtftIsRejected()
            => Assert.That(
                Calculate(EcoLogitsModel.Dense("x", "m", 10) with { Ttft = -1 }),
                Throws.TypeOf<ArgumentOutOfRangeException>());

        [Test]
        public void ActiveMinAboveMaxIsRejected()
            => Assert.That(
                Calculate(EcoLogitsModel.Dense("x", "m", 10) with { ActiveParameters = new Core.RangeValue(20, 10) }),
                Throws.TypeOf<ArgumentOutOfRangeException>());

        [Test]
        public void NaNParametersAreRejected()
            => Assert.That(
                Calculate(EcoLogitsModel.Dense("x", "m", double.NaN)),
                Throws.TypeOf<ArgumentOutOfRangeException>());
    }
}
