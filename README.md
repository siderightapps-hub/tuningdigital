# Tuning Digital — tuningdigital.com

> Independent reviews and comparisons of AI & SaaS productivity tools.  
> AdSense + affiliate + sponsored posts · Static site · GitHub Pages

---

## 🗂 Project Structure

```
tuningdigital/
├── index.html                        ← Homepage
├── blog/
│   ├── index.html                    ← Blog listing
│   └── best-ai-writing-tools-2025.html ← Sample article
├── tools/
│   ├── index.html                    ← Tools directory
│   └── saas-cost-calculator.html     ← Interactive tool
├── about.html
├── privacy-policy.html               ← Required for AdSense
├── 404.html
├── sitemap.xml
├── robots.txt
├── manifest.json
├── assets/
│   ├── css/main.css                  ← All styles
│   ├── js/
│   │   ├── main.js                   ← Shared JS
│   │   └── content-engine.js         ← Claude API article generator
│   └── img/
│       └── favicon.svg
├── .github/workflows/
│   ├── deploy.yml                    ← Auto-deploy to GitHub Pages
│   └── generate-content.yml          ← Weekly article generation
├── SEO-BACKLINK-STRATEGY.md
└── README.md
```

---

## 🚀 Deployment to GitHub Pages

### Step 1: Create a GitHub repository
1. Go to https://github.com/new
2. Name it `tuningdigital` (or anything you like)
3. Set to **Public**
4. Don't initialise with README (you already have one)

### Step 2: Push the files
```bash
cd tuningdigital/
git init
git add .
git commit -m "Initial site build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tuningdigital.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Under "Source", select **GitHub Actions**
3. The deploy workflow will run automatically on every push to `main`
4. Your site will be live at `https://YOUR_USERNAME.github.io/tuningdigital/`

### Step 4: Connect custom domain
1. In GitHub Pages settings, enter `tuningdigital.com` as custom domain
2. In your domain registrar's DNS settings, add:
   - `A` record: `185.199.108.153`
   - `A` record: `185.199.109.153`
   - `A` record: `185.199.110.153`
   - `A` record: `185.199.111.153`
   - `CNAME` record: `www` → `YOUR_USERNAME.github.io`
3. Enable "Enforce HTTPS" in GitHub Pages settings

---

## 🔧 Required Replacements

Before going live, replace these placeholders in all HTML files:

| Placeholder | Replace with | Where |
|------------|-------------|-------|
| `G-XXXXXXXXXX` | Your GA4 Measurement ID | All HTML files |
| `ca-pub-XXXXXXXXXX` | Your AdSense publisher ID | All HTML files |
| `https://your-email-service.com/subscribe` | Your Mailchimp/ConvertKit endpoint | index.html, blog/index.html, tools/index.html |
| `@tuningdigital` | Your actual Twitter/X handle | index.html footer |
| `privacy@tuningdigital.com` | Your actual email | privacy-policy.html |
| `hello@tuningdigital.com` | Your actual contact email | about.html |

**Quick find-and-replace command (runs on Mac/Linux):**
```bash
# Replace GA4 ID
find . -name "*.html" -exec sed -i '' 's/G-XXXXXXXXXX/G-YOUR_REAL_ID/g' {} \;

# Replace AdSense ID
find . -name "*.html" -exec sed -i '' 's/ca-pub-XXXXXXXXXX/ca-pub-YOUR_REAL_ID/g' {} \;
```

---

## ✍️ Automated Content Generation

The content engine generates SEO-optimised articles using the Claude API.

### Setup
```bash
# Install Node.js (if not already installed)
node --version   # should be v18+

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Generate a single article
node assets/js/content-engine.js generate

# Generate 3 articles
node assets/js/content-engine.js batch 3

# List all available topics
node assets/js/content-engine.js topics
```

### GitHub Actions (automated weekly)
1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: your Anthropic API key
5. Every Monday at 08:00 UTC, one new article is generated and committed automatically

### Add new topics
Edit `assets/js/content-engine.js` — add entries to the `TOPIC_BANK` array:
```js
{ 
  slug: 'my-new-article-slug', 
  title: 'My Article Title', 
  category: 'AI Tools', 
  keywords: ['keyword one', 'keyword two'] 
},
```

---

## 💰 AdSense Setup

1. Apply at https://adsense.google.com
2. Add your site URL
3. Google will review your site (takes 1–14 days — Privacy Policy is already included)
4. Once approved, replace `ca-pub-XXXXXXXXXX` with your real publisher ID
5. Replace ad slot IDs (`1234567890` etc.) with your actual slot IDs from AdSense dashboard

**Ad slots placed:**
- Homepage: leaderboard (top), rectangle (mid-page)
- Blog listing: leaderboard (top), square (in grid)
- Article pages: leaderboard (top), in-article square, sidebar square
- Tools pages: leaderboard (top), sidebar rectangle

---

## 🔗 Affiliate Setup

Apply to these programmes first (highest commission, most relevant):

1. **Notion** — notion.so/affiliate
2. **HubSpot** — hubspot.com/partners (30% recurring)
3. **Jasper AI** — jasper.ai/affiliate (30% recurring)
4. **Ahrefs** — ahrefs.com/affiliate
5. **Amazon Associates** — affiliate-program.amazon.co.uk

After approval, replace the raw tool URLs in HTML files with your affiliate tracking links.

---

## 📊 SEO Checklist (post-launch)

- [ ] Submit sitemap: https://search.google.com/search-console → Sitemaps → Add `/sitemap.xml`
- [ ] Verify domain in Search Console
- [ ] Submit to Bing Webmaster Tools: https://www.bing.com/webmasters
- [ ] Test structured data: https://search.google.com/test/rich-results
- [ ] Test Core Web Vitals: https://pagespeed.web.dev
- [ ] Create Google My Business if you have a physical address (optional)
- [ ] List SaaS Calculator on Product Hunt
- [ ] Submit to AI tool directories (see SEO-BACKLINK-STRATEGY.md)

---

## 📧 Newsletter Setup

The forms currently POST to `https://your-email-service.com/subscribe`.  
Replace with your email service's API endpoint or embed form:

- **Mailchimp**: Use their embedded form action URL
- **ConvertKit**: Use their form embed or API endpoint
- **Beehiiv**: Use their subscribe URL
- **Ghost**: If you migrate to Ghost, newsletter is built in

---

## 🛠 Local Development

No build step needed — this is plain HTML/CSS/JS.

```bash
# Option 1: Python HTTP server
python3 -m http.server 8000
# Visit http://localhost:8000

# Option 2: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option 3: Node.js http-server
npx http-server . -p 8000
```

---

## 📁 Adding New Pages

**New blog article:**
1. Copy `blog/best-ai-writing-tools-2025.html` as a template
2. Update: title, meta description, canonical URL, h1, article content, JSON-LD dates
3. Add to `sitemap.xml`
4. Link from `blog/index.html`

**New tool:**
1. Copy `tools/saas-cost-calculator.html` as a template
2. Build your tool logic in the `<script>` at the bottom
3. Add to `sitemap.xml` and `tools/index.html`

---

*Built by Claude for Tuning Digital — tuningdigital.com*
