/**
 * Tuning Digital — newsletter subscribe endpoint
 *
 * Routes:  POST https://tuningdigital.com/api/subscribe
 * Backend: Resend
 *   1. POST /audiences/{id}/contacts — adds subscriber to the list
 *   2. POST /emails — fires a welcome email (fire-and-forget via waitUntil)
 *
 * Env (set via `wrangler secret put`):
 *   RESEND_API_KEY      — re_xxx Resend API key
 *   RESEND_AUDIENCE_ID  — UUID of the TD audience in Resend
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
              You're getting this because you subscribed at <a href="https://tuningdigital.com" style="color:#6b6a64;text-decoration:underline;">tuningdigital.com</a>. If this wasn't you, no action needed — you won't hear from us again unless you sign up properly.
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

You're getting this because you subscribed at tuningdigital.com. If this wasn't you, no action needed — you won't hear from us again unless you sign up properly.`;

async function sendWelcomeEmail(toEmail, env) {
  try {
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
        html: WELCOME_HTML,
        text: WELCOME_TEXT,
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

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://tuningdigital.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, origin);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400, origin);
    }

    // Honeypot — bots fill this; humans don't see it
    if (body.website && body.website.length > 0) {
      // Pretend success so bots stop retrying
      return json({ success: true }, 200, origin);
    }

    const email = (body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return json({ error: 'invalid_email' }, 400, origin);
    }

    // Sanity: secrets configured?
    if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
      console.error('Missing RESEND_API_KEY or RESEND_AUDIENCE_ID');
      return json({ error: 'server_misconfigured' }, 500, origin);
    }

    // Forward to Resend
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

    // Resend returns 201 on create. Duplicate contacts return 422 with a
    // specific message — treat that as a soft success (user is already in).
    if (resendResp.ok) {
      // Fire welcome email in the background — don't block the response.
      // ctx.waitUntil keeps the Worker alive long enough to finish the send.
      ctx.waitUntil(sendWelcomeEmail(email, env));
      return json({ success: true, contact_id: result.id || null }, 200, origin);
    }
    if (resendResp.status === 422 && (result.message || '').toLowerCase().includes('already')) {
      // Already subscribed — don't re-send welcome email (would feel spammy).
      return json({ success: true, already_subscribed: true }, 200, origin);
    }

    // Real error
    console.error('Resend error:', resendResp.status, JSON.stringify(result));
    return json(
      { error: 'subscribe_failed', detail: result.message || `resend_${resendResp.status}` },
      502,
      origin
    );
  },
};
