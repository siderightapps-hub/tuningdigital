# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static HTML/CSS/JS site for tuningdigital.com — independent AI/SaaS tool reviews. No build step, no framework, no package.json. Files are served as-is from the repo root by GitHub Pages, fronted by Cloudflare (Free plan) for security headers, HTTP/3, edge caching, and Web Analytics RUM.

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

`main` is the deployed branch. Every push triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which uploads the entire repo root as the GitHub Pages artifact and deploys. There is no staging environment — `main` is production. Cloudflare proxies all responses from the origin; if a change isn't visible after deploy, check Cloudflare's edge cache (`cf-cache-status` header).

Three scheduled workflows:

| Workflow | Cron (UTC) | What it does |
|---|---|---|
| [generate-content.yml](.github/workflows/generate-content.yml) | `0 8 * * 1,4` (Mon + Thu 08:00) | Runs `content-engine.js batch 2`, commits the 2 new articles + sitemap.xml + feed.xml, pushes. The deploy auto-fires. Uses `ANTHROPIC_API_KEY` secret. |
| [post-to-x.yml](.github/workflows/post-to-x.yml) | `0 14 * * *` (daily 14:00) | Runs `.github/scripts/post-to-x.py` — tweets each unposted item from `feed.xml` to `@TuningDigital` via X API v2 (OAuth 1.0a). Capped at 5 posts per run, 60s gap between posts. Uses 4 `X_*` secrets. |
| deploy.yml | on push to main | Uploads repo as GH Pages artifact. |

> **Important: bot pushes don't trigger downstream workflows.** When `generate-content.yml` pushes via `GITHUB_TOKEN`, GitHub's loop-protection prevents `post-to-x.yml` from auto-triggering on that push. The daily 14:00 UTC schedule is the safety net that catches bot-generated articles ~6 hours after generation.

## Content generation architecture

Two engines, both Node.js CLIs that call the Claude Messages API. Share the same patterns and tokens:

- **[assets/js/content-engine.js](assets/js/content-engine.js)** — writes long-form comparison/list/guide articles to `/blog/<slug>.html`. Source of truth = `TOPIC_BANK` (38 entries with `type` and `category`).
- **[assets/js/tool-page-engine.js](assets/js/tool-page-engine.js)** — writes single-tool deep-dive reviews to `/reviews/<slug>-review.html`. Source of truth = `TOOL_BANK` (18 entries). Imports `TOPIC_BANK` from content-engine to cross-link reviews to relevant articles.

Both engines: extract FAQs from the generated HTML, emit FAQPage + Review + Speakable JSON-LD, auto-append to `sitemap.xml` and `feed.xml`, and use the centralised `CONFIG.authorName` ("Alex Bacsa") for byline + Person schema.

### Both engines — shared behaviour to preserve:

- **TOPIC_BANK / TOOL_BANK** (top of each file) is the canonical list. `slug` becomes the output filename. Adding a topic = adding an entry; the engine doesn't read any external data source.
- **Two-stage generation**: `buildPrompt()` asks Claude for inner article HTML only (no `<html>/<head>/<body>/<nav>/<footer>`), then `wrapInTemplate()` injects it into the full page shell with nav, footer, JSON-LD (Article + BreadcrumbList + Review + WebPage Speakable + FAQPage auto-extracted), GA4, AdSense, Consent Mode v2 init, breadcrumbs, and sidebar. Changes to nav/footer/meta tags for generated content must happen in `wrapInTemplate()`, not by editing existing article files (they won't be retroactively updated).
- **`CONFIG` constants are live** — `gaMeasurementId` (`G-LSE8074X3B`), `adsenseClient` (`ca-pub-1606633100797174`), `authorName` (`Alex Bacsa`), `authorRole` (`Founder & Editor`). Change `authorName` here to rename globally for future articles; existing files need a separate sed.
- **Sitemap + Feed auto-update**: `updateSitemap()` and `updateFeed()` append to `sitemap.xml` / `feed.xml` if the slug isn't already present. Preserve the insertion points when hand-editing those files.
- **FAQPage schema**: `extractFaqs()` greps the generated body for the H2 "Frequently Asked Questions" section, parses H3/Q + P/A pairs, emits a FAQPage JSON-LD block. Don't change the prompt's FAQ structure without updating the regex.
- **`require.main === module` guard** in content-engine.js: prevents the CLI block from firing when tool-page-engine.js imports `TOPIC_BANK` for cross-linking.
- **Anti-AI-detection prompt section**: both engines instruct Claude to write British English, vary sentence length, avoid AI-tell phrases ("However, it's worth noting", "On the other hand", overused em-dashes), and use concrete UK-context examples. Edit this section if Google's AI-detection signals shift.
- **Model**: currently pinned to `claude-opus-4-6`. The CLI runtime is on `claude-opus-4-7`, but the API call uses its own value — don't conflate them.

### tool-page-engine.js specifics:

- Imports `TOPIC_BANK` from content-engine.js for related-article cross-linking
- Uses `TOOL_BANK` for related-tool sidebar links
- `pricingFrom` regex extracts the leading dollar number for SoftwareApplication.offers.price schema (e.g. "Free / $20/mo" → "20", "Free" → "0")
- `websiteUrl` is currently the vendor's homepage — swap for affiliate tracking URL once each programme is approved (see Template.md §6.2)
- Output URL pattern: `/reviews/<slug>-review.html`

## Page conventions

All HTML pages (homepage, blog articles, tools, static pages) share the same shell pattern: `<nav class="navbar">` → `<main>` → `<footer>`, with `/assets/css/main.css` and `/assets/js/main.js` linked at the standard paths. When adding a new hand-written page, copy an existing one in the same category as a template rather than starting from scratch — the JSON-LD blocks, breadcrumb structure, AdSense slots, and meta tags are load-bearing for SEO/monetization.

- Blog articles live flat in `/blog/`, named `<slug>.html`. New articles must be added to [sitemap.xml](sitemap.xml) and linked from [blog/index.html](blog/index.html).
- Tool pages live flat in `/tools/`, self-contained (logic inline in a `<script>` tag at the bottom).
- [assets/js/main.js](assets/js/main.js) auto-attaches to elements by ID/class (`mobileToggle`, `newsletterForm`, `.article-body`, `.ad-slot`, etc.) — IDs in markup must match what `main.js` queries.

## CSS

Single stylesheet at [assets/css/main.css](assets/css/main.css) with CSS-variable design tokens at the top (`--bg`, `--accent`, `--font-display`, etc.). Use these tokens rather than hardcoding hex values when adding styles.

## Gotchas

- `SEO-BACKLINK-STRATEGY.md` is in [.gitignore](.gitignore) — it exists locally but is intentionally not in the repo. Don't try to commit it.
- The `assets/.DS_Store` / root `.DS_Store` showing as modified in `git status` is macOS noise; do not commit it.
- Articles use `<span>🔄 Updated regularly</span>` as the cadence signal in the byline. The previous `🔄 AI-assisted research` label was removed because it was an AdSense red flag (literal AI self-attestation). Don't reintroduce.
- The inline `<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>` after every `<ins>` is wrapped in `try/catch` because Safari (and AdSense itself) reports a `TagError: availableWidth=0` when push runs before layout completes. The real ad render happens via the lazy-loader in `main.js` (IntersectionObserver). Don't unwrap the try/catch.
- CSP is enforced at the Cloudflare edge via a Transform Rule ("Security Header"), not as a `<meta http-equiv>`. Adding a new external script/CSS/font source requires updating the CSP value in Cloudflare → Rules → Transform Rules → Modify Response Header, not in the HTML.
- `.x-posted.txt` is auto-committed by the post-to-x.yml workflow (`chore: record X post [skip ci]`). The `[skip ci]` suffix prevents the deploy workflow re-firing on every X post. Don't strip the suffix.
- AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) are intentionally **allowed** via permissive `robots.txt` + Cloudflare settings. This is the GEO/AEO strategy — we want to be cited. Don't reconfigure to block them.
- **`generate-content.yml` uses `git add` then `git diff --staged --quiet`** to decide whether to commit. The earlier `git diff --name-only | grep .html` pattern silently dropped untracked (new) files, causing the 2026-05-25 11:57 UTC run to generate 2 articles that were never committed (lost ~$0.20 of API spend). Don't revert.
- **Both engines filter the random picker to unpublished slugs only.** `getUnpublishedTopics()` (content-engine.js) and `getUnreviewedTools()` (tool-page-engine.js) read the output directory at runtime and exclude any slug already present as `<slug>.html` (or `<slug>-review.html`). `batch N` and unscoped `generate` only sample from the unpublished pool. Explicit `generate <slug>` bypasses the filter — that's the only way to intentionally refresh an existing article. Don't add a `--force` flag without thinking through whether random regenerations might overwrite hand-curated content.
- **`.x-posted.txt` was seeded with all 11 existing feed URLs at init (2026-05-24)** so the post-to-x workflow's "loop through unposted" logic doesn't burst-tweet historical content. Only articles published AFTER that seed trigger tweets. If you ever want to deliberately re-tweet an old article, remove its URL from `.x-posted.txt`.
- **GitHub Actions cron quirks:** schedules routinely delay 15min–3h on free runners (observed pattern). The first scheduled run after a cron-expression change can silently skip — the new schedule isn't registered in time for the original window, then the workflow exits "successfully" without running. Use `workflow_dispatch` to validate cron changes immediately rather than waiting for the next natural fire.
- **Cloudflare-side configuration lives in the dashboard, not the repo.** If the Cloudflare zone is ever deleted/migrated, the Transform Rule "Security Header" (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) must be recreated. The current CSP value is captured in [Template.md §13](../MD%20Files/TuningDigital/Template.md) as a copy-paste backup. The other 4 headers are short enough to recreate from memory: `SAMEORIGIN`, `nosniff`, `strict-origin-when-cross-origin`, `interest-cohort=(), browsing-topics=(), camera=(), microphone=(), geolocation=()`.

## Sister-publication network

Alex Bacsa also edits two other AI-assisted publications: [SalesTap.com](https://salestap.com) (B2B sales) and [CloudFintech.ai](https://cloudfintech.ai) (fintech). The three sites share the editor identity but are **editorially independent** — no syndication, no shared content, distinct domains. Linkages:

- **Person schema `sameAs`** in [about.html](about.html) declares the sister-publication editor URLs (`https://salestap.com/about#editor`, `https://cloudfintech.ai/author`). Article-level Person blocks emitted by `content-engine.js` / `tool-page-engine.js` point at this canonical Person via `url`, so the entity unification propagates without per-article changes.
- **Sister-publications footer block** is rendered on every existing HTML page (20 files) directly before `</footer>`, and is part of `wrapInTemplate()` in both engines so future articles inherit it. The block uses inline tokens that match the existing design system (`#1c2040` border, `#5c6488` muted text, JetBrains Mono uppercase).
- The historical pseudonym "Sam Carter" was replaced with the real editor name across HTML, JSON-LD, `feed.xml`, and engine `CONFIG`. **Do not reintroduce "Sam Carter" anywhere.** The honest editorial identity is the entire E-E-A-T basis for the cross-publication entity.
