// S10 — everyday equivalent of the top of the estimate. Task: T23.
using NUnit.Framework;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class EstimateEquivalentTests
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    private static Task<AICarbonEstimate> EstimateAsync(bool showEquivalents, bool withUsage = true)
    {
        var usage = new FakeUsageAnalyticsService();
        if (withUsage)
        {
            usage.Add(new UsageRow("anthropic", "claude-sonnet-4-5", AICapability.Chat, From.AddDays(1), 3, 3000));
        }

        return EstimateServiceFactory.Create(usage, showEquivalents: showEquivalents).GetEstimateAsync(From, From.AddDays(7), null);
    }

    [TestFixture]
    public class GivenTheDefaultSettings
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp() => _estimate = await EstimateAsync(showEquivalents: false);

        [Test]
        public void HasNoEquivalent() => Assert.That(_estimate.Total.Equivalent, Is.Null);
    }

    [TestFixture]
    public class GivenEquivalentsSwitchedOnAndUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp() => _estimate = await EstimateAsync(showEquivalents: true);

        [Test]
        public void IsBasedOnTheTopOfTheRange()
            => Assert.That(_estimate.Total.Equivalent!.BasisCo2eGrams, Is.EqualTo(_estimate.Total.Co2eGrams.Max));
    }

    [TestFixture]
    public class GivenEquivalentsSwitchedOnAndNoUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp() => _estimate = await EstimateAsync(showEquivalents: true, withUsage: false);

        [Test]
        public void HasNoEquivalent() => Assert.That(_estimate.Total.Equivalent, Is.Null);
    }

    [TestFixture]
    public class GivenGramsAroundTheThresholds
    {
        [TestCase(249.9, AICarbonEquivalentKind.PhoneCharges)]
        [TestCase(250.0, AICarbonEquivalentKind.CarKm)]
        [TestCase(49_999.0, AICarbonEquivalentKind.CarKm)]
        [TestCase(50_000.0, AICarbonEquivalentKind.FlightKm)]
        public void PicksTheKind(double grams, AICarbonEquivalentKind expected)
            => Assert.That(AICarbonEquivalents.Create(grams)!.Kind, Is.EqualTo(expected));
    }

    [TestFixture]
    public class GivenSeventySevenGrams
    {
        private AICarbonEquivalent _equivalent = null!;

        [SetUp]
        public void SetUp() => _equivalent = AICarbonEquivalents.Create(77)!;

        [Test]
        public void IsAboutSixPointTwoPhoneCharges() => Assert.That(_equivalent.Amount, Is.EqualTo(6.2096774).Within(1e-6));
    }

    [TestFixture]
    public class GivenCarAndFlightGrams
    {
        [Test]
        public void CarAmountIsGramsOverTheFactor()
            => Assert.That(AICarbonEquivalents.Create(1672.5)!.Amount, Is.EqualTo(10).Within(1e-9));

        [Test]
        public void FlightAmountIsGramsOverTheFactor()
            => Assert.That(AICarbonEquivalents.Create(127_860)!.Amount, Is.EqualTo(1000).Within(1e-9));
    }

    [TestFixture]
    public class GivenEachKindsSource
    {
        [TestCase(77.0, "US EPA Greenhouse Gas Equivalencies Calculator")]
        [TestCase(1000.0, "UK Government GHG Conversion Factors for Company Reporting")]
        [TestCase(60_000.0, "UK Government GHG Conversion Factors for Company Reporting")]
        public void NamesThePublisher(double grams, string expected)
            => Assert.That(AICarbonEquivalents.Create(grams)!.Source, Is.EqualTo(expected));

        [TestCase(77.0, 2024)]
        [TestCase(1000.0, 2025)]
        [TestCase(60_000.0, 2025)]
        public void NamesTheEdition(double grams, int expected)
            => Assert.That(AICarbonEquivalents.Create(grams)!.SourceYear, Is.EqualTo(expected));
    }

    [TestFixture]
    public class GivenNothingToCompare
    {
        [TestCase(0.0)]
        [TestCase(-1.0)]
        [TestCase(double.NaN)]
        [TestCase(double.PositiveInfinity)]
        public void HasNoEquivalent(double grams) => Assert.That(AICarbonEquivalents.Create(grams), Is.Null);
    }
}
