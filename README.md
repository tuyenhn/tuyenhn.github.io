# tuyenhn.github.io

## Writing a blog post

1. Make a folder `blog/<slug>/`. The slug becomes the URL: `/blog/<slug>/`.
2. Write the post in `blog/<slug>/index.md` (or `index.mdx`):

   ```markdown
   ---
   title: My post title
   date: 2026-11-23
   thumbnail: cover.jpg       # optional; a file in this folder, an absolute path, or a full URL
   description: One or two lines for the blog list.   # optional
   ---

   # A section

   ## A subsection

   The text of the post, in Markdown. All headings are smaller than the post title.

   ![A plot](plot.png)
   ```

3. Put the images (thumbnail, figures) in the same folder, and link them with relative paths.
4. Preview with `npm run 11ty:watch`. Render with `npm run 11ty:build` before you commit: the watch server does not copy images into `docs/`.

Notes:

- Always set `date`. Without it, Eleventy uses the file creation date. The blog list shows the newest post first.
- Without `description`, the blog list shows the start of the post text (headings, code, and images are skipped), cut to two lines.
- Markdown is not run through Nunjucks or Liquid, so `{{ }}` in code (for example R tidy evaluation) stays as written. To use Nunjucks shortcodes such as `{% lucide "github" %}` in one post, add `templateEngineOverride: njk,md` to its front matter, and wrap code that contains `{{ }}` or `{% %}` in `{% raw %}…{% endraw %}`.
- A post opens in its own tab in the tab bar, next to "about me" and "blog". Open tabs stay until the visitor closes them (`×`) or closes the browser tab.
- `date: Render` sets the date to the day of the build (it changes on every render). `date: git Created` sets it to the day of the first commit of the post.

## Footnotes in a post

Footnotes get superscript numbers (¹ ² ³) and a numbered list at the end. Use them for notes and for sources:

```markdown
Not all hyperparameters are tune-able[^t], and not all have the same impact[^bischl].

[^t]: Tune-able means that the hyperparameter can take values from a domain.
[^bischl]: Bischl et al. (2021). *Hyperparameter Optimization*. <https://arxiv.org/abs/2107.05847>
```

- Put the definitions (`[^t]: ...`) anywhere in the post; they always show at the end, numbered in order of use. The label (`t`, `bischl`) is only a name; it does not show.
- Write the footnote mark directly after the word, with no space before it.
- Readers see a footnote in a small box when they hover over its number (keyboard: focus it; touch: the first tap shows the box, a second tap jumps to the list at the end).
- In `.mdx` posts, GitHub Markdown also works: tables, `~~strikethrough~~`, task lists.

## LaTeX math in a post

KaTeX renders the math at build time, in `.md` and `.mdx` posts:

```markdown
Inline: the loss $\mathcal{L}(\theta)$ is small.

Display (put `$$` on their own lines):

$$
\theta^* = \argmin_{\theta \in \Theta} f(\theta)
$$
```

- Math mode ignores spaces. Put words in `\text{}`: `$\text{ML algorithm} + \text{Data}$`.
- Write `\$` for a dollar sign in text. Code (`df$col`) is not affected.
- A LaTeX error shows in red in the post; the build does not stop.
- Shared macros (`\argmin`, `\argmax`) are in `katexOptions` in `eleventy.config.mjs`. Supported commands: <https://katex.org/docs/supported>.

## Progress tracker in a post

A post with two or more headings (`#`, `##`, `###`) shows a progress tracker at the right edge of the window, like the outline in Notion. You do not have to do anything in the post.

- Each heading has a short line. The deeper the heading, the shorter the line. The line of the section on the screen is dark. The lines of the sections above it are grey.
- Hover over the lines to see the headings in a box. Click a heading to go to its section. With the keyboard, press Tab after the tab bar.
- The tracker shows only on screens `md` (48rem) and wider. It does not show on paper.
- The tracker does not show `####` and deeper headings, the headings in a `<details>` box, or the hidden "Footnotes" heading.
- Each heading gets an `id` when the site is built (`## HPO basics` becomes `#hpo-basics`), so you can link to a section: `[see HPO basics](#hpo-basics)`. Two headings with the same text get `id` and `id-1`.
- The code: `_includes/progress-tracker.njk` (script), `.progress-tracker` in `assets/styles.css` (layout), and the heading ids in `eleventy.config.mjs` (`markdown-it-anchor` for `.md`, `rehype-slug` for `.mdx`).

## Presentation mode in a post

Each post has a "Reading mode" switch below its title: **Plain** or **Presentation**. You do not have to do anything in the post.

- Plain mode shows all of the post. It is the default.
- In presentation mode, the chunk of the post at the middle of the window is clear, and the other chunks are grey. The clear chunk changes when you scroll.
- A chunk is a heading and the text below it, to the next heading of any level (`#` to `######`). The text above the first heading is a chunk. The footnotes at the end are a chunk.
- A heading with no text below it, directly above a deeper heading (`# Part`, then `## Section`), is in the chunk of the deeper heading. Two headings of the same level with no text between them are two chunks.
- A `::: scrolly` block, a `<details>` box, and the headings in them are in the chunk of the heading above them. They do not start a new chunk.
- Near the top of the page, the first chunk is clear. Near the end of the page, the line that selects the chunk moves down to the bottom of the window, so that the last chunks can also be clear.
- A click on a link to a part of the post (in the progress tracker, `[see HPO basics](#hpo-basics)`, or the `↩` of a footnote) makes the chunk of that part clear, also when the link moves a short chunk to the top of the window. When you scroll again, the chunk at the middle of the window is clear again.
- The browser keeps the choice (localStorage). It is the same on all posts and on the next visit.
- Without JavaScript, the switch does not show. A post with only one chunk does not show the switch. On paper, nothing is grey.
- The code: `_includes/presentation-mode.njk` (script), the switch in `_includes/layouts/post.njk`, and `.reading-mode` and `[data-reading-mode="presentation"]` in `assets/styles.css`.

## Scrollytelling in a post

In a `::: scrolly` block, the figures stay in view while the text scrolls past them. Put each figure first, then its text:

````markdown
::: scrolly

![](bo-iteration-1.png)

We start with four random configurations. The surrogate model fits them.

The acquisition function then proposes the next configuration.

![](bo-iteration-2.png)

After one more evaluation, the surrogate is closer to the true function.

---

This card keeps the same figure.

```r
tuner <- tnr("mbo")
```

Now the code shows.

:::
````

- A figure is an image on its own line, a code block, or an HTML `<figure>`, `<img>`, `<picture>`, `<video>`, `<iframe>`, `<svg>`, or `<canvas>` block.
- The text after a figure belongs to that figure, until the next figure. All of it shows in one card. Text before the first figure belongs to the first figure.
- `---` starts a new card with the same figure.
- Figures with no text between them show together, as one figure (for example, two plots one above the other).
- The text can have everything that a post has: lists, math, footnotes, links. Display math (`$$`) stays in the text; it is not a figure.
- Put the text after its figure. A figure with no text after it never shows, and the build prints a warning. A block with no figure also gives a warning.
- On a wide post, the text is on the left and the figure on the right. On a narrow post (under 40rem, for example on a phone), the figure is at the top of the window and the text cards pass below it.
- A post can have more than one `::: scrolly` block. A `::: scrolly` block cannot be inside another one.
- Only in `.md` posts, not in `.mdx` posts.
- The code: `_config/scrolly.mjs` (Markdown to HTML), `_includes/scrolly.njk` (Scrollama, which changes the figure), and `.scrolly` in `assets/styles.css` (layout). `post.njk` loads Scrollama only on posts with a `::: scrolly` block. Scrollama is copied from `node_modules` into `docs/assets/vendor/` when the site is built.

### Highlight parts of one figure

One figure can stay in view while each card shows some parts of it and dims the other parts. Put `{highlight="name ..."}` on the first line of the card:

````markdown
::: scrolly

![](hpo-cv-loop.svg)

The whole loop. This card has no `{highlight}`, so it shows the full figure.

{highlight="tuning-space tuner propose"}
**1. Propose.** The tuner picks a configuration from the tuning space.

{highlight="train"}
**2. Train.** The algorithm is trained on the training set.

:::
````

- The names are the `data-part` values in the figure. In an SVG, put each part in a group: `<g data-part="tuner">...</g>`. Example: `blog/mlhpo-bayesopt-pareto/hpo-cv-loop.svg`.
- A part can have more than one name, with spaces between them. `data-part="cv train"` shows for `{highlight="train"}` and for `{highlight="cv"}`.
- Do not put a `data-part` group inside another `data-part` group. A dimmed group also dims the parts in it.
- Elements that are not in a `data-part` group (for example, a legend) are never dimmed.
- `{highlight="..."}` starts a new card, the same as `---`. The text can be on the next line or after a blank line.
- A card without `{highlight}` shows the full figure. `{highlight=""}` starts a new card that shows the full figure.
- The build prints a warning for a name that is not a `data-part` in the figure of the card.
- The build puts the SVG file into the page (in place of `![](x.svg)` or `<img src="x.svg">`), because CSS cannot change the parts of an SVG in an `<img>`. It does this only in a `::: scrolly` block that uses `{highlight}`, and only for SVG files in the post folder. It removes the comments of the SVG file.
- In the page, the SVG gets the page styles. Set the font, size, and colour of the SVG text with attributes in the SVG file. Do not add a `<style>` element to the SVG file, because its rules apply to the whole page.
- Without JavaScript, nothing is dimmed.

## Interactive figure in a post

A post can load its own script, for example a demo with buttons. Put the `.js` file in the post folder, and load it with a relative path:

```html
<figure class="my-demo">
<figcaption>The caption.</figcaption>
</figure>
<script src="my-demo.js" defer></script>
```

- The build copies the `.js` files in `blog/` into `docs/`, the same as the images.
- Do not put a blank line in the `<figure>` block. A blank line ends the HTML block, and the lines after it become Markdown text.
- Put the styles in `assets/styles.css`, not in a `<style>` element or a `style` attribute.
- Example: `blog/mlhpo-bayesopt-pareto/bo-demo.js` (Bayesian optimisation with a GP and LCB) and `.bo-demo` in `assets/styles.css`.
