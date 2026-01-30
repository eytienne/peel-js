/** @type {Partial<import("typedoc").TypeDocOptions>} */
const config = {
    outputs: [
        {
            name: "html",
            path: "./docs/static/api",
        }
    ],
    plugin: ["typedoc-plugin-merge-modules"],
    customCss: "./docs/static/typedoc-custom.css",
    readme: "none",
    sort: ["source-order"],
    mergeModulesRenameDefaults: true,
    mergeModulesMergeMode: "project",
    navigationLinks: {
        "Examples": process.env.PUBLIC_ROOT_URL || "/"
    }
};

export default config;