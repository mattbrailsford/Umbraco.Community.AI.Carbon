import { describe, expect, it } from "vitest";
import en from "../lang/en.js";
import { KNOWN_FEATURES } from "./feature-table-model.js";

const dictionary = (en as unknown as { aiCarbon: Record<string, string> }).aiCarbon;

describe("Feature: by-feature names stay in step with en.ts", () => {
    it("has an en.ts entry with the same English text for every known feature type", () => {
        const fromDictionary = [...KNOWN_FEATURES.keys()].map((type) => dictionary[`feature_${type}`]);
        expect(fromDictionary).toEqual([...KNOWN_FEATURES.values()]);
    });
});
