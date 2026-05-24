# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static HTML/CSS/JS site for tuningdigital.com — independent AI/SaaS tool reviews. No build step, no framework, no package.json. Files are served as-is from the repo root by GitHub Pages.

## Commands

```bash
# Local preview (no build)
python3 -m http.server 8000          # then open http://localhost:8000

# Content engine — long-form articles to /blog/ (requires ANTHROPIC_API_KEY)
node assets/js/content-engine.js topics              # list TOPIC_BANK entries
node assets/js/content-engine.js generate            # random article
node assets/js/content-engine.js generate <slug>     # specific topic by slug
node assets/js/content-engine.js batch 5             # 5 random articles

# Tool-page engine — single-tool reviews to /reviews/<slug>-review.html
node assets/js/tool-page-engine.js tools             # list TOOL_BANK entries
node assets/js/tool-page-engine.js generate <slug>   # generate one review
node assets/js/tool-page-engine.js batch 3           # 3 random tool reviews
```

There is no test suite, linter, or formatter configured.

## Deployment

`main` is the deployed branch. Every push triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which uploads the entire repo root as the GitHub Pages artifact. There is no staging environment — `main` is production.

[.github/workflows/generate-content.yml](.github/workflows/generate-content.yml) runs `content-engine.js batch 1` every Monday 08:00 UTC, commits the new article with `[skip ci]` (so it does NOT auto-redeploy), and uses the `ANTHROPIC_API_KEY` repo secret.

## Content generation architecture

Two engines, both Node.js CLIs that call the Claude Messages API. Share the same patterns and tokens:

- **[assets/js/content-engine.js](assets/js/content-engine.js)** — writes long-form comparison/list/guide articles to `/blog/<slug>.html`. Source of truth = `TOPIC_BANK` (38 entries with `type` and `category`).
- **[assets/js/tool-page-engine.js](assets/js/tool-page-engine.js)** — writes single-tool deep-dive reviews to `/reviews/<slug>-review.html`. Source of truth = `TOOL_BANK` (18 entries). Imports `TOPIC_BANK` from content-engine to cross-link reviews to relevant articles.

Both engines: extract FAQs from the generated HTML, emit FAQPage + Review + Speakable JSON-LD, auto-append to `sitemap.xml` and `feed.xml`, and use the centralised `CONFIG.authorName` ("Sam Carter") for byline + Person schema.

### content-engine.js — important behaviour to preserve:

- **TOPIC_BANK** (top of file) is the canonical list of available articles. `slug` becomes the output filename (`blog/<slug>.html`). Adding a topic = adding an entry here.
- **Two-stage generation**: `buildPrompt()` asks Claude for inner article HTML only (no `<html>/<head>/<body>/<nav>/<footer>`), then `wrapInTemplate()` injects it into the full page shell with nav, footer, JSON-LD, GA4, AdSense, breadcrumbs, and sidebar. Changes to nav/footer/meta tags for generated articles must happen in `wrapInTemplate()`, not by editing existing article files (they won't be retroactively updated).
- **`CONFIG` constants are live** — `gaMeasurementId` (`G-LSE8074X3B`) and `adsenseClient` (`ca-pub-1606633100797174`) are the real IDs. The README still mentions `G-XXXXXXXXXX` / `ca-pub-XXXXXXXXXX` placeholders, but those have already been replaced in the engine and most pages.
- **Sitemap auto-update**: `updateSitemap()` appends a `<url>` entry to [sitemap.xml](sitemap.xml) before `</urlset>` if the slug isn't already present. When hand-editing the sitemap, preserve this insertion point.
- **Model**: currently pinned to `claude-opus-4-6`. The CLI runtime is on `claude-opus-4-7`, but the API call uses its own value — don't conflate them.

## Page conventions

All HTML pages (homepage, blog articles, tools, static pages) share the same shell pattern: `<nav class="navbar">` → `<main>` → `<footer>`, with `/assets/css/main.css` and `/assets/js/main.js` linked at the standard paths. When adding a new hand-written page, copy an existing one in the same category as a template rather than starting from scratch — the JSON-LD blocks, breadcrumb structure, AdSense slots, and meta tags are load-bearing for SEO/monetization.

- Blog articles live flat in `/blog/`, named `<slug>.html`. New articles must be added to [sitemap.xml](sitemap.xml) and linked from [blog/index.html](blog/index.html).
- Tool pages live flat in `/tools/`, self-contained (logic inline in a `<script>` tag at the bottom).
- [assets/js/main.js](assets/js/main.js) auto-attaches to elements by ID/class (`mobileToggle`, `newsletterForm`, `.article-body`, `.ad-slot`, etc.) — IDs in markup must match what `main.js` queries.

## CSS

Single stylesheet at [assets/css/main.css](assets/css/main.css) with CSS-variable design tokens at the top (`--bg`, `--accent`, `--font-display`, etc.). Use these tokens rather than hardcoding hex values when adding styles.

## Gotchas

- `SEO-BACKLINK-STRATEGY.md` is in [.gitignore](.gitignore) — it exists locally but is intentionally not in the repo. Don't try to commit it.
- The `assets/.DS_Store` showing as modified in `git status` is macOS noise; do not commit it.
- Articles generated by the engine have a `🔄 AI-assisted research` byline — keep that label honest if editing the template.
