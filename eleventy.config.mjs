import { RenderPlugin } from "@11ty/eleventy";
import eleventyLucideicons from "@grimlink/eleventy-plugin-lucide-icons";
import postcssPlugin from "@jgarber/eleventy-plugin-postcss";
import { evaluate } from "@mdx-js/mdx";
import markdownItKatex from "@vscode/markdown-it-katex";
import yaml from "js-yaml";
import katex from "katex";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// LaTeX math in posts (.md and .mdx), rendered to HTML at build time by KaTeX: `$...$` inline, `$$ ... $$` for a display block.
// A LaTeX error shows in red in the post instead of stopping the build. Add your own macros to `macros`.
const katexOptions = {
    throwOnError: false,
    macros: {
        "\\argmin": "\\operatorname*{arg\\,min}",
        "\\argmax": "\\operatorname*{arg\\,max}"
    }
};



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

    return new Set(things.map((thing) => thing.tags).flat().sort((a, b) => {
        return a.toLowerCase().localeCompare(b.toLowerCase());
    }));
};

const getColorMap = () => {
    const tagSet = [...getTagSet()];

    return Object.fromEntries(tagSet.map((tag, i) => [tag, tailwindColors[i % tailwindColors.length]]));
};

// Markdown is plain Markdown (no Liquid/Nunjucks pass first), so code such as R `{{ var }}` stays as written.
// To use Nunjucks shortcodes in one post, add `templateEngineOverride: njk,md` to its front matter.
export const config = {
    markdownTemplateEngine: false
};

// Blog posts: one folder per post, `blog/<slug>/index.md` (or `.mdx`); images go in the same folder
const blogPostGlob = "blog/*/index.{md,mdx}";

// Dates show as calendar days in this time zone. A YAML date (`2026-11-23`) is UTC midnight, which is the same day here;
// a real timestamp (`date: Render`, `git Created`, `Last Modified`) shows the local day, not the UTC day.
// (Keep a time zone at UTC or east of it: west of UTC, a YAML date would show as the day before.)
const siteTimeZone = "Asia/Ho_Chi_Minh";

const postDateFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: siteTimeZone
});

const isoDateFormat = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: siteTimeZone
});

export default async function (eleventyConfig) {
    // Set ouput dir (`docs` for GH Pages)
    eleventyConfig.setOutputDirectory("docs");

    // Blog posts, newest first
    eleventyConfig.addCollection("posts", (collectionApi) => {
        return [...collectionApi.getFilteredByGlob(blogPostGlob)].reverse();
    });

    // Copy the images that sit next to the posts (thumbnails, figures)
    eleventyConfig.addPassthroughCopy("blog/**/*.{png,jpg,jpeg,gif,webp,avif,svg}");

    // `date: Render` in front matter: the date of the build. It changes each time the site is rendered.
    eleventyConfig.addDateParsing((dateValue) => {
        if (typeof dateValue === "string" && dateValue.toLowerCase() === "render") {
            return new Date();
        }
    });

    // Post dates: "23 November 2026" for display, "2026-11-23" for `<time datetime>`
    eleventyConfig.addFilter("readableDate", (date) => postDateFormat.format(date));
    eleventyConfig.addFilter("isoDate", (date) => {
        const parts = Object.fromEntries(isoDateFormat.formatToParts(date).map((part) => [part.type, part.value]));
        return `${parts.year}-${parts.month}-${parts.day}`;
    });

    // A path relative to the post folder (`cover.jpg`) becomes `/blog/<slug>/cover.jpg`;
    // absolute paths (`/assets/x.png`) and full URLs stay as they are
    eleventyConfig.addFilter("postAsset", (src, postUrl) => {
        return /^(\/|[a-z][a-z0-9+.-]*:)/i.test(src) ? src : postUrl + src.replace(/^\.\//, "");
    });

    // Summary for the blog list: the text of the paragraphs (no headings, code, or images), cut at a word.
    // The output still holds the HTML entities of the rendered post, so use it with `| safe`.
    eleventyConfig.addFilter("excerpt", (html = "", maxLength = 300) => {
        const text = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
            .map((match) => match[1].replace(/<[^>]+>/g, ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        return text.length > maxLength ? `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}…` : text;
    });

    // Plugins
    eleventyConfig.addPlugin(postcssPlugin);
    eleventyConfig.addPlugin(RenderPlugin);
    eleventyConfig.addPlugin(eleventyLucideicons,);

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
        <div class="tag-label inline-block relative py-1 my-0.5 text-sm" data-tag="${taglabel}">
            <div class="absolute inset-0 text-${lbl_color}-200 flex">
                <svg height="100%" viewBox="0 0 50 100">
                    <path
                        d="M49.9,0a17.1,17.1,0,0,0-12,5L5,37.9A17,17,0,0,0,5,62L37.9,94.9a17.1,17.1,0,0,0,12,5ZM25.4,59.4a9.5,9.5,0,1,1,9.5-9.5A9.5,9.5,0,0,1,25.4,59.4Z"
                        fill="currentColor" />
                </svg>
                <div class="flex-grow h-full -ml-px bg-${lbl_color}-200 rounded-md rounded-l-none"></div>
            </div>
            <span class="relative text-${lbl_color}-500 font-semibold pr-px">
                <span>&nbsp;&nbsp;&nbsp;</span>
                ${taglabel}
                <span>&nbsp;</span>
            </span>
        </div>`;
    });

    // Passthrough copy font(s)
    // eleventyConfig.addPassthroughCopy("assets/fonts");

    // LaTeX math: KaTeX version for the stylesheet link in `base.njk`, and the math plugin for .md files
    eleventyConfig.addGlobalData("katexVersion", katex.version);
    eleventyConfig.amendLibrary("md", (mdLib) => mdLib.use(markdownItKatex.default ?? markdownItKatex, katexOptions));

    // MDX support (with LaTeX math, heading ids, and GitHub Markdown: footnotes, tables, strikethrough, task lists)
    eleventyConfig.addExtension("mdx", {
        compile: async (str, inputPath) => {
            const { default: mdxContent } = await evaluate(str, {
                ...runtime,
                baseUrl: pathToFileURL(inputPath),
                remarkPlugins: [remarkGfm, remarkMath],
                rehypePlugins: [rehypeSlug, [rehypeKatex, katexOptions]]
            });

            return async function (data) {
                let res = await mdxContent(data);
                return renderToStaticMarkup(res);
            };
        }
    });
    eleventyConfig.addTemplateFormats("mdx");
};