import { pathToFileURL } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import postcssPlugin from "@jgarber/eleventy-plugin-postcss";

export default async function (eleventyConfig) {
    // Set ouput dir (`docs` for GH Pages)
    eleventyConfig.setOutputDirectory("docs");

    // Plugins
    eleventyConfig.addPlugin(postcssPlugin);

    // Passthrough copy font(s)
    // eleventyConfig.addPassthroughCopy("assets/fonts");

    // MDX support
    eleventyConfig.addExtension("mdx", {
        compile: async (str, inputPath) => {
            const { default: mdxContent } = await evaluate(str, {
                ...runtime,
                baseUrl: pathToFileURL(inputPath)
            });

            return async function (data) {
                let res = await mdxContent(data);
                return renderToStaticMarkup(res);
            }
        }
    });
    eleventyConfig.addTemplateFormats("mdx")
};