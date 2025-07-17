import { pathToFileURL } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import postcssPlugin from "@jgarber/eleventy-plugin-postcss";
import yaml from "js-yaml";
import { RenderPlugin } from "@11ty/eleventy";
import { readFileSync } from "node:fs";


const tailwindColors = ['red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
    'slate',
    'gray',
    'zinc',
    'neutral',
    'stone'
];

const getTagSet = () => {
    // Read `things` yaml
    const things = yaml.load(readFileSync("./_data/things.yml"));

    return new Set(things.map((thing) => thing.tags).flat().sort());
};

const getColorMap = () => {
    const tagSet = [...getTagSet()];

    return Object.fromEntries(tagSet.map((tag, i) => [tag, tailwindColors[i % tailwindColors.length]]));
};

export default async function (eleventyConfig) {
    // Set ouput dir (`docs` for GH Pages)
    eleventyConfig.setOutputDirectory("docs");

    // Plugins
    eleventyConfig.addPlugin(postcssPlugin);
    eleventyConfig.addPlugin(RenderPlugin);

    // Add YAML data file support
    eleventyConfig.addDataExtension("yml", (contents) => yaml.load(contents));

    // Put tag set into 11ty Collections
    eleventyConfig.addCollection("tagSet", () => [...getTagSet()]);

    // Get color map based on tags
    const colorMap = getColorMap();
    console.log(colorMap);

    // Nunjucks shortcode for tag labels
    eleventyConfig.addNunjucksShortcode("tag", function (taglabel, color) {
        const lbl_color = (typeof color === 'undefined') ? colorMap[taglabel] : color;

        return `
        <div class="inline-block relative py-1 text-xs">
            <div class="absolute inset-0 text-${lbl_color}-200 flex">
                <svg height="100%" viewBox="0 0 50 100">
                    <path
                        d="M49.9,0a17.1,17.1,0,0,0-12,5L5,37.9A17,17,0,0,0,5,62L37.9,94.9a17.1,17.1,0,0,0,12,5ZM25.4,59.4a9.5,9.5,0,1,1,9.5-9.5A9.5,9.5,0,0,1,25.4,59.4Z"
                        fill="currentColor" />
                </svg>
                <div class="flex-grow h-full -ml-px bg-${lbl_color}-200 rounded-md rounded-l-none"></div>
            </div>
            <span class="relative text-${lbl_color}-500 font-semibold pr-px">
                <span>&nbsp;&nbsp;</span>
                ${taglabel}
                <span>&nbsp;</span>
            </span>
        </div>`;
    });

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
            };
        }
    });
    eleventyConfig.addTemplateFormats("mdx");
};