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

Both engines: extract FAQs from the generated HTML, emit FAQPage + Speakable JSON-LD, auto-append to `sitemap.xml` and `feed.xml`, and use the centralised `CONFIG.authorName` ("Alex Bacsa") for byline + Person schema. Only **tool-page-engine.js** emits Review JSON-LD (genuine single-product reviews, real per-tool rating from `TOOL_BANK`); content-engine.js does **not** (see the no-blanket-Review note below).

### Both engines — shared behaviour to preserve:

- **TOPIC_BANK / TOOL_BANK** (top of each file) is the canonical list. `slug` becomes the output filename. Adding a topic = adding an entry; the engine doesn't read any external data source.
- **Two-stage generation**: `buildPrompt()` asks Claude for inner article HTML only (no `<html>/<head>/<body>/<nav>/<footer>`), then `wrapInTemplate()` injects it into the full page shell with nav, footer, JSON-LD (Article + BreadcrumbList + WebPage Speakable + FAQPage auto-extracted), GA4, AdSense, Consent Mode v2 init, breadcrumbs, and sidebar. Changes to nav/footer/meta tags for generated content must happen in `wrapInTemplate()`, not by editing existing article files (they won't be retroactively updated).
- **`CONFIG` constants are live** — `gaMeasurementId` (`G-LSE8074X3B`), `adsenseClient` (`ca-pub-1606633100797174`), `authorName` (`Alex Bacsa`), `authorRole` (`Founder & Editor`). Change `authorName` here to rename globally for future articles; existing files need a separate sed.
- **Sitemap + Feed auto-update**: `updateSitemap()` and `updateFeed()` append to `sitemap.xml` / `feed.xml` if the slug isn't already present. Preserve the insertion points when hand-editing those files.
- **Blog-index auto-card (content-engine.js only)**: `updateBlogIndex()` inserts a `.blog-card` at the `<!-- AUTO-CARDS -->` marker in `blog/index.html` (right after the featured post, so newest shows first) and a matching `.pill` at the `<!-- AUTO-PILLS -->` marker if that category has no filter pill yet. This exists because `blog/index.html` is hand-maintained and otherwise never auto-updates — before this, every bot-generated article became an orphan page (linked only from sitemap/feed). **The two marker comments are load-bearing**: don't delete them, and keep `data-category` (card) consistent with `data-filter` (pill) — `main.js` filters by exact-match. No-ops if the slug is already carded or the markers are missing. tool-page-engine.js has no equivalent yet (`reviews/index.html` is still hand-curated).
- **SaaS Calculator CTA auto-injection (content-engine.js only)**: `injectSaasCalculatorCta(topic, body)` runs between `callClaude()` and `wrapInTemplate()` in `generateArticle`. If the topic's title/keywords/category match `/saas|cost|spend|subscription|stack|consolidat/i`, it injects a `.calc-cta` callout (linking to `/tools/saas-cost-calculator.html`) right before the article's `<h2>Frequently Asked Questions</h2>` (or appends at the end if no FAQ). This converts relevant content traffic into tool usage — the calculator was launched on Product Hunt with zero response, so the new strategy is to make it the conversion mechanism inside articles. Three hand-written SaaS articles (`reduce-saas-spend-guide`, `best-free-saas-tools-startups`, `best-project-management-tools`) carry the same CTA manually. Keep the inline-styled markup self-contained (uses CSS vars but no new classes) so it works without touching main.css.
- **FAQPage schema**: `extractFaqs()` greps the generated body for the H2 "Frequently Asked Questions" section, parses H3/Q + P/A pairs, emits a FAQPage JSON-LD block. Don't change the prompt's FAQ structure without updating the regex.
- **`require.main === module` guard** in content-engine.js: prevents the CLI block from firing when tool-page-engine.js imports `TOPIC_BANK` for cross-linking.
- **Anti-AI-detection prompt section**: both engines instruct Claude to write British English, vary sentence length, avoid AI-tell phrases ("However, it's worth noting", "On the other hand", overused em-dashes), and use concrete UK-context examples. Edit this section if Google's AI-detection signals shift.
- **AEO / AI-citation prompt requirements** (added 2026-05-29 — the GEO/AI-citation push): both prompts mandate (1) a `<table class="compare-table">` — head-to-head for comparisons, summary/at-a-glance for single-tool reviews and lists — because tables are the most-cited element by AI answer engines and the `.compare-table` CSS (main.css ~L354) was already built but unused; (2) an answer-first opening sentence that an LLM can quote verbatim; (3) ≥2 concrete, **sourced** statistics — attributed in plain text (e.g. "per TechCrunch in 2023") NOT via a linked URL, paired with hard "NEVER invent a statistic" + "NEVER invent a URL" guards (see gotcha below — URL guard added 2026-05-30); (4) entity grounding (first mention of each tool links to its official site); (5) ≥2 headings phrased as natural-language questions. These build on the existing strength (already-cited 21× by ChatGPT). Don't strip the table requirement or the no-fabrication guard.
- **No blanket Review schema in content-engine.js** (removed 2026-05-29): the blog engine previously emitted a hardcoded `Review` with `ratingValue:"4.5"` and `itemReviewed` = the article title cast as a `SoftwareApplication` — on *every* article. Wrong for the 34/39 comparison/list/guide topics ("Ahrefs vs SEMrush" is not one app you rate 4.5), and an identical 4.5 across the whole site is the footprint Google's structured-data spam systems flag (rich-result suppression / manual-action risk) for zero AEO gain — FAQPage already earns the rich results here. Blog articles now carry Article + BreadcrumbList + WebPage Speakable + FAQPage only. **Don't re-add a Review/AggregateRating block to the blog engine.** Legitimate single-product reviews live in tool-page-engine.js, which emits a `SoftwareApplication` as the primary entity with `offers` **plus a nested single `review`** (real per-tool rating from `TOOL_BANK`, 4.4–5.0 spread). This exact structure is load-bearing for valid structured data (fixed 2026-05-29): a `Review` wrapping `itemReviewed:SoftwareApplication` leaves the SoftwareApplication node missing its required `offers` + `review`/`aggregateRating` fields → SEMrush/Google "invalid structured data" error. **Don't invert it back to Review-with-itemReviewed, and don't add a fake `aggregateRating`** (we have one editorial review, not an aggregate). The SaaS Cost Calculator is marked up as `WebPage` (not `WebApplication`) for the same reason — it's our own free tool, so it carries no self-rating.
- **Model**: currently pinned to `claude-opus-4-6`. The CLI runtime is on `claude-opus-4-7`, but the API call uses its own value — don't conflate them.

### tool-page-engine.js specifics:

- Imports `TOPIC_BANK` from content-engine.js for related-article cross-linking
- Uses `TOOL_BANK` for related-tool sidebar links
- `pricingFrom` regex extracts the leading dollar number for SoftwareApplication.offers.price schema (e.g. "Free / $20/mo" → "20", "Free" → "0")
- `websiteUrl` is currently the vendor's homepage — swap for affiliate tracking URL once each programme is approved (see Template.md §6.2)
- Output URL pattern: `/reviews/<slug>-review.html`

## Page conventions

All HTML pages (homepage, blog articles, tools, static pages) share the same shell pattern: `<nav class="navbar">` → `<main>` → `<footer>`, with `/assets/css/main.css` and `/assets/js/main.js` linked at the standard paths. When adding a new hand-written page, copy an existing one in the same category as a template rather than starting from scratch — the JSON-LD blocks, breadcrumb structure, AdSense slots, and meta tags are load-bearing for SEO/monetization.

- Blog articles live flat in `/blog/`, named `<slug>.html`. Bot-generated articles are auto-added to [sitemap.xml](sitemap.xml), [feed.xml](feed.xml), and [blog/index.html](blog/index.html) (via `updateBlogIndex()`). **Hand-written** articles must be added to all three manually, including a card under the `<!-- AUTO-CARDS -->` marker in blog/index.html — otherwise the page is orphaned (a recurring SEMrush audit error).
- Tool pages live flat in `/tools/`, self-contained (logic inline in a `<script>` tag at the bottom).
- [assets/js/main.js](assets/js/main.js) auto-attaches to elements by ID/class (`mobileToggle`, `newsletterForm`, `.article-body`, `.ad-slot`, etc.) — IDs in markup must match what `main.js` queries.

## Design system (calibration palette + dial mark)

The site adopted a new design language on 2026-06-07. Single stylesheet at [assets/css/main.css](assets/css/main.css). All values defined as CSS variables at the top.

**Design tokens (source of truth)** — `oklch()` colorspace, perceptually uniform:

| Token | Value | Use |
|---|---|---|
| `--ink` | `oklch(0.215 0.018 256)` | Dark navy. Body text on paper, dark surfaces (hero, footer, methodology card). |
| `--ink-2` / `--ink-3` | lighter navy variants | Hover states on dark surfaces |
| `--slate` / `--slate-2` | `oklch(0.30 / 0.47 .03 252)` | Muted text |
| `--blue` | `oklch(0.56 0.13 252)` | Secondary accent (mono-tile backgrounds, scorebar) |
| `--cyan` | `oklch(0.74 0.105 215)` | Accent — the dial needle, gauge fills, primary CTA on dark. Sparingly used. |
| `--paper` / `--paper-2` / `--paper-3` | off-whites | Page background + surface elevation |
| `--line` / `--line-2` | oklch greys | Borders + dividers |
| `--accent-ink` | `oklch(0.30 0.06 230)` | "Accent-on-paper" — for hover/active states on light bg where pure cyan would be too pale |

**Back-compat aliases** preserved so older HTML keeps rendering: `--bg → --paper`, `--accent → --cyan`, `--text → --ink`, `--surface → --paper`, `--border → --line`, etc. Existing pages inherit the new look without per-file CSS edits.

**Fonts**: `--font-display` + `--font-body` are both Hanken Grotesk (the same family handles both display and body — design choice). `--font-mono` is IBM Plex Mono. The `@import` is at the top of main.css; pages don't need separate `<link>` tags. **Don't add Syne, DM Sans, or JetBrains Mono back** — those were the pre-2026-06-07 brand stack and have been fully replaced.

**Brand mark — the tuning dial**: rendered by JS into every `<span class="dial-slot" data-dial="N" data-tone="ink|paper">`. The renderer lives in [assets/js/main.js](assets/js/main.js) (`dialSVG()`). Composed of: outer circle ring + four quarter-tick marks + cyan needle at -45° + paper hub. The same geometric primitive (different scale) is the favicon ([assets/img/favicon.svg](assets/img/favicon.svg)) AND every LinkedIn asset AND the **score gauge** rendered on review cards (`<div class="gauge" data-score="8.7" data-size="52">`). The mark *means* something — calibration, tuning, signal — and the gauge is just the brand mark dialed to a score. Don't replace either with a different shape; the unification is load-bearing for the editorial positioning.

## Brand assets

Operator-facing brand assets (off-site uploads — LinkedIn, X, press kits, etc.) live under [brand/](brand/). The favicon and og-image are still under `assets/img/` because those are *site* assets (linked from HTML); `brand/` is for things you upload elsewhere.

- **[brand/linkedin/](brand/linkedin/)** — LinkedIn Company Page assets at exact-pixel spec, regenerated 2026-06-07 with the dial mark. **Live on the Company Page since 2026-06-08.**
  - `logo.png` (400×400) — ink-navy square (the SVG carries rounded corners; the PNG is plain square for LinkedIn's circle-crop in feed). Centered dial mark: paper ring + four ticks + cyan needle + paper hub. Stays recognisable at LinkedIn's 60×60 feed crop.
  - `banner.png` (1128×191) — paper cover, dial mark on the left + "Tuning Digital" wordmark in Hanken Grotesk Bold + "Independent AI & SaaS tool reviews." tagline in Hanken Grotesk Regular.
  - SVG sources (`logo.svg`, `banner.svg`) committed alongside the PNGs so they're editable in any vector tool / re-renderable at different sizes (e.g. a 1584×396 personal-banner variant later).

- **[brand/x/](brand/x/)** — X (Twitter) @TuningDigital Company assets, generated 2026-06-08. **Live on the X profile since 2026-06-08** (profile pic + header banner + bio all updated in one pass).
  - `profile.png` (400×400) — **identical** to the LinkedIn logo file (same square, same dial, same paper ring + cyan needle). Cross-network brand consistency: the small avatar reads the same on LinkedIn feed crops, X feed crops, and any other surface that does circle-crops at small sizes.
  - `header.png` (1500×500) — dark ink hero (matches the site's `.hero` section). Centered composition: dial mark + "INDEPENDENT · AI & SAAS REVIEWS · EST 2026" kicker (IBM Plex Mono Medium) + "Tuning Digital" wordmark (Hanken Grotesk Bold) + tagline (Hanken Grotesk Regular). Composition is biased ~80px right of horizontal center and ~30px above vertical center to keep the bottom-left profile-pic overlay zone (~250×250) visually clean.
  - SVG sources alongside both PNGs.
  - **X bio copy** (paste into x.com/TuningDigital → Edit profile): *"Independent reviews of the AI and SaaS tools founders actually use. No sponsored coverage. Editorial rankings never for sale. New reviews Mon + Thu."* (146 chars, fits the 160 cap).

**Asset build approach** (not checked in — build scripts were throwaways at `/tmp/build_linkedin_assets.py` and `/tmp/build_x_assets.py`): downloads Hanken Grotesk Bold + Regular (and IBM Plex Mono Medium for the X header kicker) from Google Fonts' CSS2 endpoint with the `text=` query param (which subsets the font to *only* the glyphs we render — single @font-face block per family, ~6–11 KB each, guaranteed to contain our characters); decompresses woff2 → TTF via `fontTools` + `brotli`; composes with Pillow at exact pixel dimensions. The dial geometry inside the Python `draw_dial()` is identical across both scripts and matches `assets/img/favicon.svg` exactly so the mark reads the same at 16px, 60px, 400px, and the header's 120px version. **Gotcha for re-rendering**: without `text=`, Google Fonts returns multiple unicode-range subsets per family (latin / latin-ext / etc) and matching the wrong block leaves Pillow with `.notdef` glyphs (all boxes — see the failed first attempt 2026-06-07). **Second gotcha**: the `text=` subset is case-sensitive — include uppercase AND lowercase versions of every letter in any rendered string. The X build hit this on round 1 when "INDEPENDENT · REVIEWS" lost N/P/D/R/V/W glyphs because only the lowercase variants were in the charset. When in doubt, concatenate every literal string used (e.g. `WORDMARK + " " + TAGLINE + " " + KICKER`) and pass that as `text=`.

LinkedIn Company Page URL: `https://linkedin.com/company/tuningdigital`. X handle: `https://x.com/TuningDigital`. Description / tagline / specialties / bio copy is set on each platform itself (not in the repo) — if any ever needs revising, the brand-voice rules (British English, no AI-tell phrases, editorial tone, no sponsored placements / inflated rating claims / fabricated subscriber counts) apply. **The X bio + LinkedIn description currently lead with the same durable claim**: *"No sponsored coverage. Editorial rankings never for sale."* — true today, true after affiliates activate. Don't add "no affiliate deals" anywhere ever; that line was on the X bio + homepage hero briefly until the disclosure sweep caught it on 2026-06-08 (it conflicts with the per-article disclosure policy below).

## Editorial disclosure policy (affiliate / sponsored)

Aligned site-wide on 2026-06-08 (commits `c44c872` + `c507027`) after the X bio's "No affiliate deals" line was found to contradict 9+ articles' "may earn a commission" disclosures.

**Current reality**: zero affiliate programmes are active. Sponsored coverage is never accepted. AdSense is the only live revenue stream.

**Durable claim** (carried on hero, footer, X bio, LinkedIn description, every article footer): *"No sponsored coverage. Editorial rankings never for sale."* — true today, true after affiliates activate, no rewrite needed.

**Editorial note callout** — emitted at the top of every article (existing + future cron output). The EXACT HTML, identical everywhere:

```html
<div class="callout callout-accent">
<strong>Editorial note:</strong> Tuning Digital currently runs no active affiliate programmes — every recommendation here is based on hands-on testing, not commission relationships. If affiliate links are added in future, each one will be marked clearly. Editorial rankings are never for sale.
</div>
```

This block is hard-coded into both engine prompts (content-engine.js + tool-page-engine.js, in the FORMATTING REQUIREMENTS section). Claude is instructed to emit it **verbatim, no paraphrasing** at structure position 1 of every article. When you eventually approve the first affiliate programme, update this single block in both engine prompts and the change propagates to all future cron articles in one edit.

**Page footer** (every static page + both engine `wrapInTemplate()` footers):

```
© 2026 Tuning Digital. No sponsored coverage. Editorial rankings never for sale.
```

**Privacy policy §3** ([privacy-policy.html](privacy-policy.html#affiliate)) and **about.html "How We Make Money" + "Editorial Standards"** sections also reflect this. They explicitly state "(planned, not currently active)" for affiliates and invite readers to email `hello@tuningdigital.com` for confirmation on any specific link.

**Don't reintroduce anywhere**: blanket "may earn a commission" / "Affiliate disclosure" / "Some links are affiliate links" / "No affiliate deals" phrasing. The first three become false the moment a single affiliate link is added without per-link disclosure; the fourth becomes false the moment any affiliate programme activates. The durable claim above is the only thing that's permanently true.

## Newsletter (Resend + Cloudflare Worker)

Migrated from beehiiv to Resend on 2026-06-04. Architecture:

```
[native <form id="newsletterForm">] ─POST→ tuningdigital.com/api/subscribe
                                              │
                                              ▼
                                    [Cloudflare Worker: tuningdigital-subscribe]
                                       (code: /cloudflare-worker/)
                                              │
                                              ├─ POST  api.resend.com/audiences/{id}/contacts
                                              └─ POST  api.resend.com/emails  (welcome, fire-and-forget via ctx.waitUntil)

[user clicks "Unsubscribe" in welcome email]
            │
            ▼
   unsub.tuningdigital.com/?email=…&token=…   (Worker Custom Domain — same Worker)
            │
            └─ PATCH api.resend.com/audiences/{id}/contacts/{email}  { unsubscribed: true }
                            ↓
                    cream confirmation page returned
```

Key files / config:
- **[cloudflare-worker/worker.js](cloudflare-worker/worker.js)** — single Worker handles both subscribe and unsubscribe via hostname-based dispatch (`unsub.tuningdigital.com` → unsubscribe; otherwise the path-based subscribe handler).
- **[cloudflare-worker/wrangler.toml](cloudflare-worker/wrangler.toml)** — declares the subscribe Routes (`tuningdigital.com/api/subscribe` + www). The unsubscribe Custom Domain (`unsub.tuningdigital.com`) is configured in the CF dashboard, NOT in wrangler.toml.
- **Worker secrets** (set via `wrangler secret put`): `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` (= `6a716b66-d9d6-4c13-aa2c-564b70c8dd50` for the "General" audience), `UNSUBSCRIBE_SECRET` (any ≥32-char random string — signs HMAC tokens for unsubscribe URLs so they can't be forged).
- **Welcome email** is sent via Resend's `/emails` API (transactional). Brand-matched cream + blue HTML body + plain-text fallback, with both an in-body unsubscribe link and RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` headers (Gmail / Apple Mail render a native "Unsubscribe" button at the top of the email).
- **Front-end**: `.newsletter-form` component in main.css; `newsletterForm` AJAX handler in main.js (POSTs to `/api/subscribe` with honeypot field + inline success/error status messaging + GA4 event). Both engines' wrapInTemplate emit the same form so future cron articles inherit it.
- **Auto-broadcast pipeline** (engine cron → Resend `/broadcasts` after each article generation) is NOT built — tracked as R381 in the project tracker, low-priority until subscriber count justifies it.

## Gotchas

- `SEO-BACKLINK-STRATEGY.md` is in [.gitignore](.gitignore) — it exists locally but is intentionally not in the repo. Don't try to commit it.
- The `assets/.DS_Store` / root `.DS_Store` showing as modified in `git status` is macOS noise; do not commit it.
- Articles use `<span>🔄 Updated regularly</span>` as the cadence signal in the byline. The previous `🔄 AI-assisted research` label was removed because it was an AdSense red flag (literal AI self-attestation). Don't reintroduce.
- The inline `<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>` after every `<ins>` is wrapped in `try/catch` because Safari (and AdSense itself) reports a `TagError: availableWidth=0` when push runs before layout completes. The real ad render happens via the lazy-loader in `main.js` (IntersectionObserver). Don't unwrap the try/catch.
- CSP is enforced at the Cloudflare edge via a Transform Rule ("Security Header"), not as a `<meta http-equiv>`. Adding a new external script/CSS/font source requires updating the CSP value in Cloudflare → Rules → Transform Rules → Modify Response Header, not in the HTML. **Beehiiv directives were removed on 2026-06-04** as part of the Resend migration — the live CSP no longer contains `https://subscribe-forms.beehiiv.com`, `https://embeds.beehiiv.com`, `https://*.beehiiv.com`. Don't re-add. The Worker fetch happens same-origin (`/api/subscribe`) so no `connect-src` change was needed; the unsubscribe page is rendered by the Worker itself on `unsub.tuningdigital.com` so it doesn't need to appear in the main site's CSP either.
- `.x-posted.txt` is auto-committed by the post-to-x.yml workflow (`chore: record X post [skip ci]`). The `[skip ci]` suffix prevents the deploy workflow re-firing on every X post. Don't strip the suffix.
- AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) are intentionally **allowed** via permissive `robots.txt` + Cloudflare settings. This is the GEO/AEO strategy — we want to be cited. Don't reconfigure to block them.
- **`generate-content.yml` uses `git add` then `git diff --staged --quiet`** to decide whether to commit. The earlier `git diff --name-only | grep .html` pattern silently dropped untracked (new) files, causing the 2026-05-25 11:57 UTC run to generate 2 articles that were never committed (lost ~$0.20 of API spend). Don't revert.
- **Both engines filter the random picker to unpublished slugs only.** `getUnpublishedTopics()` (content-engine.js) and `getUnreviewedTools()` (tool-page-engine.js) read the output directory at runtime and exclude any slug already present as `<slug>.html` (or `<slug>-review.html`). `batch N` and unscoped `generate` only sample from the unpublished pool. Explicit `generate <slug>` bypasses the filter — that's the only way to intentionally refresh an existing article. Don't add a `--force` flag without thinking through whether random regenerations might overwrite hand-curated content.
- **`.x-posted.txt` was seeded with all 11 existing feed URLs at init (2026-05-24)** so the post-to-x workflow's "loop through unposted" logic doesn't burst-tweet historical content. Only articles published AFTER that seed trigger tweets. If you ever want to deliberately re-tweet an old article, remove its URL from `.x-posted.txt`.
- **GitHub Actions cron quirks:** schedules routinely delay 15min–3h on free runners (observed pattern). The first scheduled run after a cron-expression change can silently skip — the new schedule isn't registered in time for the original window, then the workflow exits "successfully" without running. Use `workflow_dispatch` to validate cron changes immediately rather than waiting for the next natural fire.
- **Cloudflare-side configuration lives in the dashboard, not the repo.** If the Cloudflare zone is ever deleted/migrated, the Transform Rule "Security Header" (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) must be recreated. The current CSP value is captured in [Template.md §13](../MD%20Files/TuningDigital/Template.md) as a copy-paste backup. The other 4 headers are short enough to recreate from memory: `SAMEORIGIN`, `nosniff`, `strict-origin-when-cross-origin`, `interest-cohort=(), browsing-topics=(), camera=(), microphone=(), geolocation=()`.
- **Related-content cross-links must point only at PUBLISHED pages.** The engines' `pickRelatedTopics`/`pickRelatedTools`/`pickRelatedArticles` filter to slugs that actually exist on disk, and both prompts forbid Claude from inventing internal URLs. This fixed a 16×404 site-audit error (2026-05-27, commit `1bbc680` — see Template.md §16.1 #9). Don't change a picker to draw from the full bank — always intersect with on-disk files, or you'll resurrect the 404s.
- **External vendor links default to DOFOLLOW editorial (rel="noopener" only) — not `nofollow sponsored`.** Both engine prompts previously told Claude to tag every vendor URL with `rel="noopener nofollow sponsored"` as an "affiliate placeholder" for when programmes are approved. Result: 82 nofollow/sponsored tokens across 8 engine-generated articles, all on legit editorial entity-grounding links (Notion, Zapier, Ahrefs, etc.) with zero affiliate programmes actually active. SEMrush flagged them as a "Notice" but more importantly it kills E-E-A-T (a publication that nofollows every external citation looks like a link farm). Fix (2026-06-03): both prompts now default to plain `rel="noopener"`; `nofollow sponsored` is ONLY added when a URL is an active affiliate link (currently NONE). **Don't reintroduce blanket `nofollow sponsored` on vendor URLs** — apply it per-link, only when an affiliate programme is genuinely approved.
- **External citation URLs: plain-text attribution only — Claude WILL invent article URLs otherwise.** Both engine prompts now explicitly restrict external links to (a) the named tool's own domain (homepage/pricing/docs), and (b) sister-publication URLs (salestap.com, cloudfintech.ai) — see audience-overlap scoping note in the Sister-publication network section below for why Beat the Scam is intentionally **excluded** from the in-article whitelist. Third-party publication articles (Verge, TechCrunch, Wired, etc.) must be cited in **plain text** ("per TechCrunch in 2023") with NO link. Background (2026-05-30): the original AEO prompt asked Claude to "attribute each statistic to its source via the surrounding link" — Claude obliged by hallucinating plausible-looking but non-existent article URLs (`theverge.com/.../notion-100-million-users-ai`, `techcrunch.com/.../zapier-reportedly-valued-at-5-billion`, etc.). SEMrush flagged 8 broken external links; 6 were engine-fabricated, the rest hand-written stale. The fix: remove the "via the surrounding link" instruction + add a hard ⚠️ NEVER invent a URL bullet listing the only allowed external destinations. **Don't reintroduce the "link the source" wording** — Claude has no way to verify article URLs exist, and fabricated citations destroy both SEO (broken links) and editorial credibility (false attribution).
- **Cloudflare Workers: use Custom Domains, not pattern-based Routes, for new paths added after first deploy.** Lesson from the Resend migration (2026-06-04, ~3h debug). The Worker initially deployed clean on `tuningdigital.com/api/subscribe`. Adding `/api/unsubscribe` afterwards: the route appeared in the dashboard, `wrangler deploy` succeeded, but traffic to the new path 1016'd / fell through to Pages instead of hitting the Worker. Persisted through: multiple `wrangler deploy` rounds, manual route delete + re-add via dashboard, full CF cache purge, Worker delete + fresh recreate, path renames (`/u`, etc.). What worked: switching unsubscribe to a Worker **Custom Domain** (`unsub.tuningdigital.com`) — that uses DNS-bound routing (a hidden orange-clouded A record points the hostname at the Worker), not Route pattern-matching. First try, no friction. So: subscribe is a Route (it MUST live on the apex), unsubscribe is a Custom Domain. **Rule of thumb: if you need to add a new Worker endpoint and don't have to keep it on the apex, give it its own subdomain via Custom Domain.** Both surfaces are dispatched inside one Worker via `request.url` hostname check (`unsub.tuningdigital.com` → unsubscribe handler; otherwise path-based subscribe).
- **Don't escape backticks when editing the Worker JS.** `worker.js` uses template literals heavily (`` `Bearer ${env.RESEND_API_KEY}` ``, multi-line HTML). The Edit tool has previously over-escaped these into `\`Bearer \${…}\`` which causes a deploy-time syntax error that wrangler reports as a parse failure at the line in question. If wrangler ever rejects a Worker change with `SyntaxError: Unexpected token`, grep the edited region for backslash-backtick / backslash-dollar.
- **Resend secrets must be pasted raw (no surrounding whitespace).** `RESEND_AUDIENCE_ID` is a bare UUID — `6a716b66-d9d6-4c13-aa2c-564b70c8dd50`. A trailing newline or space causes `wrangler secret put` to store the padded value and the API rejects requests with `The id must be a valid UUID`. If unsubscribe ever starts 400'ing on a known-good email, that's the first thing to check (`wrangler secret list` shows hashes only, so the way to confirm is to re-put the value).
- **`cloudflare-worker/` is intentionally outside the GitHub Pages deploy.** GH Pages serves the repo root, so anything in subdirectories with HTML/JS will be published. The Worker code is JS but lives at a directory path (`/cloudflare-worker/worker.js`) that's not linked from any page, has no index.html, and the deploy path doesn't strip it — which is fine because the file is harmless if served. We deploy the Worker via `cd cloudflare-worker && wrangler deploy`, not via the GH Pages workflow. If you ever migrate to a build pipeline with explicit `paths-ignore`, add `cloudflare-worker/**`.
- **Social URLs are duplicated across many surfaces — keep them canonical.** The X (`https://x.com/TuningDigital`) and LinkedIn Company (`https://linkedin.com/company/tuningdigital`) URLs appear in: every page's footer `social-btn` block, the Organization JSON-LD `sameAs` array on `index.html` + `about.html`, the same Organization block emitted by both engines' `wrapInTemplate()`, and the cross-reference table in README.md. If either handle ever changes, grep for the URL and update all surfaces in one sweep. **Canonical forms**: `https://x.com/TuningDigital` (capital T, capital D — case matches the registered handle even though X handles are case-insensitive in practice) and `https://linkedin.com/company/tuningdigital` (all-lowercase, no trailing slash in `sameAs` blocks — LinkedIn auto-redirects). The old `twitter.com/tuningdigital` form was swept out on 2026-06-07; don't reintroduce it (X redirects but it's a stale brand signal in schema.org `sameAs`).
- **`.mobile-nav` must default to `display: none`.** Every page renders a `<div class="mobile-nav">…</div>` directly after the navbar containing duplicated nav links + the CTA button. If the CSS rule for `.mobile-nav { display: none }` is missing (it's easy to drop on a main.css rewrite), the duplicated nav renders **inline on desktop** as plain unstyled text under the navbar — caught on live preview 2026-06-08. The `.mobile-nav.open` state is what the hamburger toggle in main.js flips to show it on mobile. The rule lives in main.css right after `.nav-mobile-toggle` and includes `position: fixed; top: 68px; z-index: 35` so it overlays content cleanly when open.
- **Score gauges (`<div class="gauge">`) accept `data-max`** — defaults to `/10` to match the new design's leaderboard convention but TOOL_BANK ratings are `/5`. Always pass `data-max="5"` on gauges that source TOOL_BANK ratings, otherwise a 5.0 reads as 50% filled. The small label inside the gauge auto-shows `"/ N"` (e.g. `"/ 5"`) for `data-size >= 58` so the scale is unambiguous. The leaderboard scorebars on the homepage are still rendered as inline `<i style="width:XX%">` widths (not gauges) — those percentages are already `/5`-correct.
- **Flex `<li>` + `<strong>` + trailing text node becomes 3 flex items.** Hit on `.feature-strengths` bullets 2026-06-08. When an `<li>` uses `display:flex` with `align-items:flex-start; gap:Npx`, every direct child — including the `::before` pseudo-element, the `<strong>` element, AND the anonymous text node after it — becomes a flex item with the gap between each. Result: "200k-token context" / "— drops in entire codebases…" renders as two columns with a huge gap, not one sentence. Fix: don't use `display:flex` on list items that need inline-flowing text. Position the bullet with `position: absolute; left: 0` on `::before` and pad-left the `<li>` instead.
- **The `.feature-card` (hero editor's pick) has no `.feature-shot` image area.** Earlier homepage builds had a 16:9 `.ph` placeholder block at the top of the card — purely decorative diagonal-stripe pattern with zero information. Caused "this card is mostly empty" feedback during the 2026-06-08 polish pass. Current structure: `.feature-ribbon` (dark ink header with `Editor's pick · <category>` text and subtle accent-ink radial gradient) + `.feature-body` (mono-tile + name + 84px gauge + verdict + 3-bullet `.feature-strengths` + foot row). `.feature-shot` is kept in main.css as `display:none` for back-compat in case any off-homepage page still references it; don't reintroduce the diagonal-stripe placeholder.

## Sister-publication network

Alex Bacsa also edits three other publications: [SalesTap.com](https://salestap.com) (B2B sales), [CloudFintech.ai](https://cloudfintech.ai) (fintech), and [BeatTheScam.com](https://beatthescam.com) (UK consumer protection & scam awareness). The four sites share the editor identity but are **editorially independent** — no syndication, no shared content, distinct domains.

**Audience-overlap scoping for cross-network surfaces** (mirrors the same principle SalesTap uses): the cross-network signal happens on **two surfaces** — (a) the footer "Sister publications" block + Person `sameAs` schema, which carry network/entity signals regardless of topic relevance, and (b) the engine prompt's in-article citation whitelist, which Claude can use to drop contextual links inside generated articles. **Surface (a) gets all sister pubs; surface (b) is restricted by audience overlap.** Beat the Scam (UK consumer scam awareness) has **zero** audience overlap with AI/SaaS tool reviews — auto-injecting consumer-protection links into a Notion-vs-Roam comparison would look like link-stuffing and hurt relevance. So Beat the Scam is **intentionally absent** from both engines' in-article whitelist (it sits in footer + sameAs only). Don't add it back to the prompt allowlist. (CloudFintech sits in the in-article whitelist for historical reasons; if you ever scope strictly to "AI/SaaS audience overlap only," that's the next candidate to evaluate.)

Linkages:

- **Person schema `sameAs`** in [about.html](about.html) declares the sister-publication editor URLs (`https://salestap.com/about#editor`, `https://cloudfintech.ai/author`, `https://beatthescam.com/author/`). Article-level Person blocks emitted by `content-engine.js` / `tool-page-engine.js` point at this canonical Person via `url`, so the entity unification propagates without per-article changes.
- **Sister-publications footer block** is rendered on every existing HTML page (20 files) directly before `</footer>`, and is part of `wrapInTemplate()` in both engines so future articles inherit it. The block uses inline tokens that match the existing design system (`#1c2040` border, `#5c6488` muted text, JetBrains Mono uppercase).
- The historical pseudonym "Sam Carter" was replaced with the real editor name across HTML, JSON-LD, `feed.xml`, and engine `CONFIG`. **Do not reintroduce "Sam Carter" anywhere.** The honest editorial identity is the entire E-E-A-T basis for the cross-publication entity.
