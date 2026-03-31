#!/usr/bin/env node
/**
 * Query Google Search Console search analytics data.
 *
 * Usage:
 *   node gsc-search-analytics.mjs <siteUrl> [options]
 *
 * Options:
 *   --dimensions query,page,country,device,date,searchAppearance  (comma-separated)
 *   --days N                 Number of days to look back (default: 7)
 *   --startDate YYYY-MM-DD   Explicit start date (overrides --days)
 *   --endDate YYYY-MM-DD     Explicit end date (overrides --days)
 *   --limit N                Max rows (default: 100, max: 25000)
 *   --offset N               Start row for pagination (default: 0)
 *   --queryFilter "text"     Filter to queries containing this text
 *   --pageFilter "url"       Filter to pages containing this URL
 *   --countryFilter "USA"    Filter to a specific country (ISO 3166-1 alpha-3)
 *   --deviceFilter "MOBILE"  Filter to device: MOBILE, DESKTOP, or TABLET
 *   --type web|image|video|news|discover|googleNews  (default: web)
 *   --config <path>          Path to service account JSON key
 */

import {
  loadCredentials, getAccessToken, apiRequest,
  getArg, getPositional, getDateRange, outputJson, exitError,
} from './gsc-common.mjs';

const VALID_DIMENSIONS = new Set(['query', 'page', 'country', 'device', 'date', 'searchAppearance']);
const VALID_TYPES = new Set(['web', 'image', 'video', 'news', 'discover', 'googleNews']);
const MAX_ROWS = 25000;

function buildFilters() {
  const filters = [];

  const queryFilter = getArg('queryFilter');
  if (queryFilter) {
    filters.push({ dimension: 'query', operator: 'contains', expression: queryFilter });
  }

  const pageFilter = getArg('pageFilter');
  if (pageFilter) {
    filters.push({ dimension: 'page', operator: 'contains', expression: pageFilter });
  }

  const countryFilter = getArg('countryFilter');
  if (countryFilter) {
    filters.push({ dimension: 'country', operator: 'equals', expression: countryFilter.toUpperCase() });
  }

  const deviceFilter = getArg('deviceFilter');
  if (deviceFilter) {
    filters.push({ dimension: 'device', operator: 'equals', expression: deviceFilter.toUpperCase() });
  }

  return filters;
}

async function main() {
  const siteUrl = getPositional(0);
  if (!siteUrl) {
    exitError(
      'Missing required argument: siteUrl\n' +
      'Usage: node gsc-search-analytics.mjs <siteUrl> [options]\n' +
      'Example: node gsc-search-analytics.mjs https://example.com --dimensions query --days 7'
    );
  }

  const dimensionsRaw = getArg('dimensions') || 'query';
  const dimensions = dimensionsRaw.split(',').map(d => d.trim());
  for (const d of dimensions) {
    if (!VALID_DIMENSIONS.has(d)) {
      exitError(`Invalid dimension: "${d}". Valid: ${[...VALID_DIMENSIONS].join(', ')}`);
    }
  }

  const days = parseInt(getArg('days') || '7', 10);
  const explicitStart = getArg('startDate');
  const explicitEnd = getArg('endDate');

  let startDate, endDate;
  if (explicitStart && explicitEnd) {
    startDate = explicitStart;
    endDate = explicitEnd;
  } else {
    const range = getDateRange(days);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  const limit = Math.min(parseInt(getArg('limit') || '100', 10), MAX_ROWS);
  const offset = parseInt(getArg('offset') || '0', 10);

  const type = getArg('type') || 'web';
  if (!VALID_TYPES.has(type)) {
    exitError(`Invalid type: "${type}". Valid: ${[...VALID_TYPES].join(', ')}`);
  }

  const filters = buildFilters();

  const requestBody = {
    startDate,
    endDate,
    dimensions,
    rowLimit: limit,
    startRow: offset,
    type,
  };

  if (filters.length > 0) {
    requestBody.dimensionFilterGroups = [{
      groupType: 'and',
      filters,
    }];
  }

  const creds = loadCredentials();
  const token = await getAccessToken(creds);

  const encodedSite = encodeURIComponent(siteUrl);
  const result = await apiRequest(
    token, 'POST',
    `/sites/${encodedSite}/searchAnalytics/query`,
    requestBody,
  );

  const rows = (result.rows || []).map(row => {
    const entry = {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100, // convert to percentage
      position: Math.round(row.position * 10) / 10,
    };
    if (row.keys) {
      dimensions.forEach((dim, i) => {
        entry[dim] = row.keys[i];
      });
    }
    return entry;
  });

  outputJson({
    ok: true,
    data: {
      siteUrl,
      startDate,
      endDate,
      dimensions,
      type,
      rowCount: rows.length,
      rows,
    },
  });
}

main().catch(err => exitError(err.message));
