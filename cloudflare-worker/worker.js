/**
 * Tuning Digital — newsletter subscribe endpoint
 *
 * Routes:  POST https://tuningdigital.com/api/subscribe
 * Backend: Resend (audiences.contacts.create)
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
      return json({ success: true, contact_id: result.id || null }, 200, origin);
    }
    if (resendResp.status === 422 && (result.message || '').toLowerCase().includes('already')) {
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
