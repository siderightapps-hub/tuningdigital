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
};

// ─── TOPIC BANK ──────────────────────────────────────────
const TOPIC_BANK = [
  { slug: 'best-ai-productivity-apps-2026',      title: 'Best AI Productivity Apps 2026',         category: 'AI Tools',     keywords: ['AI productivity apps','best AI apps 2026'] },
  { slug: 'notion-vs-obsidian-pkm',              title: 'Notion vs Obsidian for PKM',             category: 'Productivity', keywords: ['notion vs obsidian','best note taking app'] },
  { slug: 'chatgpt-vs-perplexity-research',      title: 'ChatGPT vs Perplexity for Research',     category: 'AI Writing',   keywords: ['chatgpt vs perplexity','AI research tools'] },
  { slug: 'best-free-saas-tools-startups',       title: 'Best Free SaaS Tools for Startups',      category: 'SaaS',         keywords: ['free SaaS tools','startup tools 2026'] },
  { slug: 'zapier-vs-make-automation',           title: 'Zapier vs Make: Full Comparison 2026',   category: 'Automation',   keywords: ['zapier vs make','no-code automation tools'] },
  { slug: 'ai-image-generators-ranked',          title: 'AI Image Generators Ranked 2026',        category: 'AI Design',    keywords: ['best AI image generator','midjourney vs dall-e'] },
  { slug: 'reduce-saas-spend-guide',             title: 'How to Reduce SaaS Spend by 40%',        category: 'SaaS',         keywords: ['reduce SaaS costs','SaaS spend optimization'] },
  { slug: 'best-project-management-saas-2026',   title: 'Best Project Management SaaS 2026',      category: 'Productivity', keywords: ['best project management tool','jira vs linear'] },
  { slug: 'ahrefs-vs-semrush-seo-tools',        title: 'Ahrefs vs SEMrush: SEO Tools in 2026',  category: 'Analytics',    keywords: ['ahrefs vs semrush','best SEO tool 2026'] },
  { slug: 'linear-app-review',                   title: 'Linear App Review 2026',                 category: 'Productivity', keywords: ['linear app review','linear project management'] },
  { slug: 'chatgpt-vs-perplexity-research',      title: 'ChatGPT vs Perplexity for Research',     category: 'AI Writing',   keywords: ['chatgpt vs perplexity', 'AI research tools'] },
];

// ─── PROMPT TEMPLATE ─────────────────────────────────────
function buildPrompt(topic) {
  return `You are an expert tech writer for ${CONFIG.siteName}, an independent AI/SaaS productivity tools review site. Write a comprehensive, SEO-optimised blog article with the following specifications:

TOPIC: ${topic.title}
TARGET KEYWORDS: ${topic.keywords.join(', ')}
CATEGORY: ${topic.category}
WORD COUNT: 1800–2400 words
READING LEVEL: Professional but accessible (like TechCrunch or The Verge)
TONE: Direct, knowledgeable, opinionated but fair — no fluff
AFFILIATE DISCLOSURE: Include a brief callout at the top noting some links may earn a commission

STRUCTURE REQUIRED:
1. A compelling intro that addresses the reader's problem (3–4 sentences, no "In this article...")
2. A "Quick Verdict / TL;DR" box (2–3 sentences summary)
3. 4–6 main H2 sections covering: what each tool is, key features, pricing, pros/cons, best for
4. A "Final Verdict" section with clear recommendation
5. 3–4 FAQ questions with answers (for FAQ schema)

FORMATTING REQUIREMENTS:
- Use proper HTML heading tags (h2, h3) — no markdown
- Wrap the article content in <article class="article-body"> tags
- Include an <aside class="toc"> table of contents at the top
- Bold key terms and tool names with <strong>
- Use <ul> lists for pros/cons
- Include a <blockquote> with a realistic user quote for social proof
- Add a <div class="callout callout-accent"> for the affiliate disclosure
- Add a <div class="callout"> for the TL;DR

DO NOT include:
- The <html>, <head>, <body>, <nav>, or <footer> tags (this goes inside a template)
- Any meta tags or scripts
- Any prices that may have changed — note "check current pricing"
- Made-up statistics without attribution markers like "(industry data)" or "(user report)"
- Filler phrases like "In conclusion", "It goes without saying", "In today's digital landscape"

Return ONLY the article HTML, starting with the <article> tag.`;
}

// ─── HTML PAGE TEMPLATE ───────────────────────────────────
function wrapInTemplate(topic, articleHtml, publishDate) {
  const formattedDate = new Date(publishDate).toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
  const isoDate = new Date(publishDate).toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  <meta name="twitter:card" content="summary_large_image">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#060812">
  <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"${topic.title}","datePublished":"${isoDate}","dateModified":"${isoDate}","author":{"@type":"Organization","name":"${CONFIG.siteName}","url":"${CONFIG.siteUrl}"},"publisher":{"@type":"Organization","name":"${CONFIG.siteName}"},"mainEntityOfPage":"${CONFIG.siteUrl}/blog/${topic.slug}.html","keywords":"${topic.keywords.join(',')}","articleSection":"${topic.category}"}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${CONFIG.siteUrl}/"},{"@type":"ListItem","position":2,"name":"Blog","item":"${CONFIG.siteUrl}/blog/"},{"@type":"ListItem","position":3,"name":"${topic.title}","item":"${CONFIG.siteUrl}/blog/${topic.slug}.html"}]}
  </script>
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
        <span>✍️ ${CONFIG.siteName} Editorial</span>
        <span>🔄 AI-assisted research</span>
      </div>
    </header>
    <div class="ad-slot ad-slot-banner" style="margin-bottom:40px">
      <ins class="adsbygoogle" style="display:block" data-ad-client="${CONFIG.adsenseClient}" data-ad-slot="1234567890" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>
    <div class="article-layout">
      ${articleHtml}
      <aside class="sidebar">
        <div class="ad-slot ad-slot-square" style="margin-bottom:20px">
          <ins class="adsbygoogle" style="display:block" data-ad-client="${CONFIG.adsenseClient}" data-ad-slot="0987654321" data-ad-format="auto"></ins>
          <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
        </div>
        <div class="sidebar-card">
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
  </div>
</main>
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand"><div class="footer-logo"><span class="dot"></span>${CONFIG.siteName}</div><p>Independent AI and SaaS tool reviews.</p></div>
      <div class="footer-col"><h5>Tools</h5><ul><li><a href="/tools/">All Tools</a></li></ul></div>
      <div class="footer-col"><h5>Content</h5><ul><li><a href="/blog/">Blog</a></li></ul></div>
      <div class="footer-col"><h5>Company</h5><ul><li><a href="/about.html">About</a></li><li><a href="/privacy-policy.html">Privacy</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${CONFIG.siteName}. Affiliate disclosure: some links earn us a commission.</p>
      <div class="footer-bottom-links"><a href="/sitemap.xml">Sitemap</a><a href="/privacy-policy.html">Privacy</a></div>
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
      max_tokens: 4096,
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

  // Update sitemap
  updateSitemap(topic, publishDate);

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

// ─── CLI ──────────────────────────────────────────────────
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

module.exports = { generateArticle, TOPIC_BANK };
