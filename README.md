# Tuning Digital — tuningdigital.com

> Independent reviews and comparisons of AI & SaaS productivity tools.
> AdSense (live) · Affiliate programmes planned, none active · No sponsored coverage · Static site · GitHub Pages + Cloudflare front

**Site is live.** This README is the operator runbook for ongoing maintenance, not initial setup.

**Editor:** Alex Bacsa, Founder & Editor (real-name identity since 2026-05-26; do NOT reintroduce the earlier "Sam Carter" placeholder).

**Sister publications** (same editor, distinct editorial focus, linked via Person `sameAs` + sister-pubs footer block):
[SalesTap.com](https://salestap.com) (B2B sales) · [CloudFintech.ai](https://cloudfintech.ai) (fintech) · [BeatTheScam.com](https://beatthescam.com) (UK consumer protection)

For full project context (architecture, credentials, editorial standards, agenda), see [Template.md](../MD%20Files/TuningDigital/Template.md). For Claude Code session guidance, see [CLAUDE.md](CLAUDE.md).

---

## 🗂 Project structure

```
tuningdigital/
├── index.html                          ← Homepage
├── about.html                          ← About + editorial standards + "How We Use AI"
├── contact.html                        ← 4-channel contact (general / privacy / sponsorship / security)
├── privacy-policy.html                 ← GDPR + cookie policy + Editorial note (affiliate stance)
├── 404.html
├── ads.txt                             ← AdSense ownership claim
├── robots.txt                          ← Permissive — AI crawlers explicitly allowed (GEO/AEO)
├── llms.txt                            ← AI crawler site descriptor (ChatGPT/Perplexity/Gemini/Claude)
├── sitemap.xml                         ← Auto-extended by content + tool engines
├── feed.xml                            ← RSS 2.0 — drives X auto-post; auto-extended by engines
├── manifest.json
├── .x-posted.txt                       ← State file: URLs already auto-tweeted (don't edit by hand)
├── .well-known/
│   └── security.txt                    ← RFC 9116 vuln disclosure contact
├── blog/
│   ├── index.html                      ← Blog listing
│   └── <slug>.html                     ← Generated articles (currently 10)
├── reviews/
│   ├── index.html                      ← Reviews landing page
│   └── <slug>-review.html              ← Single-tool reviews (currently 1: Claude)
├── tools/
│   ├── index.html                      ← Tools directory
│   └── saas-cost-calculator.html       ← Interactive calculator
├── assets/
│   ├── css/main.css                    ← Single global stylesheet + design tokens
│   ├── js/
│   │   ├── main.js                     ← Shared front-end JS (nav, filter, cookie banner, lazy-load ads)
│   │   ├── content-engine.js           ← Article generator (TOPIC_BANK, 38 entries)
│   │   └── tool-page-engine.js         ← Tool review generator (TOOL_BANK, 18 entries)
│   └── img/
│       ├── favicon.svg
│       ├── og-image.jpg
│       └── social/
│           ├── x-profile.svg           ← 400×400 — convert to PNG before uploading to X
│           └── x-banner.svg            ← 1500×500 — same
└── .github/
    ├── workflows/
    │   ├── deploy.yml                  ← Push-to-deploy GitHub Pages
    │   ├── generate-content.yml        ← Article generation (Mon + Thu 08:00 UTC, batch 2)
    │   └── post-to-x.yml               ← Auto-tweet new articles (daily 14:00 UTC)
    └── scripts/
        └── post-to-x.py                ← OAuth1.0a tweet poster, called by post-to-x.yml
```

---

## 🤖 Automation cadence (what runs on its own)

| Workflow | Schedule (UTC) | Schedule (BST) | What it does |
|---|---|---|---|
| `generate-content.yml` | `0 8 * * 1,4` (Mon + Thu 08:00) | Mon + Thu 09:00 | Generates 2 articles via `content-engine.js batch 2`, commits to main, deploy auto-fires |
| `post-to-x.yml` | `0 14 * * *` (daily 14:00) | daily 15:00 | Tweets each new article from `feed.xml` to `@TuningDigital`, 60s apart, capped at 5/run |
| `deploy.yml` | on push to main | — | Uploads repo root as GH Pages artifact, deploys |

Net effect: every Monday and Thursday morning you get 2 new articles. Six hours later they auto-tweet at peak UK + US-East engagement time. Zero manual intervention.

---

## ✍️ Manual content generation (when you want extras)

Requires `ANTHROPIC_API_KEY` exported in your shell (also persisted in GitHub repo secrets for the workflows).

```bash
# List what's available in the topic bank
node assets/js/content-engine.js topics

# Generate one specific article (slug must match a TOPIC_BANK entry)
node assets/js/content-engine.js generate claude-vs-chatgpt

# Generate a random article
node assets/js/content-engine.js generate

# Generate 5 random articles
node assets/js/content-engine.js batch 5

# List tools available for review generation
node assets/js/tool-page-engine.js tools

# Generate a tool review
node assets/js/tool-page-engine.js generate cursor
```

After generation: `git add` the new file(s) + `sitemap.xml` + `feed.xml`, commit, push. Deploy auto-fires; X post fires at the next 14:00 UTC.

### Adding new topics or tools

Edit `assets/js/content-engine.js` (`TOPIC_BANK`) or `assets/js/tool-page-engine.js` (`TOOL_BANK`). Follow the existing object schema — every field is required for the prompt to compose correctly.

---

## 🔧 Live credentials and IDs (embedded in the site)

| Item | Value | Where used |
|------|-------|------------|
| GA4 Measurement ID | `G-LSE8074X3B` | All HTML pages + content engine template |
| AdSense Publisher | `ca-pub-1606633100797174` | All HTML pages + `ads.txt` + both engines |
| 11 AdSense ad slots | listed in [Template.md §6.1](../MD%20Files/TuningDigital/Template.md) | named `td-*-*` per placement |
| X handle | `@TuningDigital` | `https://x.com/TuningDigital` — footer social-btn + `index.html` Twitter card meta + Organization JSON-LD `sameAs` (engines + index.html + about.html) |
| LinkedIn Company Page | `@TuningDigital` | `https://linkedin.com/company/tuningdigital` — footer social-btn (all pages + both engines) + Organization JSON-LD `sameAs` (engines + index.html + about.html). Brand assets in `brand/linkedin/` (logo 400×400, banner 1128×191, SVG sources). Re-uploaded 2026-06-08 with the dial mark, replacing earlier blue-dot versions. |
| X brand assets | `brand/x/` | `profile.png` (400×400, same design as LinkedIn logo) + `header.png` (1500×500, dark hero with kicker/wordmark/tagline). Generated 2026-06-08. Build script at `/tmp/build_x_assets.py` (not checked in). |
| Newsletter ESP | Resend (audience `6a716b66-d9d6-4c13-aa2c-564b70c8dd50` "General") | sending domain `updates.tuningdigital.com`; from `hello@updates.tuningdigital.com` |
| Newsletter Worker | `tuningdigital-subscribe` (`/cloudflare-worker/`) | routes: `tuningdigital.com/api/subscribe`; Custom Domain: `unsub.tuningdigital.com` |
| Editor identity | Alex Bacsa (Founder & Editor) | `CONFIG.authorName` + `authorRole` in both engines |
| Operator LinkedIn | https://www.linkedin.com/in/alexbacsa/ | About page Editor card + Person JSON-LD `sameAs` (personal profile, distinct from the Company Page above) |
| Design system | "calibration palette" (2026-06-07) | `oklch()` ink-navy + cyan + paper tokens in [assets/css/main.css](assets/css/main.css). Fonts: Hanken Grotesk (display + body) + IBM Plex Mono. |
| Brand mark | Tuning dial — circle + four tick marks + cyan needle | Rendered by `dialSVG()` in main.js into every `<span class="dial-slot">`. Same primitive as the favicon + LinkedIn logo + score gauges on review cards. |

---

## 💰 Monetisation

- **AdSense**: live publisher ID across the site. 11 slots created (homepage, blog, tools, articles, multiplex). See [Template.md §6.1](../MD%20Files/TuningDigital/Template.md) for the named-unit inventory.
- **Affiliate**: **deferred until organic traffic > 1K sessions/mo** — no programmes currently active. The site's standard "Editorial note" callout (top of every article) + footer line + privacy policy §3 + about.html "How We Make Money" all reflect this honestly, with a forward-looking commitment to per-link + per-article disclosure when programmes do activate. Don't reintroduce blanket "may earn a commission" language anywhere — the entire site was swept to align with reality on 2026-06-08 (commits `c44c872` + `c507027`). When the first affiliate programme is approved, update the standard callout exactly once in both engines (it's the same HTML block in `wrapInTemplate()` prompts) and the change propagates to all future cron articles.
- **Sponsored content**: **never accepted.** This is the durable editorial differentiator (affiliate ≠ sponsored). Hero, footer, X bio, and LinkedIn description all carry the line `"No sponsored coverage. Editorial rankings never for sale."` — true today, future-compatible if/when affiliates activate. Don't soften it.
- **Newsletter**: native HTML signup form → Cloudflare Worker (`/cloudflare-worker/`) → Resend `audiences.contacts.create` + welcome email via `/emails`. Subscribers managed in Resend audience "General". From address `hello@updates.tuningdigital.com` on the verified `updates.tuningdigital.com` sending subdomain. Unsubscribe: HMAC-signed one-click link to Worker Custom Domain `unsub.tuningdigital.com`.

---

## 🛠 Local development

No build step.

```bash
python3 -m http.server 8000     # → http://localhost:8000
```

Editing existing pages: copy a similar page as a template. Engine output should be the canonical pattern for any new article.

---

## 📚 Where the deep documentation lives

- **[Template.md](../MD%20Files/TuningDigital/Template.md)** — comprehensive project doc (architecture, credentials, monetisation, SEO/GEO/AEO, security, X automation, agenda). The single source of truth.
- **[CLAUDE.md](CLAUDE.md)** — Claude Code session guidance (commands, conventions, gotchas).
- **[TuningDigital.md](../MD%20Files/TuningDigital/TuningDigital.md)** — brand positioning + site architecture overview.
- **[tuningdigital-seo-geo-aeo.md](../MD%20Files/TuningDigital/tuningdigital-seo-geo-aeo.md)** — SEO/GEO/AEO implementation history.

---

*Operator: site maintainer. Built with Claude Code support for tuningdigital.com.*
