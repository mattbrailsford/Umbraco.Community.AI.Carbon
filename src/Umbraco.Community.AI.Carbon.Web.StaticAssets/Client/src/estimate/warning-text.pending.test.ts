// S2 (AC4) — Plain-English EcoLogits warnings. Task: T15.
import { describe, expect, it } from "vitest";
import { describeWarning } from "./warning-text.js";

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
