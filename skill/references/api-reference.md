# Google Search Console API Reference

Two base URLs are used — different endpoints live under different paths:

- **Sites, Search Analytics, Sitemaps**: `https://searchconsole.googleapis.com/webmasters/v3`
- **URL Inspection**: `https://searchconsole.googleapis.com/v1`

Authentication: Bearer token from Google OAuth2 service account flow.

---

## Sites

### List Sites

```
GET https://searchconsole.googleapis.com/webmasters/v3/sites
```

Returns all Search Console properties the authenticated account has access to.

**Response:**
```json
{
  "siteEntry": [
    {
      "siteUrl": "https://example.com/",
      "permissionLevel": "siteOwner"
    },
    {
      "siteUrl": "sc-domain:example.com",
      "permissionLevel": "siteFullUser"
    }
  ]
}
```

**Permission levels:** `siteOwner`, `siteFullUser`, `siteRestrictedUser`, `siteUnverifiedUser`

**Note:** The `siteUrl` format matters. URL-prefix properties use `https://example.com/` (with trailing slash). Domain properties use `sc-domain:example.com`.

---

## Search Analytics

### Query Search Analytics

```
POST https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
```

The `{siteUrl}` must be URL-encoded (e.g., `https%3A%2F%2Fexample.com%2F`).

**Request body:**
```json
{
  "startDate": "2026-03-01",
  "endDate": "2026-03-28",
  "dimensions": ["query", "page"],
  "rowLimit": 100,
  "startRow": 0,
  "type": "web",
  "dimensionFilterGroups": [
    {
      "groupType": "and",
      "filters": [
        {
          "dimension": "query",
          "operator": "contains",
          "expression": "productivity"
        }
      ]
    }
  ]
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startDate` | string | Yes | Start date (YYYY-MM-DD). Data available from ~16 months ago. |
| `endDate` | string | Yes | End date (YYYY-MM-DD). Most recent data is 2-3 days ago. |
| `dimensions` | string[] | No | Group results by: `query`, `page`, `country`, `device`, `date`, `searchAppearance`. Up to 3 dimensions. |
| `rowLimit` | integer | No | Max rows to return (default: 1000, max: 25000). |
| `startRow` | integer | No | Offset for pagination (default: 0). |
| `type` | string | No | Search type: `web` (default), `image`, `video`, `news`, `discover`, `googleNews`. |
| `dimensionFilterGroups` | object[] | No | Filter results (see below). |
| `aggregationType` | string | No | How to aggregate: `auto` (default), `byPage`, `byProperty`. |
| `dataState` | string | No | `final` (default) or `all` (includes fresh/unfinished data). |

**Dimension filter:**
```json
{
  "dimension": "query",
  "operator": "contains",
  "expression": "search term"
}
```

Operators: `equals`, `contains`, `notEquals`, `notContains`, `includingRegex`, `excludingRegex`.

**Response:**
```json
{
  "rows": [
    {
      "keys": ["best productivity apps", "https://example.com/blog/productivity"],
      "clicks": 142,
      "impressions": 3200,
      "ctr": 0.044375,
      "position": 4.2
    }
  ],
  "responseAggregationType": "byPage"
}
```

**Row fields:**

| Field | Type | Description |
|-------|------|-------------|
| `keys` | string[] | Dimension values in the order requested |
| `clicks` | number | Total clicks |
| `impressions` | number | Total impressions |
| `ctr` | number | Click-through rate (0.0 to 1.0) |
| `position` | number | Average position (1.0 = top) |

**Pagination:** Use `startRow` + `rowLimit`. If the response contains `rowLimit` rows, there may be more. Increment `startRow` by `rowLimit` and request again.

**Date format for `date` dimension:** YYYY-MM-DD in the `keys` array.

**Country codes:** ISO 3166-1 alpha-3 (e.g., `USA`, `GBR`, `DEU`, `JPN`).

**Device values:** `MOBILE`, `DESKTOP`, `TABLET`.

---

## URL Inspection

### Inspect URL

```
POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
```

**Request body:**
```json
{
  "inspectionUrl": "https://example.com/blog/my-post",
  "siteUrl": "https://example.com/"
}
```

**Response (simplified):**
```json
{
  "inspectionResult": {
    "inspectionResultLink": "https://search.google.com/search-console/...",
    "indexStatusResult": {
      "verdict": "PASS",
      "coverageState": "Submitted and indexed",
      "robotsTxtState": "ALLOWED",
      "indexingState": "INDEXING_ALLOWED",
      "lastCrawlTime": "2026-03-25T10:30:00Z",
      "pageFetchState": "SUCCESSFUL",
      "googleCanonical": "https://example.com/blog/my-post",
      "userCanonical": "https://example.com/blog/my-post",
      "referringUrls": ["https://example.com/blog/"],
      "sitemap": ["https://example.com/sitemap.xml"]
    },
    "mobileUsabilityResult": {
      "verdict": "PASS",
      "issues": []
    },
    "richResultsResult": {
      "verdict": "PASS",
      "detectedItems": [
        {
          "richResultType": "Article",
          "items": [{ "name": "Article", "issues": [] }]
        }
      ]
    }
  }
}
```

**Index status verdicts:** `PASS`, `NEUTRAL`, `FAIL`, `VERDICT_UNSPECIFIED`.

**Coverage states:**
- `Submitted and indexed` — healthy
- `Crawled - currently not indexed` — Google saw it but chose not to index
- `Discovered - currently not indexed` — Google knows about it but hasn't crawled yet
- `Page with redirect` — URL redirects somewhere
- `URL is unknown to Google` — never seen
- `Blocked by robots.txt`
- `Blocked due to other 4xx issue`
- `Server error (5xx)`
- `Soft 404`
- `Duplicate without user-selected canonical`
- `Duplicate, Google chose different canonical than user`

**Rate limit:** URL Inspection has a quota of 600 inspections per property per day, 2000 per day per project.

---

## Sitemaps

### List Sitemaps

```
GET https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps
```

**Response:**
```json
{
  "sitemap": [
    {
      "path": "https://example.com/sitemap.xml",
      "lastSubmitted": "2026-03-01T00:00:00.000Z",
      "lastDownloaded": "2026-03-28T12:00:00.000Z",
      "isPending": false,
      "warnings": "0",
      "errors": "0",
      "type": "sitemap",
      "contents": [
        {
          "type": "web",
          "submitted": "150",
          "indexed": "142"
        }
      ]
    }
  ]
}
```

**Sitemap types:** `sitemap`, `sitemapIndex`, `atomFeed`, `rssFeed`, `notSitemap`.

**Content types:** `web`, `image`, `video`, `news`, `mobile`.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": 403,
    "message": "User does not have sufficient permissions for site 'https://example.com/'.",
    "status": "PERMISSION_DENIED"
  }
}
```

Common error codes:
- `400` — Bad request (invalid parameters)
- `401` — Unauthorized (bad token or API not enabled)
- `403` — Forbidden (service account not added to GSC property)
- `404` — Not found (wrong site URL format)
- `429` — Rate limited

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Search Analytics | 1200 queries per minute |
| URL Inspection | 600 per property per day, 2000 per project per day |
| Sites / Sitemaps | 1200 queries per minute |

For most analysis tasks you won't hit these limits. Be mindful of URL Inspection's daily quota — batch inspections carefully.
