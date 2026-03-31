#!/usr/bin/env node
/**
 * Inspect a URL's indexing status in Google Search Console.
 *
 * Usage:
 *   node gsc-inspect-url.mjs <siteUrl> <pageUrl> [--config <path>]
 *
 * Example:
 *   node gsc-inspect-url.mjs https://example.com https://example.com/blog/my-post
 *
 * Returns indexing state, crawl info, mobile usability, and rich results.
 *
 * NOTE: URL Inspection API requires the scope
 *   https://www.googleapis.com/auth/webmasters.readonly
 * which is the same scope used by the rest of this skill.
 */

import {
  loadCredentials, getAccessToken, apiRequest, GSC_V1_BASE,
  getPositional, outputJson, exitError,
} from './gsc-common.mjs';

async function main() {
  const siteUrl = getPositional(0);
  const pageUrl = getPositional(1);

  if (!siteUrl || !pageUrl) {
    exitError(
      'Missing required arguments.\n' +
      'Usage: node gsc-inspect-url.mjs <siteUrl> <pageUrl>\n' +
      'Example: node gsc-inspect-url.mjs https://example.com https://example.com/blog/my-post'
    );
  }

  const creds = loadCredentials();
  const token = await getAccessToken(creds);

  const result = await apiRequest(token, 'POST', '/urlInspection/index:inspect', {
    inspectionUrl: pageUrl,
    siteUrl,
  }, GSC_V1_BASE);

  const ir = result.inspectionResult || {};
  const indexStatus = ir.indexStatusResult || {};
  const mobileUsability = ir.mobileUsabilityResult || {};
  const richResults = ir.richResultsResult || {};

  const summary = {
    inspectedUrl: pageUrl,
    siteUrl,
    indexing: {
      verdict: indexStatus.verdict || 'UNKNOWN',
      coverageState: indexStatus.coverageState || null,
      robotsTxtState: indexStatus.robotsTxtState || null,
      indexingState: indexStatus.indexingState || null,
      lastCrawlTime: indexStatus.lastCrawlTime || null,
      pageFetchState: indexStatus.pageFetchState || null,
      referringUrls: indexStatus.referringUrls || [],
      sitemap: indexStatus.sitemap || [],
    },
    mobileUsability: {
      verdict: mobileUsability.verdict || 'UNKNOWN',
      issues: (mobileUsability.issues || []).map(i => ({
        issueType: i.issueType,
        severity: i.severity,
        message: i.message,
      })),
    },
    richResults: {
      verdict: richResults.verdict || 'UNKNOWN',
      detectedItems: (richResults.detectedItems || []).map(item => ({
        richResultType: item.richResultType,
        items: (item.items || []).map(i => ({
          name: i.name,
          issues: (i.issues || []).map(iss => ({
            issueMessage: iss.issueMessage,
            severity: iss.severity,
          })),
        })),
      })),
    },
  };

  outputJson({ ok: true, data: summary });
}

main().catch(err => exitError(err.message));
