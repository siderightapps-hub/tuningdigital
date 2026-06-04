# tuningdigital-subscribe — Cloudflare Worker

The newsletter subscribe endpoint for tuningdigital.com.

```
[browser form] —POST→ tuningdigital.com/api/subscribe → [this Worker] → Resend API → audience updated
```

The site is static HTML on GitHub Pages, so the form needs an external endpoint to receive submissions. Cloudflare already fronts the zone, so a Worker route at `/api/subscribe` intercepts cleanly without changing the static-site deploy.

## One-time setup

You only do this once.

### 1. Install wrangler (if not already)

```bash
npm install -g wrangler
wrangler --version
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

Opens a browser, log in, click Allow. `wrangler` stores the token in `~/.config/wrangler/`.

### 3. Grab your Resend audience ID

- Resend dashboard → **Audiences** → click the TD audience → copy the **Audience ID** from the URL or settings panel (it's a UUID like `abc12345-6789-...`).
- If you haven't created the TD audience yet: **Audiences → Create audience** → name it "Tuning Digital" → save → grab the ID.

### 4. Set both secrets

From this `cloudflare-worker/` directory:

```bash
wrangler secret put RESEND_API_KEY
# paste your re_xxx Resend API key, press Enter

wrangler secret put RESEND_AUDIENCE_ID
# paste the audience UUID, press Enter
```

Both secrets are stored encrypted in Cloudflare and only visible to the Worker at runtime. They never appear in this repo.

### 5. Deploy

```bash
wrangler deploy
```

Output should end with `Deployed tuningdigital-subscribe ...`. Cloudflare wires the routes from `wrangler.toml` automatically.

## Test it

From any terminal:

```bash
curl -X POST https://tuningdigital.com/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"yourpersonalemail@gmail.com"}'
```

Expected response: `{"success":true,"contact_id":"..."}`

Then check Resend dashboard → Audiences → Tuning Digital → the email should appear in the contact list.

Duplicate emails return `{"success":true,"already_subscribed":true}` — user-friendly.

## Watching live logs

```bash
wrangler tail
```

Then submit a form on the live site. Every POST + its result streams to your terminal in real time. Useful for debugging the first few subs.

## Updating the Worker code

Edit `worker.js`, save, `wrangler deploy` — usually under 5 seconds end-to-end.

## Architecture notes

- **CORS** is locked to `tuningdigital.com` and `www.tuningdigital.com` only — no third party can submit through this endpoint
- **Honeypot field** (`website`) — bots that auto-fill every field get a fake "success" so they stop retrying; real users don't see the field
- **Email validation** is sane but minimal — Resend rejects junk on its end too
- **Duplicate subscribers** are treated as success (better UX than "already subscribed" errors)
- **Secrets** are environment-scoped — rotating the Resend key only needs `wrangler secret put RESEND_API_KEY` again

## Rotating the API key

If the Resend key is ever leaked:

```bash
# In Resend: revoke the old key, create a new one
wrangler secret put RESEND_API_KEY   # paste new key
wrangler deploy                       # picks up the new env on next request anyway
```
