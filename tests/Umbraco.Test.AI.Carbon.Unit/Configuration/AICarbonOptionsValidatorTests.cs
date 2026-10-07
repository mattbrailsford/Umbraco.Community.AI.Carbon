using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using NUnit.Framework;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Community.AI.Carbon.Core.Configuration;
using Umbraco.Community.AI.Carbon.Core.EcoLogits;

namespace Umbraco.Community.AI.Carbon.Tests.Unit.Configuration;

[TestFixture]
public class AICarbonOptionsValidatorTests
{
    private static Mock<ILogger<AICarbonOptionsValidator>> Validate(AICarbonOptions options)
    {
        var logger = new Mock<ILogger<AICarbonOptionsValidator>>();
        new AICarbonOptionsValidator(EcoLogitsDataRepository.LoadEmbedded(), Options.Create(options), logger.Object).Validate();
        return logger;
    }

    private static void VerifyWarnings(Mock<ILogger<AICarbonOptionsValidator>> logger, Times times, string? containing = null)
        => logger.Verify(
            l => l.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((state, _) => containing == null || state.ToString()!.Contains(containing)),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            times);

    [TestFixture]
    public class GivenAnUnknownElectricityZone
    {
        private readonly Mock<ILogger<AICarbonOptionsValidator>> _logger = Validate(new AICarbonOptions { ElectricityZone = "XYZ" });

        [Test]
        public void One_Warning_Is_Logged() => VerifyWarnings(_logger, Times.Once());

        [Test]
        public void The_Warning_Names_The_Zone() => VerifyWarnings(_logger, Times.Once(), "XYZ");
    }

    [TestFixture]
    public class GivenAKnownElectricityZone
    {
        [Test]
        public void Nothing_Is_Logged() => VerifyWarnings(Validate(new AICarbonOptions { ElectricityZone = "SWE" }), Times.Never());
    }

    [TestFixture]
    public class GivenAProviderMappingToAnUnknownEcoLogitsProvider
    {
        private readonly Mock<ILogger<AICarbonOptionsValidator>> _logger = Validate(
            new AICarbonOptions { ProviderMappings = { ["my-provider"] = "not_a_provider" } });

        [Test]
        public void One_Warning_Is_Logged() => VerifyWarnings(_logger, Times.Once());

        [Test]
        public void The_Warning_Names_The_Key() => VerifyWarnings(_logger, Times.Once(), "my-provider");

        [Test]
        public void The_Warning_Names_The_Value() => VerifyWarnings(_logger, Times.Once(), "not_a_provider");
    }

    [TestFixture]
    public class GivenAModelMappingNotInProviderSlashNameForm
    {
        private readonly Mock<ILogger<AICarbonOptionsValidator>> _logger = Validate(
            new AICarbonOptions { ModelMappings = { ["my-deployment"] = "gpt-4o" } });

        [Test]
        public void One_Warning_Is_Logged() => VerifyWarnings(_logger, Times.Once());

        [Test]
        public void The_Warning_Names_The_Key() => VerifyWarnings(_logger, Times.Once(), "my-deployment");
    }

    [TestFixture]
    public class GivenAModelMappingToAMissingModel
    {
        private readonly Mock<ILogger<AICarbonOptionsValidator>> _logger = Validate(
            new AICarbonOptions { ModelMappings = { ["my-deployment"] = "openai/no-such-model" } });

        [Test]
        public void One_Warning_Is_Logged() => VerifyWarnings(_logger, Times.Once());

        [Test]
        public void The_Warning_Names_The_Value() => VerifyWarnings(_logger, Times.Once(), "openai/no-such-model");
    }

    [TestFixture]
    public class GivenAFullyValidConfiguration
    {
        [Test]
        public void Nothing_Is_Logged()
            => VerifyWarnings(
                Validate(new AICarbonOptions
                {
                    ElectricityZone = "SWE",
                    ModelMappings = { ["my-deployment"] = "openai/gpt-4o" },
                }),
                Times.Never());
    }

    [TestFixture]
    public class GivenNullProviderMappingValueBoundFromJson
    {
        private AICarbonOptions _options = null!;

        [SetUp]
        public void SetUp()
        {
            var json = "{\"AICarbon\":{\"ProviderMappings\":{\"x\":null}}}";
            var configuration = new ConfigurationBuilder().AddJsonStream(new MemoryStream(Encoding.UTF8.GetBytes(json))).Build();
            _options = new AICarbonOptions();
            configuration.GetSection(AICarbonOptions.SectionName).Bind(_options);
        }

        [Test]
        public void Validation_Does_Not_Throw() => Assert.That(() => Validate(_options), Throws.Nothing);

        [Test]
        public void A_Warning_Naming_The_Key_Is_Logged() => VerifyWarnings(Validate(_options), Times.Once(), "'x'");
    }

    [TestFixture]
    public class GivenBlankMappingValues
    {
        [TestCase(null)]
        [TestCase("")]
        public void Provider_Mapping_Does_Not_Throw(string? value)
            => Assert.That(() => Validate(new AICarbonOptions { ProviderMappings = { ["x"] = value! } }), Throws.Nothing);

        [TestCase(null)]
        [TestCase("")]
        public void Provider_Mapping_Logs_A_Warning(string? value)
            => VerifyWarnings(Validate(new AICarbonOptions { ProviderMappings = { ["x"] = value! } }), Times.Once(), "'x'");

        [TestCase(null)]
        [TestCase("")]
        public void Model_Mapping_Does_Not_Throw(string? value)
            => Assert.That(() => Validate(new AICarbonOptions { ModelMappings = { ["x"] = value! } }), Throws.Nothing);

        [TestCase(null)]
        [TestCase("")]
        public void Model_Mapping_Logs_A_Warning(string? value)
            => VerifyWarnings(Validate(new AICarbonOptions { ModelMappings = { ["x"] = value! } }), Times.Once(), "'x'");

        [TestCase(null)]
        [TestCase("")]
        [TestCase("  ")]
        public void Blank_Zone_Does_Not_Throw(string? zone)
            => Assert.That(() => Validate(new AICarbonOptions { ElectricityZone = zone }), Throws.Nothing);

        [TestCase(null)]
        [TestCase("")]
        [TestCase("  ")]
        public void Blank_Zone_Logs_Nothing(string? zone)
            => VerifyWarnings(Validate(new AICarbonOptions { ElectricityZone = zone }), Times.Never());
    }

    [TestFixture]
    public class GivenTheStartupHandlerAndAFailingValidator
    {
        private Mock<ILogger<AICarbonOptionsValidationHandler>> _logger = null!;
        private AICarbonOptionsValidationHandler _handler = null!;

        [SetUp]
        public void SetUp()
        {
            _logger = new Mock<ILogger<AICarbonOptionsValidationHandler>>();
            var data = new Mock<IEcoLogitsDataRepository>();
            data.Setup(d => d.ProviderExists(It.IsAny<string>())).Throws<InvalidOperationException>();
            var validator = new AICarbonOptionsValidator(
                data.Object,
                Options.Create(new AICarbonOptions()),
                Mock.Of<ILogger<AICarbonOptionsValidator>>());
            _handler = new AICarbonOptionsValidationHandler(validator, _logger.Object);
        }

        [Test]
        public void Handle_Does_Not_Throw()
            => Assert.That(() => _handler.Handle(new UmbracoApplicationStartingNotification(Umbraco.Cms.Core.RuntimeLevel.Run, false)), Throws.Nothing);

        [Test]
        public void Handle_Logs_An_Error()
        {
            _handler.Handle(new UmbracoApplicationStartingNotification(Umbraco.Cms.Core.RuntimeLevel.Run, false));
            _logger.Verify(
                l => l.Log(LogLevel.Error, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception?>(), It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
                Times.Once());
        }
    }
}
