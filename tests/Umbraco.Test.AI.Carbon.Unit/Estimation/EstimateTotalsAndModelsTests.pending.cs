// S1 (AC2–AC4), S2 (AC1–AC3, AC5, AC7) — Estimate totals and by-model breakdown. Task: T5.
using NUnit.Framework;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class EstimateTotalsAndModelsTests
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = From.AddDays(7);
    private static readonly DateTime During = From.AddDays(1);

    [TestFixture]
    public class GivenChatUsageOfTwoKnownModels
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("anthropic", "claude-sonnet-4-5-20250929", AICapability.Chat, During, Requests: 3, OutputTokens: 3000))
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, Requests: 2, OutputTokens: 1000));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, To, null);
        }

        [Test]
        public void HasOneRowPerModel()
            => Assert.That(_estimate.ByModel, Has.Count.EqualTo(2));

        [Test]
        public void CountsAllChatRequests()
            => Assert.That(_estimate.Total.Requests, Is.EqualTo(5));

        [Test]
        public void TotalMinIsTheSumOfModelMins()
            => Assert.That(_estimate.Total.Co2eGrams.Min, Is.EqualTo(_estimate.ByModel.Sum(m => m.Co2eGrams!.Value.Min)).Within(1e-9));

        [Test]
        public void TotalMaxIsTheSumOfModelMaxes()
            => Assert.That(_estimate.Total.Co2eGrams.Max, Is.EqualTo(_estimate.ByModel.Sum(m => m.Co2eGrams!.Value.Max)).Within(1e-9));

        [Test]
        public void ReportsEnergyAsARange()
            => Assert.That(_estimate.Total.EnergyWh.Max, Is.GreaterThan(0));

        [Test]
        public void ShowsWhichEcoLogitsModelADatedIdMatched()
            => Assert.That(_estimate.ByModel.Single(m => m.ProviderId == "anthropic").MatchedAs, Is.EqualTo("anthropic/claude-sonnet-4-5"));

        [Test]
        public void CarriesTheModelsArchitectureWarning()
            => Assert.That(_estimate.ByModel.Single(m => m.ProviderId == "anthropic").Warnings, Does.Contain("model-arch-not-released"));
    }

    [TestFixture]
    public class GivenUsageThatDiffersOnlyInInputTokens
    {
        private AICarbonEstimate _withoutInput = null!;
        private AICarbonEstimate _withInput = null!;

        [SetUp]
        public async Task SetUp()
        {
            _withoutInput = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 1, 500)))
                .GetEstimateAsync(From, To, null);
            _withInput = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 1, 500, InputTokens: 90_000, CachedInputTokens: 40_000)))
                .GetEstimateAsync(From, To, null);
        }

        [Test]
        public void GivesTheSameCo2e()
            => Assert.That(_withInput.Total.Co2eGrams.Max, Is.EqualTo(_withoutInput.Total.Co2eGrams.Max).Within(1e-12));
    }

    [TestFixture]
    public class GivenUsageOfAModelEcoLogitsDoesNotKnow
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 1, 500))
                .Add(new UsageRow("openai", "totally-made-up-model", AICapability.Chat, During, 4, 800));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, To, null);
        }

        [Test]
        public void ListsTheModelAsUnknown()
            => Assert.That(_estimate.ByModel.Single(m => m.ModelId == "totally-made-up-model").Status, Is.EqualTo(AICarbonEstimateStatus.UnknownModel));

        [Test]
        public void GivesTheUnknownModelNoFigure()
            => Assert.That(_estimate.ByModel.Single(m => m.ModelId == "totally-made-up-model").Co2eGrams, Is.Null);

        [Test]
        public void CountsItsRequestsAsNotEstimated()
            => Assert.That(_estimate.NotEstimated.Requests, Is.EqualTo(4));

        [Test]
        public void LeavesItOutOfTheTotal()
            => Assert.That(_estimate.Total.Requests, Is.EqualTo(1));
    }

    [TestFixture]
    public class GivenEmbeddingUsageOfAKnownProvider
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "text-embedding-3-small", AICapability.Embedding, During, 10, 0, InputTokens: 5000));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, To, null);
        }

        [Test]
        public void ListsItAsUnsupported()
            => Assert.That(_estimate.ByModel.Single().Status, Is.EqualTo(AICarbonEstimateStatus.UnsupportedCapability));

        [Test]
        public void LeavesTheTotalAtZero()
            => Assert.That(_estimate.Total.Co2eGrams.Max, Is.EqualTo(0));
    }

    [TestFixture]
    public class GivenAnalyticsAreDisabled
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService(), analyticsEnabled: false)
                .GetEstimateAsync(From, To, null);

        [Test]
        public void SaysAnalyticsAreOff()
            => Assert.That(_estimate.Method.AnalyticsEnabled, Is.False);
    }

    [TestFixture]
    public class GivenAnyEstimate
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(new FakeUsageAnalyticsService()
                .Add(new UsageRow("anthropic", "claude-sonnet-4-5", AICapability.Chat, During, 1, 1000)))
                .GetEstimateAsync(From, To, null);

        [Test]
        public void EveryModelMinIsNotAboveItsMax()
            => Assert.That(_estimate.ByModel.Where(m => m.Co2eGrams is not null), Has.All.Matches<AICarbonModelEstimate>(m => m.Co2eGrams!.Value.Min <= m.Co2eGrams.Value.Max));
    }
}
