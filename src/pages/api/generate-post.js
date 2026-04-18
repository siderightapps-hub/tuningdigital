import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, slug } = req.body || {};
  if (!topic) {
    return res.status(400).json({ error: 'Missing topic' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not set' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `
You are writing an SEO-optimised blog post for a site called "Tuning Digital" about the topic: "${topic}".

Return ONLY markdown with this structure:

---
title: "<compelling SEO title>"
date: "<YYYY-MM-DD>"
excerpt: "<1-2 sentence summary>"
---

# <Main heading>

Intro paragraph.

## Subheading 1

Content...

## Subheading 2

Content...

Use bullet points where helpful. Do NOT include any extra commentary outside the markdown.
`
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: 'Claude API error', details: text });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    const postsDir = path.join(process.cwd(), 'src', 'posts');
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true });
    }

    const safeSlug =
      slug ||
      topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const filename = `${safeSlug}.md`;
    const fullPath = path.join(postsDir, filename);

    fs.writeFileSync(fullPath, content, 'utf8');

    return res.status(200).json({ ok: true, filename, slug: safeSlug });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unexpected error', details: e.message });
  }
}
