# GSC Monitor

An [openclawhq.app](https://openclawhq.app) agent skill that monitors and analyzes Google Search Console data. Your AI agent connects to GSC via a service account, pulls search analytics, inspects URL indexing status, checks sitemaps, and surfaces keyword opportunities, CTR problems, and ranking trends — all read-only.

## What it does

Connect a Google service account and the agent can:

- **Track keyword rankings** — see which queries drive traffic, their average position, and how they're trending over time
- **Find quick-win opportunities** — queries ranking positions 5-20 with decent impressions, close to breaking into the top results
- **Surface CTR problems** — pages with high impressions but low click-through rates, meaning titles and meta descriptions need work
- **Spot declining keywords** — queries losing position week-over-week or month-over-month before they disappear from page 1
- **Analyze top pages** — which content drives the most organic traffic and where to focus optimization efforts
- **Compare devices** — mobile vs desktop performance gaps that signal mobile usability issues
- **Break down by country** — geo distribution of organic traffic to identify unexpected markets or underperforming regions
- **Check index coverage** — whether specific URLs are indexed, when they were last crawled, and what's blocking them
- **Monitor sitemaps** — submitted vs indexed URL counts, errors, and warnings

The agent defaults to **read-only analysis and recommendations**. It never modifies GSC settings, submits sitemaps, or removes URLs.

## Reports the agent can produce

- Site health overview with period-over-period comparison
- Top queries report sorted by clicks, impressions, CTR, or position
- Top pages report showing which content drives the most traffic
- Keyword opportunity report (positions 5-20 with high impressions)
- CTR problem report (high impressions, low click-through)
- Declining keywords report (week-over-week or month-over-month)
- Device split analysis (mobile vs desktop)
- Country/geo breakdown of organic traffic
- URL indexing status for specific pages
- Sitemap health report

## Installation

### Prerequisites

- [openclawhq.app](https://openclawhq.app) (or any compatible agent runtime)
- Node.js >= 18
- A Google Cloud project with the Search Console API enabled
- A service account with access to your GSC property

### Install the skill

```bash
codex skills:install github:RajatVaghani/gsc-monitor-skill
```

Or clone manually and point your agent to the `skill/` directory:

```bash
git clone https://github.com/RajatVaghani/gsc-monitor-skill.git
```

The skill entry point is `skill/SKILL.md`.

**Best experience:** This skill works best on [openclawhq.app](https://openclawhq.app) — the AI agent platform built by the same team. openclawhq.app handles workspace management, skill orchestration, and credential storage out of the box. [Get started at openclawhq.app](https://openclawhq.app)

## First-time setup

When the agent first uses the skill, it walks you through an onboarding flow:

1. **Create a Google Cloud project** at [console.cloud.google.com](https://console.cloud.google.com) (or use an existing one)
2. **Enable the Search Console API** — go to APIs & Services → Library → search "Google Search Console API" → Enable
3. **Create a service account** — APIs & Services → Credentials → Create Credentials → Service account
4. **Download the JSON key** — click the service account → Keys tab → Add Key → Create new key → JSON
5. **Add the service account to GSC** — copy the `client_email` from the JSON file, go to [GSC](https://search.google.com/search-console) → Settings → Users and permissions → Add user → paste the email with "Full" permission
6. **Drop the JSON key file** into `/data/.openclaw/shared-files/gsc-monitor/` (or any directory you prefer)
7. **Run setup check** — the agent verifies credentials, JWT signing, token exchange, and API access

Custom credential paths are supported via `--config <path>` flag or `GSC_CONFIG_PATH` environment variable.

## How it works

### Authentication

Google Search Console uses service account authentication with JWT-based OAuth2. The skill handles this automatically:

1. Reads the service account JSON key file (contains `client_email`, `private_key`, `project_id`)
2. Builds a JWT signed with the private key (RS256 algorithm)
3. Exchanges the JWT for a short-lived access token at Google's OAuth2 endpoint
4. Uses the access token as a Bearer token on all API calls

One JSON file — no separate values to extract, no browser login, no interactive setup.

### Analysis methodology

The skill follows a top-down analysis approach:

1. **Site health overview** — total clicks, impressions, avg CTR, avg position compared to the previous period
2. **Keyword opportunities** — queries ranking positions 5-20 with enough impressions to be worth optimizing
3. **CTR problems** — high impressions + low CTR = titles and meta descriptions that aren't compelling
4. **Declining keywords** — queries losing position that need attention before they fall off page 1
5. **Top pages** — which content drives the most traffic and deserves the most optimization attention
6. **Device & geo splits** — mobile vs desktop gaps, country-level performance differences
7. **Index coverage** — URLs not indexed, crawl errors, sitemap health

## Bundled scripts

All scripts live in `skill/scripts/` and output JSON to stdout. They read credentials from the default path or accept `--config <path>`.

| Script | What it does | Usage |
|--------|-------------|-------|
| `gsc-setup-check.mjs` | Verify credentials and test API connection | `node scripts/gsc-setup-check.mjs` |
| `gsc-list-sites.mjs` | List all accessible GSC properties | `node scripts/gsc-list-sites.mjs` |
| `gsc-search-analytics.mjs` | Search analytics with flexible dimensions and filters | `node scripts/gsc-search-analytics.mjs <siteUrl> [options]` |
| `gsc-inspect-url.mjs` | URL indexing status inspection | `node scripts/gsc-inspect-url.mjs <siteUrl> <pageUrl>` |
| `gsc-sitemaps.mjs` | Sitemap submission status | `node scripts/gsc-sitemaps.mjs <siteUrl>` |

### Search analytics options

The main script supports flexible querying:

```bash
# Top queries by clicks (last 7 days)
node scripts/gsc-search-analytics.mjs https://example.com --dimensions query --days 7

# Top pages over 28 days
node scripts/gsc-search-analytics.mjs https://example.com --dimensions page --days 28

# Queries broken down by country
node scripts/gsc-search-analytics.mjs https://example.com --dimensions query,country --days 7

# Daily trend for specific query
node scripts/gsc-search-analytics.mjs https://example.com --dimensions date --queryFilter "your keyword" --days 28

# Mobile-only performance
node scripts/gsc-search-analytics.mjs https://example.com --dimensions query --deviceFilter MOBILE --days 7
```

Dimensions: `query`, `page`, `country`, `device`, `date`, `searchAppearance` (combinable).

Filters: `--queryFilter`, `--pageFilter`, `--countryFilter`, `--deviceFilter`.

## Repository structure

```
gsc-monitor-skill/
├── README.md
└── skill/
    ├── SKILL.md                          # Main skill instructions (agent reads this)
    ├── scripts/
    │   ├── gsc-common.mjs                # Shared auth & API utilities (JWT, OAuth, requests)
    │   ├── gsc-setup-check.mjs           # Verify credentials & connection
    │   ├── gsc-list-sites.mjs            # List all accessible properties
    │   ├── gsc-search-analytics.mjs      # Search analytics query (main workhorse)
    │   ├── gsc-inspect-url.mjs           # URL indexing status inspection
    │   └── gsc-sitemaps.mjs              # Sitemap status listing
    └── references/
        └── api-reference.md              # GSC API v1 endpoint documentation
```

## Key metrics tracked

| Metric | Description | What to watch for |
|--------|-------------|-------------------|
| Clicks | Users who clicked through from search | Sudden drops = ranking loss or indexing problem |
| Impressions | Times a page appeared in search results | Drops = lost rankings or deindexed pages |
| CTR | Click-through rate (clicks / impressions) | Below 2% on high-impression queries = bad title/description |
| Position | Average ranking position (1.0 = top) | Positions 4-10 = quick-win optimization targets |

## Security

- Service account private key is never exposed in chat, logs, or generated files
- Full JSON key file contents are never included in responses
- Access tokens are never shown in code snippets
- `client_email` is safe to display (it's not a secret)
- Access tokens are short-lived (1 hour) and not persisted
- The skill operates in read-only mode — it never modifies GSC settings

Prefer environment variables or [openclawhq.app](https://openclawhq.app) config over storing the JSON key in a shared location. If you do use a file, make sure it's not committed to version control.

## Usage

Once installed and configured, just ask your agent:

- "How is my site performing in Google search this week?"
- "Which keywords are closest to breaking into the top 3?"
- "My organic traffic dropped — what changed?"
- "Which pages have high impressions but nobody clicks?"
- "Is my new blog post indexed yet?"
- "Compare mobile vs desktop search performance"
- "Give me a full SEO health report with recommendations"

The agent handles everything — pulling data, comparing time periods, identifying problems, and delivering actionable recommendations.

## Why openclawhq.app?

This skill is standalone and works with any compatible agent runtime, but it's built and optimized for [openclawhq.app](https://openclawhq.app). On the platform you get:

- **Zero-config setup** — credential management and workspace paths handled automatically
- **Managed agent runtime** — your agent runs 24/7 in the cloud, no local machine needed
- **Scheduled monitoring** — set up daily or weekly automated SEO health checks
- **Shared file access** — generated reports appear instantly in the dashboard
- **Skill marketplace** — install this and other skills with one click
- **Team collaboration** — share SEO insights and reports across your team

If you're running this skill outside of openclawhq.app and want a smoother experience, [try the platform](https://openclawhq.app).

## License

MIT

## Credits

Made by [Claw HQ](https://openclawhq.app) — the team behind [openclawhq.app](https://openclawhq.app), the AI agent platform for autonomous workflows.
