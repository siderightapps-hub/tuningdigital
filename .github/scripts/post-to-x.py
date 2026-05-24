#!/usr/bin/env python3
"""
post-to-x.py — Post the newest unposted article from /feed.xml to @TuningDigital on X.

Reads:
  - feed.xml         (newest item first; this is the source of truth)
  - .x-posted.txt    (URLs already tweeted, one per line)

Writes:
  - .x-posted.txt    (appends the URL on successful post)

Exit codes:
  0 — success (posted, or nothing new to post — both are normal)
  1 — error (API failure, missing creds, malformed feed)

Required env vars (set as GitHub repo secrets):
  X_API_KEY         API Key (a.k.a. Consumer Key)
  X_API_SECRET      API Key Secret (a.k.a. Consumer Secret)
  X_ACCESS_TOKEN    Access Token (must have Read+Write permission)
  X_ACCESS_SECRET   Access Token Secret
"""

import os
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from requests_oauthlib import OAuth1Session
except ImportError:
    print("ERROR: requests_oauthlib not installed. "
          "Run: pip install requests-oauthlib", file=sys.stderr)
    sys.exit(1)

# ─── PATHS + CONSTANTS ────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FEED_PATH = REPO_ROOT / "feed.xml"
POSTED_PATH = REPO_ROOT / ".x-posted.txt"

TWEET_ENDPOINT = "https://api.twitter.com/2/tweets"

# X counts URLs as 23 chars after t.co shortening, regardless of actual length.
URL_SHORTEN_LEN = 23
MAX_TWEET_LEN = 280

# Per-run guardrails for batch operation (when multiple new articles ship together,
# e.g. batch 2 from generate-content.yml on Mon+Thu).
MAX_POSTS_PER_RUN = 5             # safety cap — if the state file got cleared accidentally, don't spam-tweet 30 backlog articles
POST_DELAY_SECONDS = 60           # space tweets ~1min apart so the timeline doesn't look bot-burst

# Template A — predictable length, can't exceed 280 even with long titles.
# {title} and {link} are filled at post time.
TWEET_TEMPLATE = """📰 New review:
{title}

→ {link}

#AITools #SaaS #productivity"""


# ─── HELPERS ──────────────────────────────────────────────
def get_env(name):
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return val


def all_feed_items():
    """Return a list of (title, link) tuples for every <item> in feed.xml,
    in feed order (newest first). Returns [] if feed is empty."""
    if not FEED_PATH.exists():
        print(f"ERROR: {FEED_PATH} not found", file=sys.stderr)
        sys.exit(1)
    try:
        tree = ET.parse(FEED_PATH)
    except ET.ParseError as e:
        print(f"ERROR: feed.xml is malformed: {e}", file=sys.stderr)
        sys.exit(1)
    items = []
    for item in tree.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if title and link:
            items.append((title, link))
    return items


def already_posted(url):
    if not POSTED_PATH.exists():
        return False
    with POSTED_PATH.open("r", encoding="utf-8") as fh:
        return any(line.strip() == url for line in fh)


def mark_posted(url):
    # Ensure trailing newline; create the file if it doesn't exist yet
    POSTED_PATH.touch(exist_ok=True)
    with POSTED_PATH.open("a", encoding="utf-8") as fh:
        fh.write(url + "\n")


def build_tweet(title, link):
    """Build tweet text, truncating title if needed to stay under 280 chars
    (URL counted as 23 chars per X's t.co shortening rule)."""
    # First attempt with full title
    tweet = TWEET_TEMPLATE.format(title=title, link=link)
    # X displays the full URL but counts it as URL_SHORTEN_LEN chars
    effective_len = len(tweet) - len(link) + URL_SHORTEN_LEN
    if effective_len <= MAX_TWEET_LEN:
        return tweet

    # Truncate title to fit
    overhead = effective_len - len(title)
    max_title_len = MAX_TWEET_LEN - overhead - 1  # -1 for ellipsis
    if max_title_len < 20:
        # Pathological case — shouldn't happen with our template
        print(f"ERROR: cannot fit tweet under {MAX_TWEET_LEN} chars even with truncation",
              file=sys.stderr)
        sys.exit(1)
    truncated_title = title[:max_title_len].rstrip() + "…"
    return TWEET_TEMPLATE.format(title=truncated_title, link=link)


def post_tweet(text):
    """POST to X API v2 /2/tweets with OAuth 1.0a user-context signing."""
    oauth = OAuth1Session(
        get_env("X_API_KEY"),
        client_secret=get_env("X_API_SECRET"),
        resource_owner_key=get_env("X_ACCESS_TOKEN"),
        resource_owner_secret=get_env("X_ACCESS_SECRET"),
    )
    r = oauth.post(TWEET_ENDPOINT, json={"text": text})
    if r.status_code not in (200, 201):
        print(f"ERROR: X API returned HTTP {r.status_code}", file=sys.stderr)
        print(f"Response body: {r.text}", file=sys.stderr)
        sys.exit(1)
    tweet_id = r.json().get("data", {}).get("id", "?")
    print(f"✅ Posted tweet id={tweet_id}")
    return tweet_id


# ─── MAIN ─────────────────────────────────────────────────
def main():
    items = all_feed_items()
    if not items:
        print("ℹ️  feed.xml has no items — nothing to post")
        return

    # Filter to items we haven't tweeted yet. feed.xml is newest-first, so this
    # natural order means newest unposted gets tweeted first (the freshest
    # article gets prime placement on the timeline).
    unposted = [(t, l) for (t, l) in items if not already_posted(l)]
    print(f"Feed has {len(items)} items; {len(unposted)} unposted")

    if not unposted:
        print("ℹ️  Nothing new to post — all caught up")
        return

    to_post = unposted[:MAX_POSTS_PER_RUN]
    skipped = len(unposted) - len(to_post)

    for i, (title, link) in enumerate(to_post):
        if i > 0:
            print(f"\n⏱️  Sleeping {POST_DELAY_SECONDS}s before next post…")
            time.sleep(POST_DELAY_SECONDS)
        tweet = build_tweet(title, link)
        print(f"\n[{i+1}/{len(to_post)}] {title}")
        print(f"---\n{tweet}\n---")
        post_tweet(tweet)
        mark_posted(link)
        print(f"📝 Recorded: {link}")

    print(f"\n✅ Total posted this run: {len(to_post)}")
    if skipped > 0:
        print(f"⚠️  {skipped} additional unposted items deferred to next run "
              f"(per-run safety cap of {MAX_POSTS_PER_RUN}).")


if __name__ == "__main__":
    main()
