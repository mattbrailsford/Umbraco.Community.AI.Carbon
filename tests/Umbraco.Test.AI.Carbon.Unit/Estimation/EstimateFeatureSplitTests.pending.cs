// S5 (AC1–AC4) — Estimate split by feature. Task: T8.
using NUnit.Framework;
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
}
