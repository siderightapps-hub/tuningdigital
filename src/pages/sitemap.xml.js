import { getAllPosts } from 'lib/posts';

const BASE_URL = 'https://www.tuningdigital.com';

function generateSiteMap(slugs) {
  const pages = ['', '/blog', ...slugs.map((slug) => `/blog/${slug}`)];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map(
      (path) => `
    <url>
      <loc>${BASE_URL}${path}</loc>
    </url>`
    )
    .join('')}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  const posts = getAllPosts();
  const slugs = posts.map((p) => p.slug);
  const sitemap = generateSiteMap(slugs);

  res.setHeader('Content-Type', 'text/xml');
  res.write(sitemap);
  res.end();

  return { props: {} };
}

export default function SiteMap() {
  return null;
}
