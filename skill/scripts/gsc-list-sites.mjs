#!/usr/bin/env node
/**
 * List all Google Search Console sites accessible to the service account.
 * Usage: node gsc-list-sites.mjs [--config <path>]
 */

import {
  loadCredentials, getAccessToken, apiRequest, outputJson, exitError,
} from './gsc-common.mjs';

async function main() {
  const creds = loadCredentials();
  const token = await getAccessToken(creds);
  const result = await apiRequest(token, 'GET', '/sites', null);

  const sites = (result.siteEntry || []).map(s => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));

  outputJson({ ok: true, data: { count: sites.length, sites } });
}

main().catch(err => exitError(err.message));
