export const manifests: Array<UmbExtensionManifest> = [
    {
        type: "localization",
        alias: "AICarbon.Localization.En",
        name: "Umbraco AI Carbon English",
        weight: -100,
        meta: {
            culture: "en",
        },
        js: () => import("./en.js"),
    },
];
