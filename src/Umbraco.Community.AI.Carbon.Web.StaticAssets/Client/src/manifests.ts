/**
 * Bundle Entry Point
 * This file is the entry point for Umbraco's bundle loader.
 * It ONLY exports the manifests array - nothing else.
 * Umbraco's bundle loader iterates over ALL exports looking for manifest-like
 * structures (objects with a `type` property). Exporting anything else (class
 * instances, context tokens, singletons) will cause errors.
 */
import type { UmbExtensionManifestKind } from "@umbraco-cms/backoffice/extension-registry";

export const manifests: Array<UmbExtensionManifest | UmbExtensionManifestKind> = [];
