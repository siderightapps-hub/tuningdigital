# Tuning Digital — tuningdigital.com

> Independent reviews and comparisons of AI & SaaS productivity tools.
> AdSense + affiliate + sponsored posts · Static site · GitHub Pages + Cloudflare front

**Site is live.** This README is the operator runbook for ongoing maintenance, not initial setup.

For full project context (architecture, credentials, editorial standards, agenda), see [Template.md](../MD%20Files/TuningDigital/Template.md). For Claude Code session guidance, see [CLAUDE.md](CLAUDE.md).

---

## 🗂 Project structure

```
tuningdigital/
├── index.html                          ← Homepage
├── about.html                          ← About + editorial standards + "How We Use AI"
├── contact.html                        ← 4-channel contact (general / privacy / sponsorship / security)
├── privacy-policy.html                 ← GDPR + cookie policy + affiliate disclosure
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
| X handle | `@TuningDigital` | `index.html` Twitter card meta + sidebar bio |
| Beehiiv form | `c469056c-9905-42d5-b7a5-3e3be95b91f2` | homepage, blog index, tools index newsletter sections |
| Editor identity | Sam Carter | `CONFIG.authorName` in both engines |

---

## 💰 Monetisation

- **AdSense**: live publisher ID across the site. 11 slots created (homepage, blog, tools, articles, multiplex). See [Template.md §6.1](../MD%20Files/TuningDigital/Template.md) for the named-unit inventory.
- **Affiliate**: deferred until organic traffic > 1K sessions/mo (affiliate programmes routinely reject low-traffic sites — see [Template.md §6.2](../MD%20Files/TuningDigital/Template.md)).
- **Sponsored content**: clearly labelled when accepted; declined when conflicting with editorial standards.
- **Newsletter**: Beehiiv (`tuning-digital.beehiiv.com`); reply-to wired to `hello@`.

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
