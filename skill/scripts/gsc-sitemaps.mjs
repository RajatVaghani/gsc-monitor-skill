#!/usr/bin/env node
/**
 * List sitemaps and their status for a Google Search Console property.
 *
 * Usage:
 *   node gsc-sitemaps.mjs <siteUrl> [--config <path>]
 *
 * Example:
 *   node gsc-sitemaps.mjs https://example.com
 */

import {
  loadCredentials, getAccessToken, apiRequest,
  getPositional, outputJson, exitError,
} from './gsc-common.mjs';

async function main() {
  const siteUrl = getPositional(0);
  if (!siteUrl) {
    exitError(
      'Missing required argument: siteUrl\n' +
      'Usage: node gsc-sitemaps.mjs <siteUrl>\n' +
      'Example: node gsc-sitemaps.mjs https://example.com'
    );
  }

  const creds = loadCredentials();
  const token = await getAccessToken(creds);

  const encodedSite = encodeURIComponent(siteUrl);
  const result = await apiRequest(token, 'GET', `/sites/${encodedSite}/sitemaps`, null);

  const sitemaps = (result.sitemap || []).map(sm => ({
    path: sm.path,
    type: sm.type || 'unknown',
    lastSubmitted: sm.lastSubmitted || null,
    lastDownloaded: sm.lastDownloaded || null,
    isPending: sm.isPending || false,
    warnings: parseInt(sm.warnings || '0', 10),
    errors: parseInt(sm.errors || '0', 10),
    contents: (sm.contents || []).map(c => ({
      type: c.type,
      submitted: parseInt(c.submitted || '0', 10),
      indexed: parseInt(c.indexed || '0', 10),
    })),
  }));

  outputJson({
    ok: true,
    data: {
      siteUrl,
      count: sitemaps.length,
      sitemaps,
    },
  });
}

main().catch(err => exitError(err.message));
