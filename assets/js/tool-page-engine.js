/**
 * tool-page-engine.js — Per-tool review page generator for Tuning Digital
 *
 * Produces detailed single-tool review pages at /reviews/<slug>-review.html
 * using the Claude API + a structured prompt. Sibling to content-engine.js
 * (which generates comparison/list/guide articles for /blog/).
 *
 * Usage:
 *   node tool-page-engine.js tools            List TOOL_BANK entries
 *   node tool-page-engine.js generate <slug>  Generate one tool review
 *   node tool-page-engine.js batch 3          Generate 3 random reviews
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Output:   HTML files saved to /reviews/, plus sitemap.xml + feed.xml updates
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Reuse TOPIC_BANK for related-article cross-links
const { TOPIC_BANK } = require('./content-engine.js');

// ─── CONFIG ──────────────────────────────────────────────
const CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model:  'claude-opus-4-6',
  outputDir: path.join(__dirname, '../../reviews'),
  siteUrl: 'https://tuningdigital.com',
  siteName: 'Tuning Digital',
  gaMeasurementId: 'G-LSE8074X3B',
  adsenseClient: 'ca-pub-1606633100797174',
  authorName: 'Alex Bacsa',
  authorRole: 'Founder & Editor',
};

// ─── TOOL BANK ───────────────────────────────────────────
// Seed of 18 priority tools across all pillar categories.
// Fields:
//   slug         — URL-safe identifier; filename becomes <slug>-review.html
//   name         — Display name
//   vendor       — Company behind the tool (for SoftwareApplication schema)
//   category     — Matches TOPIC_BANK categories so related-article picks line up
//   tagline      — One-line value prop, used as meta description seed
//   websiteUrl   — Tool's homepage; swap for affiliate tracking URL once
//                  the affiliate programme is approved (see Template.md §6.2)
//   pricingFrom  — Headline starting price, free-form (e.g. "Free / $20/mo")
//   rating       — Editorial 1.0–5.0 rating; surfaces in Rating schema
//   icon         — Emoji used as visual placeholder in hero/sidebar (no logos hosted yet)
//   keywords     — SEO keywords for the meta tag
const TOOL_BANK = [
  // ─── AI assistants ────────────────────────────────────
  { slug: 'claude',        name: 'Claude',         vendor: 'Anthropic',  category: 'AI Writing',   tagline: 'Most capable AI assistant for long-form work and complex reasoning.', websiteUrl: 'https://claude.com',           pricingFrom: 'Free / $20/mo',    rating: 5.0, icon: '🧠', keywords: ['claude review','claude vs chatgpt','anthropic claude'] },
  { slug: 'chatgpt',       name: 'ChatGPT',        vendor: 'OpenAI',     category: 'AI Writing',   tagline: 'The household-name AI assistant — broad, fast, ubiquitous.',           websiteUrl: 'https://chatgpt.com',          pricingFrom: 'Free / $20/mo',    rating: 4.7, icon: '💬', keywords: ['chatgpt review','chatgpt plus worth it'] },
  { slug: 'perplexity',    name: 'Perplexity',     vendor: 'Perplexity', category: 'AI Writing',   tagline: 'AI search with inline citations — the research assistant you wish Google was.', websiteUrl: 'https://perplexity.ai', pricingFrom: 'Free / $20/mo',    rating: 4.6, icon: '🔎', keywords: ['perplexity review','perplexity vs chatgpt'] },

  // ─── Productivity / PKM ───────────────────────────────
  { slug: 'notion',        name: 'Notion',         vendor: 'Notion Labs', category: 'Productivity', tagline: 'Workspace for notes, docs, wikis, and lightweight project management.', websiteUrl: 'https://notion.so',          pricingFrom: 'Free / $8/mo',     rating: 4.6, icon: '🗂️', keywords: ['notion review','notion worth it'] },
  { slug: 'obsidian',      name: 'Obsidian',       vendor: 'Obsidian',    category: 'Productivity', tagline: 'Local-first markdown notes with a powerful knowledge graph.',          websiteUrl: 'https://obsidian.md',         pricingFrom: 'Free / $5/mo sync',rating: 4.7, icon: '🔗', keywords: ['obsidian review','best pkm app'] },
  { slug: 'linear',        name: 'Linear',         vendor: 'Linear',      category: 'Productivity', tagline: 'Project management built for fast-moving product teams.',              websiteUrl: 'https://linear.app',          pricingFrom: 'Free / $8/mo',     rating: 4.8, icon: '⚡', keywords: ['linear review','linear vs jira'] },

  // ─── AI coding ────────────────────────────────────────
  { slug: 'cursor',        name: 'Cursor',         vendor: 'Anysphere',   category: 'AI Coding',    tagline: 'VS Code fork rebuilt around AI pair-programming.',                     websiteUrl: 'https://cursor.com',          pricingFrom: 'Free / $20/mo',    rating: 4.7, icon: '⌨️', keywords: ['cursor review','cursor ai editor'] },
  { slug: 'github-copilot',name: 'GitHub Copilot', vendor: 'GitHub',      category: 'AI Coding',    tagline: 'AI pair programmer that works in any IDE you already use.',            websiteUrl: 'https://github.com/features/copilot', pricingFrom: '$10/mo',  rating: 4.5, icon: '🤖', keywords: ['github copilot review','copilot worth it'] },

  // ─── Automation ───────────────────────────────────────
  { slug: 'zapier',        name: 'Zapier',         vendor: 'Zapier',      category: 'Automation',   tagline: 'Connect 7,000+ apps with point-and-click automation.',                  websiteUrl: 'https://zapier.com',          pricingFrom: 'Free / $19.99/mo', rating: 4.5, icon: '🔗', keywords: ['zapier review','best zapier alternative'] },
  { slug: 'make',          name: 'Make',           vendor: 'Make',        category: 'Automation',   tagline: 'Visual workflow builder for complex automations, cheaper than Zapier.', websiteUrl: 'https://make.com',            pricingFrom: 'Free / $9/mo',     rating: 4.6, icon: '🔀', keywords: ['make review','make vs zapier'] },

  // ─── SEO / Analytics ─────────────────────────────────
  { slug: 'ahrefs',        name: 'Ahrefs',         vendor: 'Ahrefs',      category: 'Analytics',    tagline: 'Industry-standard SEO suite — backlinks, keywords, site audits.',     websiteUrl: 'https://ahrefs.com',          pricingFrom: '$129/mo',          rating: 4.7, icon: '🔍', keywords: ['ahrefs review','ahrefs worth it'] },
  { slug: 'semrush',       name: 'SEMrush',        vendor: 'SEMrush',     category: 'Analytics',    tagline: 'All-in-one marketing toolkit covering SEO, PPC, social, and content.', websiteUrl: 'https://semrush.com',         pricingFrom: '$139.95/mo',       rating: 4.5, icon: '📊', keywords: ['semrush review','semrush vs ahrefs'] },

  // ─── Marketing / Email ────────────────────────────────
  { slug: 'beehiiv',       name: 'Beehiiv',        vendor: 'Beehiiv',     category: 'Marketing',    tagline: 'Newsletter platform built for monetisation and creator audiences.',   websiteUrl: 'https://beehiiv.com',         pricingFrom: 'Free / $34/mo',    rating: 4.6, icon: '📨', keywords: ['beehiiv review','beehiiv vs substack'] },
  { slug: 'hubspot',       name: 'HubSpot',        vendor: 'HubSpot',     category: 'CRM',          tagline: 'All-in-one marketing, sales, and service platform.',                   websiteUrl: 'https://hubspot.com',         pricingFrom: 'Free / $20/mo',    rating: 4.5, icon: '🤝', keywords: ['hubspot review','hubspot worth it'] },

  // ─── Design ───────────────────────────────────────────
  { slug: 'figma',         name: 'Figma',          vendor: 'Figma',       category: 'Design',       tagline: 'Browser-based collaborative UI/UX design.',                            websiteUrl: 'https://figma.com',           pricingFrom: 'Free / $15/mo',    rating: 4.8, icon: '🎨', keywords: ['figma review','figma worth it'] },
  { slug: 'framer',        name: 'Framer',         vendor: 'Framer',      category: 'Design',       tagline: 'Design and publish responsive websites visually, no code.',            websiteUrl: 'https://framer.com',          pricingFrom: 'Free / $15/mo',    rating: 4.6, icon: '✏️', keywords: ['framer review','framer vs webflow'] },

  // ─── AI media ─────────────────────────────────────────
  { slug: 'midjourney',    name: 'Midjourney',     vendor: 'Midjourney',  category: 'AI Design',    tagline: 'Best-in-class AI image generation, accessed via Discord and web.',    websiteUrl: 'https://midjourney.com',      pricingFrom: '$10/mo',           rating: 4.7, icon: '🖼️', keywords: ['midjourney review','best ai image generator'] },
  { slug: 'otter-ai',      name: 'Otter.ai',       vendor: 'Otter.ai',    category: 'AI Tools',     tagline: 'AI meeting assistant — transcripts, summaries, action items.',         websiteUrl: 'https://otter.ai',            pricingFrom: 'Free / $16.99/mo', rating: 4.4, icon: '🎙️', keywords: ['otter ai review','best meeting transcription'] },
];

// ─── HELPERS ─────────────────────────────────────────────

// Set of tool slugs whose <slug>-review.html already exists in /reviews/.
function publishedReviewSlugs() {
  const s = new Set();
  try {
    for (const f of fs.readdirSync(CONFIG.outputDir)) {
      if (f.endsWith('-review.html')) s.add(f.replace(/-review\.html$/, ''));
    }
  } catch (e) {}
  return s;
}

// Set of article slugs whose <slug>.html already exists in /blog/.
function publishedArticleSlugs() {
  const s = new Set();
  const blogDir = path.join(__dirname, '../../blog');
  try {
    for (const f of fs.readdirSync(blogDir)) {
      if (f.endsWith('.html') && f !== 'index.html') s.add(f.replace(/\.html$/, ''));
    }
  } catch (e) {}
  return s;
}

// Pick `count` other tools whose review is ALREADY PUBLISHED (avoids linking to
// /reviews/<slug>-review.html pages that don't exist — cause of 404s in the
// 2026-05-27 audit). Prioritises same-category. May return fewer than `count`.
function pickRelatedTools(currentTool, count = 3) {
  const published = publishedReviewSlugs();
  const others = TOOL_BANK.filter(t => t.slug !== currentTool.slug && published.has(t.slug));
  const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a,b) => a[0] - b[0]).map(x => x[1]);
  const same = shuffle(others.filter(t => t.category === currentTool.category));
  const rest = shuffle(others.filter(t => t.category !== currentTool.category));
  return [...same, ...rest].slice(0, count);
}

// Pick `count` related articles from TOPIC_BANK that are ALREADY PUBLISHED in
// /blog/ (avoids linking to ungenerated articles). Prioritises same-category.
function pickRelatedArticles(currentTool, count = 3) {
  const published = publishedArticleSlugs();
  const candidates = TOPIC_BANK.filter(t => published.has(t.slug));
  const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a,b) => a[0] - b[0]).map(x => x[1]);
  const same = shuffle(candidates.filter(t => t.category === currentTool.category));
  const rest = shuffle(candidates.filter(t => t.category !== currentTool.category));
  return [...same, ...rest].slice(0, count);
}

// Extract Q/A pairs from the generated FAQ section for FAQPage JSON-LD.
function extractFaqs(html) {
  const faqs = [];
  const sectionRe = /<h2[^>]*>\s*(?:Frequently Asked Questions|FAQ|FAQs)[^<]*<\/h2>([\s\S]*?)(?=<h2|<\/article|$)/i;
  const m = html.match(sectionRe);
  if (!m) return faqs;
  const section = m[1];
  const itemRe = /<h3[^>]*>([\s\S]*?)<\/h3>\s*((?:<p[^>]*>[\s\S]*?<\/p>\s*)+)/g;
  let it;
  while ((it = itemRe.exec(section)) !== null) {
    const q = it[1].replace(/<[^>]+>/g, '').trim();
    const a = it[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (q && a) faqs.push({ question: q, answer: a });
  }
  return faqs;
}

// ─── PROMPT TEMPLATE ─────────────────────────────────────
function buildPrompt(tool) {
  const relatedTools = pickRelatedTools(tool, 3);
  const relatedArticles = pickRelatedArticles(tool, 3);
  return `You are an expert tech writer for ${CONFIG.siteName}, an independent AI/SaaS productivity tools review site. Write a comprehensive single-tool review with the following specifications:

TOOL: ${tool.name} (by ${tool.vendor})
CATEGORY: ${tool.category}
TAGLINE: ${tool.tagline}
EDITORIAL RATING (pre-decided): ${tool.rating}/5
PRICING: ${tool.pricingFrom} — but always check current pricing on the vendor's site
TARGET KEYWORDS: ${tool.keywords.join(', ')}
WORD COUNT: 1500–2200 words
READING LEVEL: Professional but accessible (like TechCrunch or The Verge)
TONE: Direct, knowledgeable, opinionated but fair — no fluff, no marketing-speak

STRUCTURE REQUIRED (in this exact order):
1. Affiliate disclosure callout
2. A compelling intro (3–4 sentences) — what ${tool.name} is, why we're reviewing it, what makes our take different from the marketing copy you've already read elsewhere. The FIRST sentence must be a direct, self-contained one-line summary of the verdict — the kind of line an AI assistant could quote verbatim.
3. A TL;DR / Quick Verdict block (exact structure below) including the headline rating
4. An "At a Glance" summary table (<table class="compare-table">) immediately after the TL;DR, with rows for: Category, Best for, Starting price, Free tier / trial, Platforms, Standout feature, and Rating (${tool.rating}/5). Terse cells only. Tables are the single most-cited element by AI answer engines, so this is mandatory.
5. <h2>What Is ${tool.name}?</h2> — 2-3 paragraphs explaining the product and who it's built for. Include the vendor name and the year it launched if widely known
6. <h2>Key Features</h2> — 4-6 features as H3 subsections, each with concrete examples not feature-list bullets
7. <h2>Pricing</h2> — every paid tier with the headline price, what's included, and who each tier suits. Use a real HTML table
8. <h2>Pros & Cons</h2> — two <ul> lists; 4-6 items each; opinionated, no fence-sitting
9. <h2>How We Tested</h2> — 2-3 sentences on the methodology: "We used X for Y days on real work, ran benchmark tasks Z, etc." Be honest — say "limited hands-on testing" if the review is more analytical than empirical
10. <h2>Who Should Use ${tool.name}?</h2> — explicit "Best for" persona descriptions (3-4)
11. <h2>Who Should Avoid ${tool.name}?</h2> — explicit "Avoid if" disqualifying scenarios (2-3)
12. <h2>Final Verdict</h2> — restate the rating, summarise the case in 2-3 sentences, end with a clear yes/no/maybe recommendation
13. <h2>Frequently Asked Questions</h2> — 4+ Q/A pairs as <h3>Question</h3><p>Answer</p>. Each answer 1-3 sentences MAX — concise enough to be lifted as a featured snippet. Phrase at least one or two FAQ questions (or H3s elsewhere) as the exact natural-language queries people ask aloud (e.g. "Is ${tool.name} worth it for freelancers?", "Does ${tool.name} have a free plan?").

CITATION REQUIREMENTS (GEO/AEO):
- 3+ outbound citations to authoritative sources within the body — vendor docs, official pricing pages, reputable tech publications. Use descriptive anchor text — never "click here".
- Cite at least 2 concrete, VERIFIABLE data points (a real pricing figure, a published benchmark, an official user/market-share number) and attribute each to its source via the surrounding link. AI answer engines disproportionately cite content with specific, sourced numbers.
- ⚠️ NEVER invent a statistic, user count, or benchmark. If a figure isn't genuinely known from a real source, write qualitatively instead — fabricated stats destroy credibility and breach AdSense policy.
- Entity grounding: the first mention of ${tool.name} (and any other named tool) should link to its official website so answer engines can disambiguate the entity.
- Outbound citations: rel="noopener" target="_blank". The vendor's own URLs additionally get rel="nofollow sponsored" (affiliate placeholder).

INTERNAL LINKING (SEO):
- Add inline contextual links to other content on tuningdigital.com using descriptive anchor text where natural.
- ⚠️ CRITICAL: ONLY link to URLs from the exact list below — these are the only published pages. Do NOT invent or guess internal URLs (inventing /reviews/chatgpt-review.html or /blog/claude-vs-chatgpt.html etc. returns 404 and breaks the site audit).
- If the list below is empty, add NO internal links (the site is new). Don't fabricate.
- Published pages you may link to (exact URLs):
${(relatedTools.length || relatedArticles.length)
  ? [...relatedTools.map(t => `    • Tool review: ${t.name} → /reviews/${t.slug}-review.html`),
     ...relatedArticles.map(a => `    • Article: ${a.title} → /blog/${a.slug}.html`)].join('\n')
  : '    (none yet — do not add internal links)'}
- Internal links use plain href (no rel="nofollow", no target="_blank") so link equity flows internally.

FORMATTING REQUIREMENTS:
- HTML headings (h2, h3) — no markdown
- Wrap content in <article class="article-body">
- Include an <aside class="toc"> table of contents at the top, after the disclosure and intro
- Bold tool names and key terms with <strong>
- Include a <blockquote> with a realistic user quote (no fake attribution to fake people — frame as "one reviewer noted" or similar)
- Tables (At-a-Glance + Pricing): use <table class="compare-table"> with <thead> and <tbody>. In the At-a-Glance table the first cell of each row is the dimension label; in the Pricing table the columns are the tiers. Keep cells terse and scannable — concise cells are what AI answer engines lift verbatim
- Affiliate disclosure: <div class="callout callout-accent">…</div>
- TL;DR block: use EXACTLY this structure (do not deviate from class names):
  <div class="tldr-box">
    <h2 class="tldr-title">Quick Verdict</h2>
    <p class="tldr-summary">[2-3 sentence direct answer including the rating ${tool.rating}/5 and who it's best for]</p>
    <ul class="tldr-list">
      <li><strong>Best for:</strong> [one concrete user type]</li>
      <li><strong>Avoid if:</strong> [one disqualifying scenario]</li>
      <li><strong>Pricing from:</strong> ${tool.pricingFrom}</li>
      <li><strong>Rating:</strong> ${tool.rating}/5</li>
    </ul>
  </div>

VOICE / ANTI-AI-DETECTION REQUIREMENTS (important — AdSense and search engines flag uniform AI prose):
- Write as a real human editor at a small UK-based independent publication, not as an AI generating "comprehensive" content.
- Use concrete examples wherever possible. "I tested ${tool.name} on a 12,000-word client brief" beats "I tested it on a long document".
- Vary sentence length aggressively. Mix short punchy lines with longer analytical sentences.
- Allow opinions, hedges, the occasional digression. Real editorial has rhythm; AI prose is too even.
- Use British English spelling (organise, optimise, behaviour, prioritise, colour, recognised).
- Where it fits naturally, reference UK context (£ pricing alongside $, UK GDPR not just GDPR).
- Do NOT structure every section identically.
- Drop AI hedges: "However, it's worth noting", "On the other hand", "When it comes to", "In the world of", "Furthermore", "Moreover", "Additionally".
- Use em-dashes sparingly. Mix with commas, semicolons, full stops.

DO NOT include:
- The <html>, <head>, <body>, <nav>, or <footer> tags (this goes inside a template)
- Any meta tags or scripts
- Specific prices that may have changed — refer to "${tool.pricingFrom}" as the headline but tell readers "check current pricing on ${tool.vendor}'s site"
- Fabricated statistics, fake user counts, invented case studies, customer logos, or attributions to people who don't exist
- Filler openers: "In conclusion", "It goes without saying", "In today's digital landscape", "In the rapidly evolving world of"
- Self-referential language like "this review will cover" or "as we'll see"

Return ONLY the article HTML, starting with the <article> tag.`;
}

// ─── HTML PAGE TEMPLATE ───────────────────────────────────
function wrapInTemplate(tool, articleHtml, publishDate) {
  const formattedDate = new Date(publishDate).toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
  const isoDate = new Date(publishDate).toISOString();
  const pageUrl = `${CONFIG.siteUrl}/reviews/${tool.slug}-review.html`;
  const relatedTools = pickRelatedTools(tool, 3);
  const relatedArticles = pickRelatedArticles(tool, 2);
  const faqs = extractFaqs(articleHtml);
  const faqJsonLd = faqs.length ? `\n  <script type="application/ld+json">\n  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": { "@type": "Answer", "text": f.answer }
    }))
  })}\n  </script>` : '';

  const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${xmlEscape(tool.name)} Review (${new Date().getFullYear()}): Honest Verdict | ${CONFIG.siteName}</title>
  <meta name="description" content="Independent ${xmlEscape(tool.name)} review. ${xmlEscape(tool.tagline)} Pricing, features, pros, cons, and who it's best for.">
  <meta name="keywords" content="${tool.keywords.join(',')}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${xmlEscape(tool.name)} Review (${new Date().getFullYear()}) | ${CONFIG.siteName}">
  <meta property="og:description" content="${xmlEscape(tool.tagline)}">
  <meta property="article:published_time" content="${isoDate}">
  <meta property="og:image" content="${CONFIG.siteUrl}/assets/img/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#060812">
  <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
  <link rel="alternate" type="application/rss+xml" title="Tuning Digital — Reviews & Comparisons" href="/feed.xml">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Review","itemReviewed":{"@type":"SoftwareApplication","name":"${xmlEscape(tool.name)}","applicationCategory":"BusinessApplication","operatingSystem":"Web, macOS, Windows, iOS, Android","url":"${tool.websiteUrl}","offers":{"@type":"Offer","price":"${(tool.pricingFrom.match(/\d+/) || ['0'])[0]}","priceCurrency":"USD"}},"reviewRating":{"@type":"Rating","ratingValue":"${tool.rating}","bestRating":"5","worstRating":"1"},"author":{"@type":"Person","name":"${CONFIG.authorName}","jobTitle":"${CONFIG.authorRole}","url":"${CONFIG.siteUrl}/about.html#editor"},"publisher":{"@type":"Organization","name":"${CONFIG.siteName}","url":"${CONFIG.siteUrl}"},"datePublished":"${isoDate}","reviewBody":"Independent review of ${xmlEscape(tool.name)} — hands-on assessment with honest pros, cons, pricing, and a clear best-for / avoid-if verdict."}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${CONFIG.siteUrl}/"},{"@type":"ListItem","position":2,"name":"Reviews","item":"${CONFIG.siteUrl}/reviews/"},{"@type":"ListItem","position":3,"name":"${xmlEscape(tool.name)} Review","item":"${pageUrl}"}]}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","url":"${pageUrl}","speakable":{"@type":"SpeakableSpecification","cssSelector":[".tldr-box",".tldr-summary",".tldr-list"]}}
  </script>${faqJsonLd}
  <!-- Google Consent Mode v2 (default DENIED — GDPR/PECR strict) -->
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});try{if(localStorage.getItem('td_cookie_consent')==='accepted')gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}catch(e){}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=${CONFIG.gaMeasurementId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${CONFIG.gaMeasurementId}');</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CONFIG.adsenseClient}" crossorigin="anonymous"></script>
  <link rel="stylesheet" href="/assets/css/main.css">
</head>
<body>
<nav class="navbar">
  <div class="container">
    <div class="nav-inner">
      <a href="/" class="nav-logo"><span class="dot"></span>${CONFIG.siteName}</a>
      <ul class="nav-links">
        <li><a href="/tools/">Tools</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/reviews/">Reviews</a></li><li><a href="/about.html">About</a></li>
      </ul>
      <a href="/tools/" class="nav-cta">Explore Tools →</a>
      <button class="nav-mobile-toggle" id="mobileToggle"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="mobile-nav" id="mobileNav">
  <a href="/tools/">Tools</a><a href="/blog/">Blog</a><a href="/reviews/">Reviews</a><a href="/about.html">About</a>
</div>
<main>
  <div class="container" style="padding-top:48px">
    <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/reviews/">Reviews</a><span>/</span><span>${xmlEscape(tool.name)} Review</span></nav>
    <header class="article-header">
      <p class="label">${xmlEscape(tool.category)} · Tool Review</p>
      <h1>${xmlEscape(tool.name)} Review (${new Date().getFullYear()})</h1>
      <div class="article-meta">
        <span>📅 ${formattedDate}</span>
        <span>✍️ <a href="/about.html#editor" style="color:inherit;text-decoration:none;border-bottom:1px dotted currentColor">${CONFIG.authorName}</a></span>
        <span>⭐ ${tool.rating}/5</span>
      </div>
    </header>
    <div class="ad-slot ad-slot-banner" style="margin-bottom:40px">
      <!-- AdSense: td-article-banner (in-article fluid) -->
      <ins class="adsbygoogle" style="display:block;text-align:center" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="${CONFIG.adsenseClient}" data-ad-slot="2699292471"></ins>
      <script>try{(adsbygoogle = window.adsbygoogle || []).push({});}catch(e){}</script>
    </div>
    <div class="article-layout">
      ${articleHtml}
      <aside class="sidebar">
        <div class="ad-slot ad-slot-square" style="margin-bottom:20px">
          <!-- AdSense: td-article-sidebar -->
          <ins class="adsbygoogle" style="display:block" data-ad-client="${CONFIG.adsenseClient}" data-ad-slot="1853114667" data-ad-format="auto" data-full-width-responsive="true"></ins>
          <script>try{(adsbygoogle = window.adsbygoogle || []).push({});}catch(e){}</script>
        </div>
        <div class="sidebar-card">
          <h4>${tool.icon} Try ${xmlEscape(tool.name)}</h4>
          <p style="font-size:.85rem;margin:8px 0 14px;max-width:none">${xmlEscape(tool.tagline)}</p>
          <p style="font-size:.78rem;color:var(--text-dim);margin:0 0 14px">Pricing from ${xmlEscape(tool.pricingFrom)}</p>
          <a href="${tool.websiteUrl}" target="_blank" rel="noopener nofollow sponsored" class="btn btn-primary btn-sm w-full" style="justify-content:center" onclick="gtag('event','affiliate_click',{tool:'${tool.slug}'})">Visit ${xmlEscape(tool.name)} →</a>
        </div>
${relatedTools.length ? `        <div class="sidebar-card mt-16">
          <h4>Related Reviews</h4>
          <ul>
${relatedTools.map(r => `            <li><a href="/reviews/${r.slug}-review.html">${r.icon} ${r.name}</a></li>`).join('\n')}
          </ul>
        </div>` : ''}
${relatedArticles.length ? `        <div class="sidebar-card mt-16">
          <h4>Related Articles</h4>
          <ul>
${relatedArticles.map(a => `            <li><a href="/blog/${a.slug}.html">→ ${xmlEscape(a.title)}</a></li>`).join('\n')}
          </ul>
        </div>` : ''}
        <div class="sidebar-card mt-16" style="background:var(--accent-glow);border-color:rgba(0,229,212,.2)">
          <h4>Free Calculator</h4>
          <p style="font-size:.85rem;margin:8px 0 14px;max-width:none">Calculate your total SaaS spend and find overlaps.</p>
          <a href="/tools/saas-cost-calculator.html" class="btn btn-primary btn-sm w-full" style="justify-content:center">Open Calculator</a>
        </div>
      </aside>
    </div>
    <!-- ─── MULTIPLEX: End-of-review discovery ──────────────── -->
    <div class="ad-slot ad-slot-multiplex" style="margin:48px 0 16px">
      <!-- AdSense: td-article-end-multiplex -->
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-format="autorelaxed"
           data-ad-client="${CONFIG.adsenseClient}"
           data-ad-slot="4908550623"></ins>
      <script>try{(adsbygoogle = window.adsbygoogle || []).push({});}catch(e){}</script>
    </div>
  </div>
</main>
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand"><div class="footer-logo"><span class="dot"></span>${CONFIG.siteName}</div><p>Independent AI and SaaS tool reviews.</p></div>
      <div class="footer-col"><h5>Tools</h5><ul><li><a href="/tools/">All Tools</a></li></ul></div>
      <div class="footer-col"><h5>Content</h5><ul><li><a href="/blog/">Blog</a></li></ul></div>
      <div class="footer-col"><h5>Company</h5><ul><li><a href="/about.html">About</a></li><li><a href="/contact.html">Contact</a></li><li><a href="/privacy-policy.html">Privacy</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${CONFIG.siteName}. Affiliate disclosure: some links earn us a commission.</p>
      <div class="footer-bottom-links"><a href="/sitemap.xml">Sitemap</a><a href="/privacy-policy.html">Privacy</a><a href="#" class="manage-cookies">Manage cookies</a></div>
    </div>
    <div class="footer-sister-pubs" style="border-top:0.5px solid #1c2040;margin-top:16px;padding-top:14px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5c6488;text-align:center;font-family:'JetBrains Mono',monospace;">
      Sister publications &middot;
      <a href="https://salestap.com" rel="noopener" target="_blank" style="color:#5c6488;text-decoration:none;margin:0 6px;">SalesTap</a> &middot;
      <a href="https://cloudfintech.ai" rel="noopener" target="_blank" style="color:#5c6488;text-decoration:none;margin:0 6px;">CloudFintech</a>
    </div>
  </div>
</footer>
<script src="/assets/js/main.js"></script>
<!-- Beehiiv attribution tracking — captures UTM params for newsletter signups -->
<script type="text/javascript" async src="https://subscribe-forms.beehiiv.com/attribution.js"></script>
</body>
</html>`;
}

// ─── API CALL ─────────────────────────────────────────────
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CONFIG.model,
      max_tokens: 8192, // bumped from 4096 — tool reviews + all required sections (incl. FAQ + Final Verdict) need the headroom
      messages: [{ role: 'user', content: prompt }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    let data = '';
    const req = https.request(options, (res) => {
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content[0].text);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── GENERATE TOOL REVIEW ─────────────────────────────────
async function generateToolReview(tool) {
  if (!CONFIG.apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }
  console.log(`\n🔧 Generating review: ${tool.name} (by ${tool.vendor})…`);
  const prompt = buildPrompt(tool);
  const articleHtml = await callClaude(prompt);
  const publishDate = new Date().toISOString();
  const fullPage = wrapInTemplate(tool, articleHtml, publishDate);
  const outputPath = path.join(CONFIG.outputDir, `${tool.slug}-review.html`);
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  fs.writeFileSync(outputPath, fullPage, 'utf8');
  console.log(`✅ Saved: reviews/${tool.slug}-review.html`);
  updateSitemap(tool, publishDate);
  updateFeed(tool, publishDate);
  return { tool, path: outputPath, publishDate };
}

// ─── UPDATE SITEMAP ───────────────────────────────────────
function updateSitemap(tool, date) {
  const sitemapPath = path.join(__dirname, '../../sitemap.xml');
  try {
    let xml = fs.readFileSync(sitemapPath, 'utf8');
    const url = `${CONFIG.siteUrl}/reviews/${tool.slug}-review.html`;
    if (xml.includes(url)) return;
    const newEntry = `  <url>
    <loc>${url}</loc>
    <lastmod>${date.split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    xml = xml.replace('</urlset>', newEntry + '\n</urlset>');
    fs.writeFileSync(sitemapPath, xml, 'utf8');
    console.log(`🗺️  Updated sitemap.xml`);
  } catch(e) { console.warn('⚠️  Could not update sitemap:', e.message); }
}

// ─── UPDATE RSS FEED ──────────────────────────────────────
function updateFeed(tool, date) {
  const feedPath = path.join(__dirname, '../../feed.xml');
  const url = `${CONFIG.siteUrl}/reviews/${tool.slug}-review.html`;
  const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const d = new Date(date);
  const pubDate = d.toUTCString();
  const title = `${tool.name} Review (${d.getFullYear()})`;
  const desc = `Independent ${tool.name} review. ${tool.tagline} Pricing, features, pros, cons, and who it's best for.`;
  const newItem = `    <item>
      <title>${xmlEscape(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xmlEscape(desc)}</description>
      <category>${xmlEscape(tool.category)}</category>
      <dc:creator>${xmlEscape(CONFIG.authorName)}</dc:creator>
      <pubDate>${pubDate}</pubDate>
    </item>`;
  try {
    let xml = fs.readFileSync(feedPath, 'utf8');
    if (xml.includes(url)) return;
    xml = xml.replace(/<lastBuildDate>[^<]+<\/lastBuildDate>/, `<lastBuildDate>${pubDate}</lastBuildDate>`);
    xml = xml.replace(/(<ttl>\d+<\/ttl>\s*)/, `$1\n${newItem}\n`);
    fs.writeFileSync(feedPath, xml, 'utf8');
    console.log(`📰 Updated feed.xml`);
  } catch(e) { console.warn('⚠️  Could not update feed.xml:', e.message); }
}

// ─── PUBLISH STATE HELPER ─────────────────────────────────
// Returns TOOL_BANK entries whose <slug>-review.html doesn't already exist
// in CONFIG.outputDir. Prevents the random picker from overwriting existing
// reviews. `generate <slug>` bypasses this for explicit refresh.
function getUnreviewedTools() {
  const reviewed = new Set();
  try {
    for (const f of fs.readdirSync(CONFIG.outputDir)) {
      if (f.endsWith('-review.html')) {
        reviewed.add(f.replace(/-review\.html$/, ''));
      }
    }
  } catch (e) {
    // outputDir doesn't exist yet — treat everything as unreviewed
  }
  return TOOL_BANK.filter(t => !reviewed.has(t.slug));
}

// ─── CLI ──────────────────────────────────────────────────
const [,, command, arg] = process.argv;

(async () => {
  if (command === 'tools') {
    console.log('\n🔧 Available tools:\n');
    const unrev = new Set(getUnreviewedTools().map(t => t.slug));
    TOOL_BANK.forEach((t, i) => {
      const mark = unrev.has(t.slug) ? '⏳' : '✅';
      console.log(`  ${String(i+1).padStart(2)}. ${mark} ${t.icon} ${t.name.padEnd(18)} ${t.category.padEnd(14)} ${t.rating}/5  ${t.pricingFrom}`);
    });
    console.log(`\n${unrev.size}/${TOOL_BANK.length} unreviewed (⏳). ✅ = already on /reviews/.`);
    console.log(`Run: node tool-page-engine.js generate <slug>\n`);

  } else if (command === 'generate') {
    let tool;
    if (arg) {
      tool = TOOL_BANK.find(t => t.slug === arg);
      if (!tool) { console.error(`❌ Unknown tool slug: "${arg}"`); process.exit(1); }
    } else {
      const unrev = getUnreviewedTools();
      if (!unrev.length) {
        console.log('🎉 All TOOL_BANK entries reviewed. Add more entries or use `generate <slug>` to refresh an existing review.');
        return;
      }
      tool = unrev[Math.floor(Math.random() * unrev.length)];
    }
    try { await generateToolReview(tool); }
    catch(e) { console.error('❌ Error:', e.message); process.exit(1); }

  } else if (command === 'batch') {
    const count = parseInt(arg) || 3;
    const unrev = getUnreviewedTools();
    if (!unrev.length) {
      console.log('🎉 All TOOL_BANK entries reviewed. Add more entries or use `generate <slug>` to refresh an existing review.');
      return;
    }
    if (unrev.length < count) {
      console.log(`⚠️  Only ${unrev.length} unreviewed tool(s) remain (requested ${count}). Generating ${unrev.length}.`);
    }
    const shuffled = [...unrev].sort(() => Math.random() - .5).slice(0, count);
    for (const tool of shuffled) {
      try {
        await generateToolReview(tool);
        await new Promise(r => setTimeout(r, 2000)); // rate-limit buffer
      } catch(e) { console.error(`❌ Failed ${tool.slug}:`, e.message); }
    }
    console.log(`\n🎉 Generated ${shuffled.length} tool review(s)`);

  } else {
    console.log(`
Tuning Digital — Tool Page Engine
Usage:
  node tool-page-engine.js tools             List all tools in TOOL_BANK
  node tool-page-engine.js generate          Generate a random tool review
  node tool-page-engine.js generate {slug}   Generate specific tool review
  node tool-page-engine.js batch 5           Generate 5 random tool reviews

Requires: ANTHROPIC_API_KEY=your_key_here
Output:   /reviews/<slug>-review.html (auto-updates sitemap.xml + feed.xml)
    `);
  }
})();

module.exports = { generateToolReview, TOOL_BANK };
