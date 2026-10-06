// S5 (AC1–AC4) — Estimate split by feature. Task: T8.
using NUnit.Framework;
using Umbraco.AI.Core;
using Umbraco.AI.Core.Models;
using Umbraco.Community.AI.Carbon.Core.Estimation;
using Umbraco.Community.AI.Carbon.Tests.Unit.Support;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Estimation;

[TestFixture]
public class EstimateFeatureSplitTests
{
    private static readonly DateTime From = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime During = From.AddDays(1);

    [TestFixture]
    public class GivenAgentPromptAndUnknownFeatureUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 3, 1500, FeatureType: "agent"))
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 2, 400, FeatureType: "prompt"))
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 1, 300, FeatureType: "some-third-party-feature"));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void IsAvailable()
            => Assert.That(_estimate.ByFeature.Available, Is.True);

        [Test]
        public void HasAnAgentRowWithItsRequests()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "agent").Requests, Is.EqualTo(3));

        [Test]
        public void HasAPromptRowWithItsRequests()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "prompt").Requests, Is.EqualTo(2));

        [Test]
        public void CountsUnknownFeaturesAsOther()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "other").Requests, Is.EqualTo(1));

        [Test]
        public void FeatureMaxesSumToTheTotalMax()
            => Assert.That(_estimate.ByFeature.Items.Sum(i => i.Co2eGrams.Max), Is.EqualTo(_estimate.Total.Co2eGrams.Max).Within(1e-9));
    }

    [TestFixture]
    public class GivenTheFeatureTypeDimensionIsOff
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
            => _estimate = await EstimateServiceFactory.Create(
                    new FakeUsageAnalyticsService().Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 1, 100)),
                    featureTypeDimension: false)
                .GetEstimateAsync(From, From.AddDays(7), null);

        [Test]
        public void IsReportedAsUnavailable()
            => Assert.That(_estimate.ByFeature.Available, Is.False);

        [Test]
        public void HasNoItems()
            => Assert.That(_estimate.ByFeature.Items, Is.Empty);
    }

    [TestFixture]
    public class GivenTwoModelsUsedByAgents
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 3, 1500, FeatureType: "agent"))
                .Add(new UsageRow("openai", "gpt-4o", AICapability.Chat, During, 2, 800, FeatureType: "agent"));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void SumsThemIntoOneAgentRow()
            => Assert.That(_estimate.ByFeature.Items.Count(i => i.FeatureType == "agent"), Is.EqualTo(1));

        [Test]
        public void CountsBothModelsRequests()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "agent").Requests, Is.EqualTo(5));

        [Test]
        public void HasNoOtherRow()
            => Assert.That(_estimate.ByFeature.Items.Any(i => i.FeatureType == "other"), Is.False);
    }

    [TestFixture]
    public class GivenInlineChatUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 4, 900, FeatureType: Constants.FeatureTypes.InlineChat));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void HasItsOwnRow()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "inline-chat").Requests, Is.EqualTo(4));
    }

    [TestFixture]
    public class GivenAKnownFeatureTypeWithNoUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 3, 1500, FeatureType: "agent"));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void OmitsIt()
            => Assert.That(_estimate.ByFeature.Items.Any(i => i.FeatureType == "prompt"), Is.False);
    }

    [TestFixture]
    public class GivenUsageRecordedWithoutAFeatureType
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 2, 600, FeatureType: null));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void LandsInOther()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "other").Requests, Is.EqualTo(2));

        [Test]
        public void IsTheOnlyRow()
            => Assert.That(_estimate.ByFeature.Items, Has.Count.EqualTo(1));
    }

    [TestFixture]
    public class GivenTheFeatureTypeDimensionIsOffAndUsage
    {
        private FakeUsageAnalyticsService _usage = null!;

        [SetUp]
        public async Task SetUp()
        {
            _usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 1, 100));
            await EstimateServiceFactory.Create(_usage, featureTypeDimension: false).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void MakesNoFeatureTypeFilteredCalls()
            => Assert.That(_usage.ReceivedFilters.Count(f => f?.FeatureType is not null), Is.Zero);
    }

    [TestFixture]
    public class GivenInlineAgentUsage
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 2, 500, FeatureType: Constants.FeatureTypes.InlineAgent));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void HasItsOwnRow()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "inline-agent").Requests, Is.EqualTo(2));
    }

    [TestFixture]
    public class GivenAnalyticsAreDisabled
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 1, 100, FeatureType: "agent"));
            _estimate = await EstimateServiceFactory.Create(usage, analyticsEnabled: false).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void IsReportedAsUnavailable()
            => Assert.That(_estimate.ByFeature.Available, Is.False);
    }

    [TestFixture]
    public class GivenAgentFailuresInTheFeatureType
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 5, 700, FeatureType: "agent", FailedRequests: 2));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void CountsOnlyTheSuccessfulRequests()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "agent").Requests, Is.EqualTo(3));

        [Test]
        public void HasNoOtherRow()
            => Assert.That(_estimate.ByFeature.Items.Any(i => i.FeatureType == "other"), Is.False);
    }

    [TestFixture]
    public class GivenAgentUsageAcrossManyHourlyBuckets
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            var usage = new FakeUsageAnalyticsService();
            for (var hour = 0; hour < 120; hour++)
            {
                usage.Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, From.AddHours(hour), 1 + (hour % 4), 137 + ((hour * 7) % 911), FeatureType: "agent"));
            }

            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void HasNoOtherRowFromRounding()
            => Assert.That(_estimate.ByFeature.Items.Any(i => i.FeatureType == "other"), Is.False);
    }

    [TestFixture]
    public class GivenAFeatureReportsMoreThanTheTotalBecauseOfLateRecords
    {
        private AICarbonEstimate _estimate = null!;

        [SetUp]
        public async Task SetUp()
        {
            // The first model reads are the two breakdowns, the all-usage summary and the chat series (4 calls);
            // the extra agent request lands after them, before the feature split reads.
            var usage = new FakeUsageAnalyticsService()
                .Add(new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 3, 500, FeatureType: "agent"))
                .AddAfterCalls(4, new UsageRow("openai", "gpt-4o-mini", AICapability.Chat, During, 2, 300, FeatureType: "agent"));
            _estimate = await EstimateServiceFactory.Create(usage).GetEstimateAsync(From, From.AddDays(7), null);
        }

        [Test]
        public void SawTheLateRecords()
            => Assert.That(_estimate.ByFeature.Items.Single(i => i.FeatureType == "agent").Requests, Is.EqualTo(5));

        [Test]
        public void ClampsOtherAwayInsteadOfReportingItNegative()
            => Assert.That(_estimate.ByFeature.Items.Any(i => i.FeatureType == "other"), Is.False);
    }
}
