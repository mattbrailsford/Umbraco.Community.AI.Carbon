# Third-party notices

This package is MIT licensed, except for the EcoLogits material listed below.

## EcoLogits

Estimates in this package use data and formulas from [EcoLogits](https://github.com/genai-impact/ecologits) by GenAI Impact, version 0.11.2.

- Licence: Mozilla Public License 2.0, https://www.mozilla.org/en-US/MPL/2.0/ (full text: https://github.com/genai-impact/ecologits/blob/0.11.2/LICENSE)
- Copied unmodified:
  - `src/Umbraco.Community.AI.Carbon.Core/Data/EcoLogits/models.json` (from `ecologits/data/models.json`)
  - `src/Umbraco.Community.AI.Carbon.Core/Data/EcoLogits/electricity_mixes.json` (from `ecologits/data/electricity_mixes.json`)
- Ported to C#:
  - `src/Umbraco.Community.AI.Carbon.Core/EcoLogits/EcoLogitsProviderConfigs.cs` (from `PROVIDER_CONFIG_MAP` in `ecologits/tracers/utils.py`)
  - `src/Umbraco.Community.AI.Carbon.Core/Estimation/CarbonFactorCalculator.cs` (from `ecologits/impacts/llm.py` and `ecologits/utils/range_value.py`; energy and GWP only, latency cap dropped)
- Source for these files: https://github.com/genai-impact/ecologits/tree/0.11.2

The MPL-2.0 applies to the files above only. Source files under MPL-2.0 keep their licence header.
