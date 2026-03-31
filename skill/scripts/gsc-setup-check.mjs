#!/usr/bin/env node
/**
 * Verify Google Search Console credentials and API access.
 * Usage: node gsc-setup-check.mjs [--config <path>]
 *
 * Checks:
 *   1. JSON key file exists and has required fields
 *   2. JWT can be signed with the private key
 *   3. Access token can be obtained from Google OAuth
 *   4. sites.list API call succeeds
 */

import {
  loadCredentials, buildJWT, getAccessToken, apiRequest, outputJson, exitError,
} from './gsc-common.mjs';

async function main() {
  const checks = [];

  // 1. Load credentials
  let creds;
  try {
    creds = loadCredentials();
    checks.push({ step: 'credentials', ok: true, detail: `Loaded from ${creds._filePath}` });
    checks.push({ step: 'client_email', ok: true, detail: creds.client_email });
    checks.push({ step: 'project_id', ok: true, detail: creds.project_id });
    checks.push({ step: 'private_key', ok: true, detail: `${creds.private_key.length} chars, starts with ${creds.private_key.substring(0, 30)}...` });
  } catch (err) {
    checks.push({ step: 'credentials', ok: false, detail: err.message });
    outputJson({ ok: false, checks });
    process.exit(1);
  }

  // 2. Build JWT
  try {
    const jwt = buildJWT(creds);
    checks.push({ step: 'jwt_signing', ok: true, detail: `JWT built (${jwt.length} chars)` });
  } catch (err) {
    checks.push({ step: 'jwt_signing', ok: false, detail: err.message });
    outputJson({ ok: false, checks });
    process.exit(1);
  }

  // 3. Get access token
  let token;
  try {
    token = await getAccessToken(creds);
    checks.push({ step: 'access_token', ok: true, detail: `Token obtained (${token.substring(0, 16)}...)` });
  } catch (err) {
    checks.push({ step: 'access_token', ok: false, detail: err.message });
    outputJson({ ok: false, checks });
    process.exit(1);
  }

  // 4. Call sites.list
  try {
    const result = await apiRequest(token, 'GET', '/sites', null);
    const siteCount = result.siteEntry?.length || 0;
    checks.push({
      step: 'api_access',
      ok: true,
      detail: `API responding — ${siteCount} site(s) accessible`,
      sites: (result.siteEntry || []).map(s => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      })),
    });
  } catch (err) {
    const msg = err.message || '';
    let hint = '';
    if (msg.includes('403')) {
      hint = 'The service account does not have access to any GSC properties. ' +
        'Go to GSC > Settings > Users and permissions > Add user, ' +
        'and add the service account email with "Full" or "Restricted" access.';
    } else if (msg.includes('401')) {
      hint = 'Authentication failed. Check that the Search Console API is enabled ' +
        'in your Google Cloud project.';
    }
    checks.push({ step: 'api_access', ok: false, detail: err.message, hint });
    outputJson({ ok: false, checks });
    process.exit(1);
  }

  outputJson({ ok: true, checks });
}

main().catch(err => exitError(err.message));
