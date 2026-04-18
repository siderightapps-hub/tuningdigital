const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const POSTS_DIR = path.join(process.cwd(), 'src', 'posts');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const BASE_URL = 'https://www.tuningdigital.com';

function getAllPosts() {
  const files = fs.readdirSync(POSTS_DIR);
  return files
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      return slug;
    });
}

function generate() {
  const slugs = getAllPosts();

  const pages = [
    '',
    '/blog',
    ...slugs.map((slug) => `/blog/${slug}`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `
  <url>
    <loc>${BASE_URL}${p}</loc>
  </url>`
  )
  .join('')}
</urlset>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), xml);
  console.log('✔ sitemap.xml generated');
}

generate();
