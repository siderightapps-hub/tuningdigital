/**
 * Tuning Digital — newsletter subscribe + unsubscribe endpoint
 *
 * Routes (set in wrangler.toml):
 *   POST /api/subscribe   — add to Resend audience, fire welcome email
 *   GET  /u — verify HMAC token, mark contact unsubscribed
 *   POST /u — same (for List-Unsubscribe-Post one-click)
 *
 * Env (set via `wrangler secret put`):
 *   RESEND_API_KEY       — re_xxx Resend API key
 *   RESEND_AUDIENCE_ID   — UUID of the TD audience in Resend
 *   UNSUBSCRIBE_SECRET   — random ≥32-char string, signs unsub URL tokens
 *
 * Why a Worker: TD is static HTML on GitHub Pages with no server, so the
 * form needs an external endpoint to call. Workers sit in front of GH Pages
 * already (Cloudflare proxies the zone), so `/api/*` lands here instead
 * of going through to the static origin.
 */

const ALLOWED_ORIGINS = new Set([
  'https://tuningdigital.com',
  'https://www.tuningdigital.com',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── HMAC sign / verify (for unsubscribe URL tokens) ───────
async function hmacToken(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyToken(message, token, secret) {
  if (!token || typeof token !== 'string') return false;
  const expected = await hmacToken(message, secret);
  if (expected.length !== token.length) return false;
  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

async function buildUnsubscribeUrl(email, secret) {
  const token = await hmacToken(email, secret);
  return `https://tuningdigital.com/u?email=${encodeURIComponent(email)}&token=${token}`;
}

// ─── CORS / JSON helpers ───────────────────────────────────
function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://tuningdigital.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

// ─── Welcome email content ─────────────────────────────────
const WELCOME_FROM = 'Tuning Digital <hello@updates.tuningdigital.com>';
const WELCOME_SUBJECT = 'You\'re in — welcome to Tuning Digital';

const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Tuning Digital</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4f0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;color:#0d0d12;line-height:1.6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f4f0;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e0d8;border-radius:14px;">
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0d0d12;letter-spacing:-0.5px;margin-bottom:32px;">
                <span style="display:inline-block;width:10px;height:10px;background-color:#0052ff;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>Tuning Digital
              </div>

              <h1 style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;color:#0d0d12;margin:0 0 16px 0;line-height:1.2;letter-spacing:-0.5px;">
                You're in.
              </h1>

              <p style="font-size:16px;color:#0d0d12;margin:0 0 16px 0;line-height:1.6;">
                Thanks for subscribing. You'll get independent reviews and comparisons of AI and SaaS productivity tools — hands-on testing, honest verdicts, no vendor fluff.
              </p>

              <p style="font-size:16px;color:#0d0d12;margin:0 0 16px 0;line-height:1.6;">
                We send when there's something genuinely worth your time. Usually that's one email a week, sometimes less. Never more than two.
              </p>

              <p style="font-size:16px;color:#0d0d12;margin:0 0 24px 0;line-height:1.6;">
                In the meantime, three pieces our readers come back to:
              </p>

              <ul style="padding:0 0 0 20px;margin:0 0 32px 0;">
                <li style="margin-bottom:10px;font-size:16px;">
                  <a href="https://tuningdigital.com/blog/ahrefs-vs-semrush-seo-tools.html" style="color:#0052ff;text-decoration:underline;">Ahrefs vs SEMrush (2026) — head-to-head</a>
                </li>
                <li style="margin-bottom:10px;font-size:16px;">
                  <a href="https://tuningdigital.com/blog/zapier-vs-make-automation.html" style="color:#0052ff;text-decoration:underline;">Zapier vs Make — which automation tool wins</a>
                </li>
                <li style="margin-bottom:10px;font-size:16px;">
                  <a href="https://tuningdigital.com/tools/saas-cost-calculator.html" style="color:#0052ff;text-decoration:underline;">Free SaaS Cost Calculator — audit your stack in 60 seconds</a>
                </li>
              </ul>

              <p style="font-size:16px;color:#0d0d12;margin:0 0 8px 0;line-height:1.6;">
                — Alex
              </p>
              <p style="font-size:14px;color:#6b6a64;margin:0;line-height:1.6;">
                Alex Bacsa<br>
                Founder &amp; Editor, Tuning Digital
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 32px 40px;border-top:1px solid #e2e0d8;font-size:12px;color:#6b6a64;line-height:1.5;">
              You're getting this because you subscribed at <a href="https://tuningdigital.com" style="color:#6b6a64;text-decoration:underline;">tuningdigital.com</a>.<br>
              Changed your mind? <a href="{{UNSUBSCRIBE_URL}}" style="color:#6b6a64;text-decoration:underline;">Unsubscribe in one click</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const WELCOME_TEXT = `You're in.

Thanks for subscribing to Tuning Digital. You'll get independent reviews and comparisons of AI and SaaS productivity tools — hands-on testing, honest verdicts, no vendor fluff.

We send when there's something genuinely worth your time. Usually that's one email a week, sometimes less. Never more than two.

In the meantime, three pieces our readers come back to:

  • Ahrefs vs SEMrush (2026) — head-to-head
    https://tuningdigital.com/blog/ahrefs-vs-semrush-seo-tools.html

  • Zapier vs Make — which automation tool wins
    https://tuningdigital.com/blog/zapier-vs-make-automation.html

  • Free SaaS Cost Calculator — audit your stack in 60 seconds
    https://tuningdigital.com/tools/saas-cost-calculator.html

— Alex

Alex Bacsa
Founder & Editor, Tuning Digital

---

You're getting this because you subscribed at tuningdigital.com.
Changed your mind? Unsubscribe: {{UNSUBSCRIBE_URL}}`;

async function sendWelcomeEmail(toEmail, env) {
  try {
    const unsubscribeUrl = env.UNSUBSCRIBE_SECRET
      ? await buildUnsubscribeUrl(toEmail, env.UNSUBSCRIBE_SECRET)
      : 'https://tuningdigital.com';

    const html = WELCOME_HTML.replace(/{{UNSUBSCRIBE_URL}}/g, unsubscribeUrl);
    const text = WELCOME_TEXT.replace(/{{UNSUBSCRIBE_URL}}/g, unsubscribeUrl);

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: WELCOME_FROM,
        to: [toEmail],
        subject: WELCOME_SUBJECT,
        html,
        text,
        // RFC 8058 one-click unsubscribe — Gmail / Apple Mail show a native
        // "Unsubscribe" button at the top of the email when these are set.
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error('Welcome email failed:', resp.status, body);
    } else {
      const result = await resp.json().catch(() => ({}));
      console.log('Welcome email sent:', result.id || 'unknown-id');
    }
  } catch (e) {
    console.error('Welcome email error:', e.message);
  }
}

// ─── Unsubscribe confirmation page ─────────────────────────
function unsubscribeHtml(success, msg) {
  const title = success ? "You're unsubscribed" : "Couldn't unsubscribe";
  const subhead = success
    ? "You won't receive any more emails from Tuning Digital."
    : (msg || 'Something went wrong.');
  const body = success
    ? 'If this was a mistake, you can resubscribe anytime at <a href="https://tuningdigital.com" style="color:#0052ff;text-decoration:underline;">tuningdigital.com</a>.'
    : "If the problem persists, reply to any TD email and we'll handle it manually.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Tuning Digital</title>
  <style>
    body { margin:0; padding:0; background:#f5f4f0; color:#0d0d12; font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif; line-height:1.6; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:#ffffff; border:1px solid #e2e0d8; border-radius:14px; max-width:480px; padding:40px; margin:20px; box-shadow:0 2px 12px rgba(13,13,18,.06); }
    h1 { font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif; font-size:28px; margin:0 0 12px; letter-spacing:-0.5px; color:#0d0d12; }
    p { margin:0 0 12px; color:#6b6a64; font-size:15px; }
    .brand { font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif; font-size:18px; font-weight:700; margin-bottom:24px; color:#0d0d12; letter-spacing:-0.3px; }
    .brand-dot { display:inline-block; width:8px; height:8px; background:#0052ff; border-radius:50%; margin-right:6px; vertical-align:middle; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="brand-dot"></span>Tuning Digital</div>
    <h1>${title}</h1>
    <p>${subhead}</p>
    <p>${body}</p>
  </div>
</body>
</html>`;
}

// ─── Route handlers ────────────────────────────────────────
async function handleSubscribe(request, env, ctx, origin) {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  // Honeypot — bots fill this; humans don't see it
  if (body.website && body.website.length > 0) {
    return json({ success: true }, 200, origin);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'invalid_email' }, 400, origin);
  }

  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    console.error('Missing RESEND_API_KEY or RESEND_AUDIENCE_ID');
    return json({ error: 'server_misconfigured' }, 500, origin);
  }

  let resendResp;
  try {
    resendResp = await fetch(
      `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      }
    );
  } catch (e) {
    console.error('Resend fetch failed:', e.message);
    return json({ error: 'upstream_unreachable' }, 502, origin);
  }

  const result = await resendResp.json().catch(() => ({}));

  if (resendResp.ok) {
    ctx.waitUntil(sendWelcomeEmail(email, env));
    return json({ success: true, contact_id: result.id || null }, 200, origin);
  }
  if (resendResp.status === 422 && (result.message || '').toLowerCase().includes('already')) {
    return json({ success: true, already_subscribed: true }, 200, origin);
  }

  console.error('Resend error:', resendResp.status, JSON.stringify(result));
  return json(
    { error: 'subscribe_failed', detail: result.message || `resend_${resendResp.status}` },
    502,
    origin
  );
}

async function handleUnsubscribe(request, env) {
  // GET = link click in email body, POST = List-Unsubscribe one-click header
  // Both result in the same action: mark contact unsubscribed in Resend.
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const token = (url.searchParams.get('token') || '').trim();
  const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' };

  if (!email || !token) {
    return new Response(unsubscribeHtml(false, 'Missing email or token in the URL.'), {
      status: 400,
      headers: htmlHeaders,
    });
  }

  if (!env.UNSUBSCRIBE_SECRET || !env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    console.error('Unsubscribe: missing secret(s)');
    return new Response(unsubscribeHtml(false, 'Server is not configured.'), {
      status: 500,
      headers: htmlHeaders,
    });
  }

  const valid = await verifyToken(email, token, env.UNSUBSCRIBE_SECRET);
  if (!valid) {
    return new Response(unsubscribeHtml(false, 'This unsubscribe link is invalid or has expired.'), {
      status: 400,
      headers: htmlHeaders,
    });
  }

  try {
    const resp = await fetch(
      `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unsubscribed: true }),
      }
    );
    // 404 = contact not found in Resend (already deleted or never existed)
    // — still treat as success from the user's perspective
    if (!resp.ok && resp.status !== 404) {
      const body = await resp.text();
      console.error('Resend unsub failed:', resp.status, body);
      return new Response(
        unsubscribeHtml(false, "Something went wrong. Reply to any TD email and we'll handle it manually."),
        { status: 502, headers: htmlHeaders }
      );
    }
  } catch (e) {
    console.error('Unsub fetch error:', e.message);
    return new Response(unsubscribeHtml(false, 'Network error. Try again in a moment.'), {
      status: 502,
      headers: htmlHeaders,
    });
  }

  return new Response(unsubscribeHtml(true), { status: 200, headers: htmlHeaders });
}

// ─── Main router ───────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/subscribe') {
      return handleSubscribe(request, env, ctx, origin);
    }
    if (url.pathname === '/u') {
      return handleUnsubscribe(request, env);
    }

    return json({ error: 'not_found' }, 404, origin);
  },
};
