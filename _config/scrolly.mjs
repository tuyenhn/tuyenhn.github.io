// Scrollytelling for .md blog posts: in a `::: scrolly` block, the figures stay in view while the text scrolls past them.
//
//   ::: scrolly
//
//   ![](step-1.png)
//
//   Text for the first figure. It can have more than one paragraph, lists, math, and footnotes.
//
//   ![](step-2.png)
//
//   Text for the second figure.
//
//   :::
//
// Rules:
//   - A figure is an image on its own line, a code block, or an HTML <figure>, <img>, <picture>, <video>, <iframe>, <svg>, or <canvas> block.
//   - The text after a figure belongs to that figure, until the next figure. Text before the first figure belongs to the first figure.
//   - Figures with no text between them show together, as one figure.
//   - `---` starts a new text card that keeps the same figure.
//   - `{highlight="a b"}` at the start of a paragraph starts a new text card that keeps the same figure, and shows
//     only the parts `a` and `b` of the figure (the elements with `data-part="a"` or `data-part="b"`); the other parts are dimmed.
//     A card without it shows the full figure.
//
// In a block that uses `{highlight}`, an SVG image from the post folder (`![](loop.svg)`, or `<img src="loop.svg">` in a
// <figure>) is put into the page as an <svg> element, because CSS cannot change the parts of an SVG in an <img>.
//
// This file changes the Markdown tokens into the HTML below; Scrollama (`_includes/scrolly.njk`) changes the visible
// figure (and dims its parts) when a text card comes into view, and `assets/styles.css` (`.scrolly`) does the layout.
//
//   <div class="scrolly">
//     <div class="scrolly-steps">   <div class="scrolly-step" data-figure="0" data-highlight="a b"><div class="scrolly-card">text</div></div> ... </div>
//     <div class="scrolly-figures"> <div class="scrolly-figure is-active">figure 0</div> ... </div>
//   </div>
//
// The steps touch each other (the space between the cards is padding in the steps), so that the middle of the window
// is always in a step: a page reload, or a jump to a footnote and back, then also shows the correct figure.
import markdownItContainer from "markdown-it-container";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// HTML blocks that are figures (other HTML, such as <details>, is text)
const htmlFigure = /^\s*<(figure|img|picture|video|iframe|svg|canvas)\b/i;

// a paragraph that holds only images (a linked image is also an image), with spaces or line breaks between them
const isImageParagraph = (block) => {
    const children = block[1]?.children ?? [];
    const isSpace = (child) => child.type === "softbreak" || (child.type === "text" && child.content.trim() === "");
    return block[0].type === "paragraph_open"
        && children.some((child) => child.type === "image")
        && children.every((child) => ["image", "link_open", "link_close"].includes(child.type) || isSpace(child));
};

const kindOf = (block) => {
    const token = block[0];
    if (token.type === "fence" || token.type === "code_block" || isImageParagraph(block)) {
        return "figure";
    }
    if (token.type === "html_block" && htmlFigure.test(token.content)) {
        return "figure";
    }
    return token.type === "hr" ? "break" : "text";
};

// `{highlight="a b"}` (or `'a b'`) on the first line of a paragraph; the rest of the paragraph is the text of the card
const highlightMarker = /^\{\s*highlight\s*=\s*(?:"([^"]*)"|'([^']*)')\s*\}[ \t]*(?:\n|$)/;

// an SVG file next to the post: not an absolute path (`/assets/x.svg`) and not a URL
const localSvg = /^(?![a-z][a-z0-9+.-]*:|\/)[^?#]+\.svg(?:[?#].*)?$/i;
const htmlSvgImage = /<img\b[^>]*?\bsrc=(["'])([^"']+)\1[^>]*>/gi;
const partNames = (html) => [...html.matchAll(/\bdata-part=(["'])(.*?)\1/g)].flatMap((match) => match[2].split(/\s+/));

// the top-level blocks between `start` and `end`; each block is its opening token, the tokens in it, and its closing token
const topLevelBlocks = (tokens, start, end) => {
    const blocks = [];
    let i = start;
    while (i < end) {
        let j = i;
        if (tokens[i].nesting === 1) {
            for (let depth = 0; j < end; j++) {
                depth += tokens[j].nesting;
                if (depth === 0) {
                    break;
                }
            }
        }
        blocks.push(tokens.slice(i, j + 1));
        i = j + 1;
    }
    return blocks;
};

export default function scrolly(md) {
    md.use(markdownItContainer, "scrolly");

    // `{highlight="..."}`: before the inline rule, so that the marker is still Markdown source; the marker is removed
    // from the paragraph, and the names go in `meta.scrollyHighlight` of the paragraph for the rule below
    md.core.ruler.before("inline", "scrolly_highlight", (state) => {
        let scrollyLevel = null;
        state.tokens.forEach((token, i) => {
            if (token.type === "container_scrolly_open") {
                scrollyLevel = token.level;
            } else if (token.type === "container_scrolly_close") {
                scrollyLevel = null;
            } else if (scrollyLevel !== null && token.type === "paragraph_open" && token.level === scrollyLevel + 1) {
                const inline = state.tokens[i + 1];
                const match = inline.content.match(highlightMarker);
                if (match) {
                    token.meta = { ...token.meta, scrollyHighlight: (match[1] ?? match[2]).split(/\s+/).filter(Boolean) };
                    inline.content = inline.content.slice(match[0].length);
                }
            }
        });
    });

    // the last core rule, so that footnote definitions are already out of the token list
    md.core.ruler.push("scrolly", (state) => {
        const postInputPath = state.env?.page?.inputPath;
        const inputPath = postInputPath ?? "a post";

        // the text of an SVG file in the post folder, as an <svg> element; null if it is not one
        const readSvg = (src) => {
            if (!postInputPath || !localSvg.test(src)) {
                return null;
            }
            const file = resolve(dirname(postInputPath), decodeURI(src.replace(/[?#].*$/, "")));
            if (!existsSync(file)) {
                console.warn(`[blog] ${inputPath}: the SVG file ${src} in a \`::: scrolly\` block does not exist`);
                return null;
            }
            const svg = readFileSync(file, "utf8");
            const start = svg.search(/<svg\b/i);
            // without the comments (notes for the person who edits the file); `data-scrolly-svg` gives it the size rules in `assets/styles.css`
            return start === -1 ? null : svg.slice(start).replace(/<!--[\s\S]*?-->/g, "").trim().replace(/^<svg\b/i, "<svg data-scrolly-svg");
        };
        // put the SVG images of a figure into the page; the tokens are changed in place
        const inlineSvgs = (figure) => figure.forEach((token) => {
            if (token.type === "html_block") {
                token.content = token.content.replace(htmlSvgImage, (tag, _, src) => readSvg(src) ?? tag);
            }
            token.children?.forEach((child, k) => {
                const svg = child.type === "image" ? readSvg(child.attrGet("src") ?? "") : null;
                if (svg) {
                    const html = new state.Token("html_inline", "", 0);
                    html.content = svg;
                    token.children[k] = html;
                }
            });
        });
        const div = (nesting, className, attrs = {}) => {
            const token = new state.Token(nesting === 1 ? "scrolly_open" : "scrolly_close", "div", nesting);
            token.block = true;
            if (nesting === 1) {
                token.attrSet("class", className);
                Object.entries(attrs).forEach(([name, value]) => token.attrSet(name, String(value)));
            }
            return token;
        };

        const out = [];
        const tokens = state.tokens;
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].type !== "container_scrolly_open") {
                out.push(tokens[i]);
                continue;
            }
            // the matching `:::` (a scrolly block cannot hold another scrolly block)
            const close = tokens.findIndex((token, k) => k > i && token.type === "container_scrolly_close");
            if (close === -1) {
                out.push(tokens[i]);
                continue;
            }

            const figures = [];
            const steps = [];
            let previous = null;
            let stepIsOpen = false;
            // the names of the last `{highlight="..."}`, for the next card
            let highlight;
            for (const block of topLevelBlocks(tokens, i + 1, close)) {
                const marker = block[0].meta?.scrollyHighlight;
                if (marker) {
                    stepIsOpen = false;
                    highlight = marker;
                }
                // a marker on its own line has no text after it: it only starts the next card
                const kind = marker && block[1].content.trim() === "" ? "break" : kindOf(block);
                if (kind === "figure") {
                    if (previous === "figure") {
                        figures.at(-1).push(...block);
                    } else {
                        figures.push([...block]);
                    }
                    stepIsOpen = false;
                } else if (kind === "break") {
                    stepIsOpen = false;
                } else {
                    if (!stepIsOpen) {
                        steps.push({ figure: Math.max(figures.length - 1, 0), highlight, tokens: [] });
                        highlight = undefined;
                        stepIsOpen = true;
                    }
                    steps.at(-1).tokens.push(...block);
                }
                previous = kind;
            }

            if (figures.length === 0) {
                console.warn(`[blog] ${inputPath}: a \`::: scrolly\` block has no figure (an image on its own line, or a code block)`);
            }
            figures.forEach((_, index) => {
                if (!steps.some((step) => step.figure === index)) {
                    console.warn(`[blog] ${inputPath}: figure ${index + 1} in a \`::: scrolly\` block has no text after it, so it never shows; put the text after the figure`);
                }
            });

            // `{highlight}`: the SVG images go into the page, and each name must be a part of the figure of its card
            if (steps.some((step) => step.highlight?.length)) {
                figures.forEach(inlineSvgs);
                const parts = figures.map((figure) => new Set(figure.flatMap((token) => [token, ...(token.children ?? [])])
                    .flatMap((token) => partNames(token.content ?? ""))));
                steps.forEach((step) => step.highlight?.filter((name) => !parts[step.figure]?.has(name)).forEach((name) => {
                    console.warn(`[blog] ${inputPath}: \`{highlight}\` in a \`::: scrolly\` block names "${name}", but figure ${step.figure + 1} has no element with \`data-part="${name}"\``);
                }));
            }

            out.push(div(1, "scrolly"), div(1, "scrolly-steps"));
            steps.forEach((step) => out.push(
                div(1, "scrolly-step", {
                    "data-figure": step.figure,
                    ...(step.highlight ? { "data-highlight": step.highlight.join(" ") } : {})
                }),
                div(1, "scrolly-card"), ...step.tokens, div(-1), div(-1)
            ));
            out.push(div(-1), div(1, "scrolly-figures"));
            // the first figure shows before the reader gets to the first text, and if the script does not run
            figures.forEach((figure, index) => out.push(div(1, index === 0 ? "scrolly-figure is-active" : "scrolly-figure"), ...figure, div(-1)));
            out.push(div(-1), div(-1));

            i = close;
        }
        state.tokens = out;
    });
}
