// S2 (AC4) — Plain-English EcoLogits warnings. Task: T15.
import { describe, expect, it } from "vitest";
import { describeWarning, KNOWN_WARNING_CODES } from "./warning-text.js";

describe("Feature: plain-English model warnings", () => {
    describe("Scenario: model size not published", () => {
        it("says the size isn't published so the range is wide", () => {
            expect(describeWarning("model-arch-not-released")).toMatch(/size isn.t published.*wide/i);
        });
    });

    describe("Scenario: multimodal model", () => {
        it("says the estimate is less precise for multimodal models", () => {
            expect(describeWarning("model-arch-multimodal")).toMatch(/less precise/i);
        });
    });

    describe("Scenario: a warning code the UI doesn't know", () => {
        it("falls back to the raw code", () => {
            expect(describeWarning("some-new-code")).toBe("some-new-code");
        });
    });
});

describe("Feature: every known warning code has text", () => {
    const codes = [
        "model-arch-not-released",
        "model-arch-multimodal",
        "electricity-mix-wue-world",
        "electricity-mix-adpe-world",
        "electricity-mix-pe-world",
        "invalid-model-data",
        "missing-provider-data",
    ];

    it.each(codes)("explains %s in words, not the raw code", (code) => {
        expect(describeWarning(code)).not.toBe(code);
        expect(describeWarning(code)).toMatch(/\s/);
    });

    it("covers exactly the codes the package knows", () => {
        expect([...KNOWN_WARNING_CODES].sort()).toEqual([...codes].sort());
    });

    it("uses the localized text when a localize function is given", () => {
        expect(describeWarning("model-arch-multimodal", (key) => `[${key}]`)).toBe("[aiCarbon_warning_model-arch-multimodal]");
    });

    it("does not localize an unknown code", () => {
        expect(describeWarning("some-new-code", () => "nope")).toBe("some-new-code");
    });
});
