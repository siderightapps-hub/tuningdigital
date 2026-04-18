#!/usr/bin/env node

const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const topic = process.argv.slice(2).join(' ');

if (!topic) {
  console.error('Usage: npm run new-post "topic here"');
  process.exit(1);
}

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/generate-post', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Error:', data);
      process.exit(1);
    }

    console.log('Post generated:', data);
  } catch (e) {
    console.error('Failed to call local API. Make sure `npm run dev` is running.');
    console.error(e.message);
    process.exit(1);
  }
})();
