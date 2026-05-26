/**
 * content-engine.js — Claude API Content Generator for Tuning Digital
 * 
 * Usage:
 *   node content-engine.js generate  → generate a new article
 *   node content-engine.js batch 5   → generate 5 articles
 *   node content-engine.js topics    → list suggested topics
 * 
 * Requires: ANTHROPIC_API_KEY environment variable
 * Output: HTML files saved to /blog/ directory
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ─── CONFIG ──────────────────────────────────────────────
const CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model:  'claude-opus-4-6',
  outputDir: path.join(__dirname, '../../blog'),
  siteUrl: 'https://tuningdigital.com',
  siteName: 'Tuning Digital',
  gaMeasurementId: 'G-LSE8074X3B',
  adsenseClient: 'ca-pub-1606633100797174',
  // Editorial author identity (single named editor — change here, then re-run
  // generation or sed-patch existing articles to retroactively rename).
  authorName: 'Alex Bacsa',
  authorRole: 'Founder & Editor',
};

// ─── TOPIC BANK ──────────────────────────────────────────
// `type` drives prompt nuance and schema choices in future iterations:
//   'comparison' — A vs B (or A vs B vs C) head-to-head
//   'review'     — single-tool deep-dive
//   'list'       — best-of / ranked roundup
//   'guide'      — how-to / tutorial
//   'alternatives' — "X alternatives" — captures competitor traffic
const TOPIC_BANK = [
  // ─── Already published / hand-curated ──────────────────
  { slug: 'best-ai-productivity-apps-2026',      title: 'Best AI Productivity Apps 2026',         category: 'AI Tools',     type: 'list',         keywords: ['AI productivity apps','best AI apps 2026'] },
  { slug: 'notion-vs-obsidian-pkm',              title: 'Notion vs Obsidian for PKM',             category: 'Productivity', type: 'comparison',   keywords: ['notion vs obsidian','best note taking app'] },
  { slug: 'chatgpt-vs-perplexity-research',      title: 'ChatGPT vs Perplexity for Research',     category: 'AI Writing',   type: 'comparison',   keywords: ['chatgpt vs perplexity','AI research tools'] },
  { slug: 'best-free-saas-tools-startups',       title: 'Best Free SaaS Tools for Startups',      category: 'SaaS',         type: 'list',         keywords: ['free SaaS tools','startup tools 2026'] },
  { slug: 'zapier-vs-make-automation',           title: 'Zapier vs Make: Full Comparison 2026',   category: 'Automation',   type: 'comparison',   keywords: ['zapier vs make','no-code automation tools'] },
  { slug: 'ai-image-generators-ranked',          title: 'AI Image Generators Ranked 2026',        category: 'AI Design',    type: 'list',         keywords: ['best AI image generator','midjourney vs dall-e'] },
  { slug: 'reduce-saas-spend-guide',             title: 'How to Reduce SaaS Spend by 40%',        category: 'SaaS',         type: 'guide',        keywords: ['reduce SaaS costs','SaaS spend optimization'] },
  { slug: 'best-project-management-saas-2026',   title: 'Best Project Management SaaS 2026',      category: 'Productivity', type: 'list',         keywords: ['best project management tool','jira vs linear'] },
  { slug: 'ahrefs-vs-semrush-seo-tools',         title: 'Ahrefs vs SEMrush: SEO Tools in 2026',   category: 'Analytics',    type: 'comparison',   keywords: ['ahrefs vs semrush','best SEO tool 2026'] },
  { slug: 'linear-app-review',                   title: 'Linear App Review 2026',                 category: 'Productivity', type: 'review',       keywords: ['linear app review','linear project management'] },

  // ─── High-priority comparisons (search-volume gaps from §7.3) ─────
  { slug: 'claude-vs-chatgpt',                   title: 'Claude vs ChatGPT: Which AI Assistant Wins in 2026?',   category: 'AI Writing',   type: 'comparison',   keywords: ['claude vs chatgpt','best ai assistant'] },
  { slug: 'gemini-vs-chatgpt',                   title: 'Gemini vs ChatGPT: Full Comparison 2026',                category: 'AI Writing',   type: 'comparison',   keywords: ['gemini vs chatgpt','google gemini review'] },
  { slug: 'claude-vs-gemini',                    title: 'Claude vs Gemini: Side-by-Side for Real Work',           category: 'AI Writing',   type: 'comparison',   keywords: ['claude vs gemini','anthropic vs google ai'] },
  { slug: 'cursor-vs-github-copilot',            title: 'Cursor vs GitHub Copilot: AI Coding Tools Tested',       category: 'AI Coding',    type: 'comparison',   keywords: ['cursor vs copilot','best ai coding tool'] },
  { slug: 'cursor-vs-windsurf',                  title: 'Cursor vs Windsurf: Which AI IDE Should You Use?',       category: 'AI Coding',    type: 'comparison',   keywords: ['cursor vs windsurf','ai ide comparison'] },
  { slug: 'figma-vs-framer',                     title: 'Figma vs Framer: Design Tool Showdown 2026',             category: 'Design',       type: 'comparison',   keywords: ['figma vs framer','best design tool'] },
  { slug: 'airtable-vs-notion',                  title: 'Airtable vs Notion: Database or Workspace?',             category: 'Productivity', type: 'comparison',   keywords: ['airtable vs notion','no-code database'] },
  { slug: 'monday-vs-asana',                     title: 'Monday vs Asana: Project Management Compared',           category: 'Productivity', type: 'comparison',   keywords: ['monday vs asana','project management comparison'] },
  { slug: 'hubspot-vs-pipedrive',                title: 'HubSpot vs Pipedrive: Best CRM for Small Business',      category: 'CRM',          type: 'comparison',   keywords: ['hubspot vs pipedrive','best small business crm'] },
  { slug: 'mailchimp-vs-convertkit',             title: 'Mailchimp vs ConvertKit: Newsletter Platform Compared',  category: 'Marketing',    type: 'comparison',   keywords: ['mailchimp vs convertkit','best newsletter platform'] },
  { slug: 'plausible-vs-google-analytics',       title: 'Plausible vs Google Analytics: Privacy-First Analytics', category: 'Analytics',    type: 'comparison',   keywords: ['plausible vs ga4','privacy-friendly analytics'] },

  // ─── Best-of lists (high-volume informational) ────────────────────
  { slug: 'best-ai-coding-assistants-2026',      title: 'Best AI Coding Assistants 2026',                         category: 'AI Coding',    type: 'list',         keywords: ['best ai coding tools','ai pair programmer'] },
  { slug: 'best-ai-meeting-tools-2026',          title: 'Best AI Meeting Tools 2026: Otter, Fireflies & More',    category: 'AI Tools',     type: 'list',         keywords: ['best ai meeting tools','meeting transcription ai'] },
  { slug: 'best-ai-email-tools-2026',            title: 'Best AI Email Tools 2026: Inbox Zero with AI',           category: 'AI Tools',     type: 'list',         keywords: ['best ai email tools','superhuman alternative'] },
  { slug: 'best-no-code-tools-2026',             title: 'Best No-Code Tools 2026 for Founders',                   category: 'Automation',   type: 'list',         keywords: ['best no-code tools','no-code app builder'] },
  { slug: 'best-newsletter-platforms-2026',      title: 'Best Newsletter Platforms 2026: Beehiiv vs the Rest',    category: 'Marketing',    type: 'list',         keywords: ['best newsletter platform','beehiiv alternative'] },
  { slug: 'best-free-ai-tools-2026',             title: 'Best Free AI Tools 2026 (No Catch, No Trial)',           category: 'AI Tools',     type: 'list',         keywords: ['best free ai tools','free ai tools no signup'] },
  { slug: 'best-ai-writing-tools-2026',          title: 'Best AI Writing Tools 2026: Beyond ChatGPT',             category: 'AI Writing',   type: 'list',         keywords: ['best ai writing tools 2026','jasper alternatives'] },

  // ─── Single-tool reviews ───────────────────────────────────────
  { slug: 'cursor-app-review',                   title: 'Cursor App Review 2026: Honest Verdict After 60 Days',   category: 'AI Coding',    type: 'review',       keywords: ['cursor review','cursor app review 2026'] },
  { slug: 'notion-ai-review',                    title: 'Notion AI Review 2026: Worth the £8/mo?',                category: 'Productivity', type: 'review',       keywords: ['notion ai review','notion ai worth it'] },
  { slug: 'perplexity-review',                   title: 'Perplexity Review 2026: Search Engine of the Future?',   category: 'AI Writing',   type: 'review',       keywords: ['perplexity review','perplexity ai worth it'] },
  { slug: 'beehiiv-review',                      title: 'Beehiiv Review 2026: Best Newsletter Platform?',         category: 'Marketing',    type: 'review',       keywords: ['beehiiv review','beehiiv vs substack'] },

  // ─── How-to guides (informational, top-of-funnel) ──────────────
  { slug: 'how-to-write-prompts-effectively',    title: 'How to Write AI Prompts That Actually Work',             category: 'AI Writing',   type: 'guide',        keywords: ['how to write ai prompts','prompt engineering basics'] },
  { slug: 'how-to-automate-email-with-ai',       title: 'How to Automate Your Inbox with AI (Step by Step)',      category: 'Automation',   type: 'guide',        keywords: ['ai email automation','automate inbox with ai'] },
  { slug: 'how-to-audit-saas-stack',             title: 'How to Audit Your SaaS Stack in 30 Minutes',             category: 'SaaS',         type: 'guide',        keywords: ['audit saas stack','saas audit checklist'] },

  // ─── Alternatives pages (competitor traffic) ──────────────────
  { slug: 'jasper-alternatives',                 title: 'Best Jasper AI Alternatives in 2026',                    category: 'AI Writing',   type: 'alternatives', keywords: ['jasper alternatives','ai writing tools like jasper'] },
  { slug: 'zapier-alternatives',                 title: 'Best Zapier Alternatives in 2026 (Cheaper & Better)',    category: 'Automation',   type: 'alternatives', keywords: ['zapier alternatives','best zapier replacement'] },
  { slug: 'notion-alternatives',                 title: 'Best Notion Alternatives in 2026',                       category: 'Productivity', type: 'alternatives', keywords: ['notion alternatives','best notion replacement'] },
];

// ─── PROMPT TEMPLATE ─────────────────────────────────────
function buildPrompt(topic) {
  const related = pickRelatedTopics(topic, 3);
  return `You are an expert tech writer for ${CONFIG.siteName}, an independent AI/SaaS productivity tools review site. Write a comprehensive, SEO-optimised blog article with the following specifications:

TOPIC: ${topic.title}
TARGET KEYWORDS: ${topic.keywords.join(', ')}
CATEGORY: ${topic.category}
WORD COUNT: 1800–2400 words
READING LEVEL: Professional but accessible (like TechCrunch or The Verge)
TONE: Direct, knowledgeable, opinionated but fair — no fluff
AFFILIATE DISCLOSURE: Include a brief callout at the top noting some links may earn a commission

STRUCTURE REQUIRED (in this exact order):
1. Affiliate disclosure callout (see formatting below)
2. A compelling intro that addresses the reader's problem (3–4 sentences, no "In this article...")
3. A TL;DR / Quick Verdict block (see exact structure below) — front-loads the answer for featured snippets and AI citation engines
4. 4–6 main H2 sections covering: what each tool is, key features, pricing, pros/cons, who it's best for
5. A "Final Verdict" H2 with a clear recommendation, plus explicit "Best for" and "Avoid if" sentences
6. A "Frequently Asked Questions" H2 with 4+ Q/A pairs. Each answer MUST be 1–3 sentences only — short enough to be lifted as a featured snippet or read aloud by a voice assistant

CITATION REQUIREMENTS (GEO/AEO):
- Include at least 3 outbound citations to authoritative sources within the body
  (official product pages, official pricing pages, published studies, or reputable
  tech publications like TechCrunch, The Verge, Wired). Use descriptive anchor text —
  never "click here" or "this article".
- Citations must use rel="noopener" and target="_blank" — and rel="nofollow sponsored"
  for any link to a product you may earn commission on.

INTERNAL LINKING (SEO):
- Include at least 2 inline contextual links to other articles on tuningdigital.com
  using descriptive anchor text. Choose from the related-articles list shown below
  if any of those topics fit naturally into your body copy — link them inline rather
  than only mentioning the tool name in passing.
- Related articles available (link in the format: /blog/{slug}.html):
${related.map(r => `    • ${r.title} → /blog/${r.slug}.html`).join('\n')}
- Internal links use plain href (no rel="nofollow", no target="_blank") so link
  equity flows internally.

FORMATTING REQUIREMENTS:
- Use proper HTML heading tags (h2, h3) — no markdown
- Wrap the article content in <article class="article-body"> tags
- Include an <aside class="toc"> table of contents at the top, after the disclosure and intro
- Bold key terms and tool names with <strong>
- Use <ul> lists for pros/cons
- Include a <blockquote> with a realistic user quote for social proof
- Affiliate disclosure: <div class="callout callout-accent">…</div>
- TL;DR block: use EXACTLY this structure (do not deviate from the class names):
  <div class="tldr-box">
    <h2 class="tldr-title">Quick Verdict</h2>
    <p class="tldr-summary">[2–3 sentence direct answer. Name the winner, who it's for, and the single most important reason.]</p>
    <ul class="tldr-list">
      <li><strong>Best for:</strong> [one concrete user type]</li>
      <li><strong>Avoid if:</strong> [one disqualifying scenario]</li>
      <li><strong>Pricing from:</strong> [headline price, or "Free" — note "check current pricing"]</li>
    </ul>
  </div>

VOICE / ANTI-AI-DETECTION REQUIREMENTS (important — AdSense and search engines flag uniform AI prose):
- Write as a real human editor at a small UK-based independent publication, not as an AI generating "comprehensive" content.
- Use specific, concrete examples wherever possible ("I tested it on a 12,000-word client brief" not "I tested it on a long document").
- Vary sentence length aggressively — mix short punchy lines with longer analytical sentences. AI-generated prose tends to land on the same medium length; real editorial has rhythm.
- Allow opinions, hedges, and the occasional digression. Real editorial has peaks and valleys.
- Use British English spelling (organise, optimise, behaviour, prioritise, colour, recognised).
- Where it fits naturally, reference UK context (£ pricing alongside $, UK GDPR not just GDPR).
- Do NOT structure every section identically — some sections can be 2 paragraphs, some 5, some with sub-bullets, some without.
- Drop overused AI hedges: "However, it's worth noting", "On the other hand", "When it comes to", "In the world of", "Furthermore", "Moreover", "Additionally". Use simpler connectors or just start a new sentence.
- Use em-dashes sparingly. AI overuses them as a punctuation rhythm. Mix with commas, semicolons, full stops.

DO NOT include:
- The <html>, <head>, <body>, <nav>, or <footer> tags (this goes inside a template)
- Any meta tags or scripts
- Specific prices that may have changed — refer readers to the vendor's current pricing page
- Fabricated statistics, fake user counts, invented case studies, or attributions to people who don't exist
- Filler openers: "In conclusion", "It goes without saying", "In today's digital landscape", "In the rapidly evolving world of"
- Self-referential language like "this article will show" or "as we'll see" — readers don't need to be told the structure

Return ONLY the article HTML, starting with the <article> tag.`;
}

// ─── PICK RELATED TOPICS ──────────────────────────────────
// Picks `count` topics from TOPIC_BANK that aren't the current topic.
// Prioritises same-category entries; falls back to other categories if needed.
function pickRelatedTopics(currentTopic, count = 3) {
  const others = TOPIC_BANK.filter(t => t.slug !== currentTopic.slug);
  const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a,b) => a[0] - b[0]).map(x => x[1]);
  const same = shuffle(others.filter(t => t.category === currentTopic.category));
  const rest = shuffle(others.filter(t => t.category !== currentTopic.category));
  return [...same, ...rest].slice(0, count);
}

// ─── EXTRACT FAQS FROM GENERATED ARTICLE HTML ─────────────
// Looks for an H2 containing "Frequently Asked Questions" (or "FAQ") and
// pulls out subsequent H3/Q + paragraph/A pairs until the next H2 or end of body.
// Returns an array of {question, answer} objects (may be empty if not found).
function extractFaqs(articleHtml) {
  const faqs = [];
  // Match the FAQ section: H2 heading + everything until next H2 (or end)
  const sectionRe = /<h2[^>]*>\s*(?:Frequently Asked Questions|FAQ|FAQs)[^<]*<\/h2>([\s\S]*?)(?=<h2|<\/article|$)/i;
  const m = articleHtml.match(sectionRe);
  if (!m) return faqs;
  const section = m[1];
  // Pattern: H3 (question) followed by one or more paragraphs (answer)
  const itemRe = /<h3[^>]*>([\s\S]*?)<\/h3>\s*((?:<p[^>]*>[\s\S]*?<\/p>\s*)+)/g;
  let it;
  while ((it = itemRe.exec(section)) !== null) {
    const q = it[1].replace(/<[^>]+>/g, '').trim();
    // Strip HTML tags from answer paragraphs
    const a = it[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (q && a) faqs.push({ question: q, answer: a });
  }
  return faqs;
}

// ─── HTML PAGE TEMPLATE ───────────────────────────────────
function wrapInTemplate(topic, articleHtml, publishDate) {
  const formattedDate = new Date(publishDate).toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
  const isoDate = new Date(publishDate).toISOString();
  const related = pickRelatedTopics(topic, 3);
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${topic.title} | ${CONFIG.siteName}</title>
  <meta name="description" content="Independent review and comparison: ${topic.title}. Expert analysis, real-world testing, and honest recommendations.">
  <meta name="keywords" content="${topic.keywords.join(',')}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${CONFIG.siteUrl}/blog/${topic.slug}.html">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${CONFIG.siteUrl}/blog/${topic.slug}.html">
  <meta property="og:title" content="${topic.title} | ${CONFIG.siteName}">
  <meta property="og:description" content="Independent review: ${topic.title}. Expert analysis and honest recommendations.">
  <meta property="article:published_time" content="${isoDate}">
  <meta property="og:image" content="${CONFIG.siteUrl}/assets/img/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#060812">
  <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
  <link rel="alternate" type="application/rss+xml" title="Tuning Digital — Reviews & Comparisons" href="/feed.xml">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"${topic.title}","datePublished":"${isoDate}","dateModified":"${isoDate}","author":{"@type":"Person","name":"${CONFIG.authorName}","jobTitle":"${CONFIG.authorRole}","url":"${CONFIG.siteUrl}/about.html#editor","worksFor":{"@type":"Organization","name":"${CONFIG.siteName}","url":"${CONFIG.siteUrl}"}},"publisher":{"@type":"Organization","name":"${CONFIG.siteName}","url":"${CONFIG.siteUrl}"},"mainEntityOfPage":"${CONFIG.siteUrl}/blog/${topic.slug}.html","keywords":"${topic.keywords.join(',')}","articleSection":"${topic.category}"}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${CONFIG.siteUrl}/"},{"@type":"ListItem","position":2,"name":"Blog","item":"${CONFIG.siteUrl}/blog/"},{"@type":"ListItem","position":3,"name":"${topic.title}","item":"${CONFIG.siteUrl}/blog/${topic.slug}.html"}]}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Review","itemReviewed":{"@type":"SoftwareApplication","name":"${topic.title.replace(/"/g, '\\"')}","applicationCategory":"BusinessApplication"},"reviewRating":{"@type":"Rating","ratingValue":"4.5","bestRating":"5","worstRating":"1"},"author":{"@type":"Person","name":"${CONFIG.authorName}","url":"${CONFIG.siteUrl}/about.html#editor"},"publisher":{"@type":"Organization","name":"${CONFIG.siteName}","url":"${CONFIG.siteUrl}"},"datePublished":"${isoDate}","reviewBody":"Independent review and comparison covering ${topic.category.toLowerCase()}: ${topic.title.replace(/"/g, '\\"')}. Real-world testing, honest pros and cons, and a clear verdict on who each tool is best for."}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","url":"${CONFIG.siteUrl}/blog/${topic.slug}.html","speakable":{"@type":"SpeakableSpecification","cssSelector":[".tldr-box",".tldr-summary",".tldr-list"]}}
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
        <li><a href="/blog/" class="active">Blog</a></li>
        <li><a href="/about.html">About</a></li>
      </ul>
      <a href="/tools/" class="nav-cta">Explore Tools →</a>
      <button class="nav-mobile-toggle" id="mobileToggle"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="mobile-nav" id="mobileNav">
  <a href="/tools/">Tools</a><a href="/blog/">Blog</a><a href="/about.html">About</a>
</div>
<main>
  <div class="container" style="padding-top:48px">
    <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/blog/">Blog</a><span>/</span><span>${topic.title}</span></nav>
    <header class="article-header">
      <p class="label">${topic.category}</p>
      <h1>${topic.title}</h1>
      <div class="article-meta">
        <span>📅 ${formattedDate}</span>
        <span>✍️ <a href="/about.html#editor" style="color:inherit;text-decoration:none;border-bottom:1px dotted currentColor">${CONFIG.authorName}</a></span>
        <span>🔄 Updated regularly</span>
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
          <h4>Related Articles</h4>
          <ul>
${related.map(r => `            <li><a href="/blog/${r.slug}.html">→ ${r.title}</a></li>`).join('\n')}
          </ul>
        </div>
        <div class="sidebar-card mt-16">
          <h4>Related Tools</h4>
          <ul>
            <li><a href="/tools/">→ Browse All Tools</a></li>
            <li><a href="/tools/saas-cost-calculator.html">→ SaaS Cost Calculator</a></li>
          </ul>
        </div>
        <div class="sidebar-card mt-16" style="background:var(--accent-glow);border-color:rgba(0,229,212,.2)">
          <h4>Free Calculator</h4>
          <p style="font-size:.85rem;margin:8px 0 14px;max-width:none">Calculate your total SaaS spend and find overlaps.</p>
          <a href="/tools/saas-cost-calculator.html" class="btn btn-primary btn-sm w-full" style="justify-content:center">Open Calculator</a>
        </div>
      </aside>
    </div>
    <!-- ─── MULTIPLEX: End-of-article discovery ─────────────── -->
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
  </div>
</footer>
<script src="/assets/js/main.js"></script>
</body>
</html>`;
}

// ─── API CALL ─────────────────────────────────────────────
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CONFIG.model,
      max_tokens: 8192, // bumped from 4096 — long-form articles + all required sections (incl. FAQ + Final Verdict) need the headroom
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

// ─── GENERATE ARTICLE ─────────────────────────────────────
async function generateArticle(topic) {
  if (!CONFIG.apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  console.log(`\n📝 Generating: "${topic.title}"...`);
  const prompt = buildPrompt(topic);
  const articleHtml = await callClaude(prompt);

  const publishDate = new Date().toISOString();
  const fullPage = wrapInTemplate(topic, articleHtml, publishDate);

  const outputPath = path.join(CONFIG.outputDir, `${topic.slug}.html`);
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  fs.writeFileSync(outputPath, fullPage, 'utf8');

  console.log(`✅ Saved: blog/${topic.slug}.html`);

  // Update sitemap + RSS feed
  updateSitemap(topic, publishDate);
  updateFeed(topic, publishDate);

  return { topic, path: outputPath, publishDate };
}

// ─── UPDATE SITEMAP ───────────────────────────────────────
function updateSitemap(topic, date) {
  const sitemapPath = path.join(__dirname, '../../sitemap.xml');
  try {
    let xml = fs.readFileSync(sitemapPath, 'utf8');
    const newEntry = `  <url>
    <loc>${CONFIG.siteUrl}/blog/${topic.slug}.html</loc>
    <lastmod>${date.split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    if (!xml.includes(topic.slug)) {
      xml = xml.replace('</urlset>', newEntry + '\n</urlset>');
      fs.writeFileSync(sitemapPath, xml, 'utf8');
      console.log(`🗺️  Updated sitemap.xml`);
    }
  } catch(e) { console.warn('⚠️  Could not update sitemap:', e.message); }
}

// ─── UPDATE RSS FEED ──────────────────────────────────────
function updateFeed(topic, date) {
  const feedPath = path.join(__dirname, '../../feed.xml');
  const url = `${CONFIG.siteUrl}/blog/${topic.slug}.html`;
  const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  // RFC 822 date for RSS pubDate
  const d = new Date(date);
  const pubDate = d.toUTCString();
  const desc = `Independent review and comparison: ${topic.title}. Expert analysis, real-world testing, and honest recommendations.`;
  const newItem = `    <item>
      <title>${xmlEscape(topic.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xmlEscape(desc)}</description>
      <category>${xmlEscape(topic.category)}</category>
      <dc:creator>${xmlEscape(CONFIG.authorName)}</dc:creator>
      <pubDate>${pubDate}</pubDate>
    </item>`;
  try {
    let xml = fs.readFileSync(feedPath, 'utf8');
    if (xml.includes(url)) return; // already present
    // Refresh lastBuildDate
    xml = xml.replace(/<lastBuildDate>[^<]+<\/lastBuildDate>/, `<lastBuildDate>${pubDate}</lastBuildDate>`);
    // Insert new item right after the <ttl> closing tag (i.e. at the top of the items list — newest first)
    xml = xml.replace(/(<ttl>\d+<\/ttl>\s*)/, `$1\n${newItem}\n`);
    fs.writeFileSync(feedPath, xml, 'utf8');
    console.log(`📰 Updated feed.xml`);
  } catch(e) { console.warn('⚠️  Could not update feed.xml:', e.message); }
}

// ─── CLI ──────────────────────────────────────────────────
// Only run the CLI block when this file is executed directly (`node content-engine.js …`),
// not when it's imported by another module (e.g. tool-page-engine.js requires TOPIC_BANK).
if (require.main === module) {
const [,, command, arg] = process.argv;

(async () => {
  if (command === 'topics') {
    console.log('\n📚 Available topics:\n');
    TOPIC_BANK.forEach((t, i) => console.log(`  ${i+1}. ${t.title}`));
    console.log(`\nRun: node content-engine.js generate ${'{slug}'}\n`);

  } else if (command === 'generate') {
    const topic = arg
      ? TOPIC_BANK.find(t => t.slug === arg) || TOPIC_BANK[0]
      : TOPIC_BANK[Math.floor(Math.random() * TOPIC_BANK.length)];
    try { await generateArticle(topic); }
    catch(e) { console.error('❌ Error:', e.message); process.exit(1); }

  } else if (command === 'batch') {
    const count = parseInt(arg) || 3;
    const shuffled = [...TOPIC_BANK].sort(() => Math.random() - .5).slice(0, count);
    for (const topic of shuffled) {
      try {
        await generateArticle(topic);
        await new Promise(r => setTimeout(r, 2000)); // rate limit buffer
      } catch(e) { console.error(`❌ Failed ${topic.slug}:`, e.message); }
    }
    console.log(`\n🎉 Generated ${count} articles`);

  } else {
    console.log(`
Tuning Digital — Content Engine
Usage:
  node content-engine.js topics           List all available topics
  node content-engine.js generate         Generate a random article
  node content-engine.js generate {slug}  Generate specific article
  node content-engine.js batch 5          Generate 5 random articles

Requires: ANTHROPIC_API_KEY=your_key_here
    `);
  }
})();
}

module.exports = { generateArticle, TOPIC_BANK };
