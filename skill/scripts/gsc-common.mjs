/**
 * Shared utilities for Google Search Console helper scripts.
 * Handles service account credential loading, RS256 JWT signing,
 * access token acquisition, and authenticated API requests.
 *
 * Zero external dependencies — uses only Node built-ins.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';

const DEFAULT_CONFIG_DIR = '/data/.openclaw/shared-files/gsc-monitor';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GSC_API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';
export const GSC_V1_BASE = 'https://searchconsole.googleapis.com/v1';

// ── Credential Loading ───────────────────────────────────────────────

/**
 * Find and parse the service account JSON key file.
 *
 * Resolution order:
 *   1. Explicit path passed as argument
 *   2. --config <path> CLI flag
 *   3. GSC_CONFIG_PATH environment variable
 *   4. ~/.openclaw/openclaw.json → env.GSC_CONFIG_PATH
 *   5. Default directory: /data/.openclaw/shared-files/gsc-monitor/
 */
export function loadCredentials(customPath) {
  const configPath = customPath
    || process.argv.find((a, i) => process.argv[i - 1] === '--config')
    || process.env.GSC_CONFIG_PATH
    || resolveFromOpenclawConfig()
    || null;

  let filePath = null;

  if (configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config path not found: ${configPath}`);
    }
    const stat = fs.statSync(configPath);
    if (stat.isDirectory()) {
      filePath = findJsonKeyInDir(configPath);
    } else {
      filePath = configPath;
    }
  } else {
    if (!fs.existsSync(DEFAULT_CONFIG_DIR)) {
      throw new Error(
        `Credentials directory not found: ${DEFAULT_CONFIG_DIR}\n` +
        `Please run the setup process first. Drop your Google service account\n` +
        `JSON key file into: ${DEFAULT_CONFIG_DIR}/\n` +
        `See the skill SKILL.md for setup instructions.`
      );
    }
    filePath = findJsonKeyInDir(DEFAULT_CONFIG_DIR);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse JSON key file: ${filePath}`);
  }

  const required = ['client_email', 'private_key', 'project_id'];
  const missing = required.filter(k => !creds[k]);
  if (missing.length > 0) {
    throw new Error(
      `Service account JSON key is missing required fields: ${missing.join(', ')}\n` +
      `File: ${filePath}\n` +
      `Make sure you downloaded the full JSON key from Google Cloud Console.`
    );
  }

  creds._filePath = filePath;
  return creds;
}

function findJsonKeyInDir(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(
      `No JSON key files found in ${dir}\n` +
      `Drop your Google service account JSON key file here.`
    );
  }
  // Prefer files with "service" or "key" or "credential" in the name
  const preferred = files.find(f => /service|key|credential|gsc/i.test(f)) || files[0];
  return path.join(dir, preferred);
}

function resolveFromOpenclawConfig() {
  const candidates = [
    path.join(process.env.HOME || '', '.openclaw', 'openclaw.json'),
    '/data/.openclaw/openclaw.json',
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (config.env?.GSC_CONFIG_PATH) return config.env.GSC_CONFIG_PATH;
    } catch { /* skip */ }
  }
  return null;
}

// ── JWT Signing (RS256) ──────────────────────────────────────────────

function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

/**
 * Build and sign a JWT for Google's OAuth2 token endpoint.
 * Uses RS256 (RSA + SHA-256) — the standard for GCP service accounts.
 */
export function buildJWT(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: GSC_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(credentials.private_key);

  return `${signingInput}.${base64url(signature)}`;
}

// ── Access Token Exchange ────────────────────────────────────────────

let _cachedToken = null;
let _cachedTokenExpiry = 0;

/**
 * Exchange a signed JWT for a Google OAuth2 access token.
 * Caches the token until it expires.
 */
export async function getAccessToken(credentials) {
  if (_cachedToken && Date.now() < _cachedTokenExpiry) {
    return _cachedToken;
  }

  const jwt = buildJWT(credentials);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }).toString();

  const data = await httpsPost(TOKEN_URL, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  const parsed = JSON.parse(data);
  if (!parsed.access_token) {
    throw new Error(`Token exchange failed: ${data}`);
  }

  _cachedToken = parsed.access_token;
  _cachedTokenExpiry = Date.now() + ((parsed.expires_in || 3600) - 60) * 1000;

  return _cachedToken;
}

// ── API Requests ─────────────────────────────────────────────────────

/**
 * Make an authenticated request to the Google Search Console API.
 * Uses webmasters/v3 base by default. Pass a custom base for v1 endpoints.
 */
export async function apiRequest(token, method, endpoint, body, base) {
  const url = `${base || GSC_API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const data = method === 'GET'
    ? await httpsGet(url, headers)
    : await httpsPost(url, body ? JSON.stringify(body) : '', headers);

  try {
    return JSON.parse(data);
  } catch {
    throw new Error(`Failed to parse API response: ${data.substring(0, 500)}`);
  }
}

// ── Date Helpers ─────────────────────────────────────────────────────

export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export function getDateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // GSC data has ~2 day lag; end at yesterday
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

// ── CLI Helpers ──────────────────────────────────────────────────────

export function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

export function getFlag(name) {
  return process.argv.includes(`--${name}`);
}

export function getPositional(index) {
  const cleaned = [];
  const rawArgs = process.argv.slice(2);
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i].startsWith('--')) {
      i++; // skip the flag's value
      continue;
    }
    cleaned.push(rawArgs[i]);
  }
  return cleaned[index] || null;
}

export function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function exitError(message) {
  console.error(JSON.stringify({ ok: false, error: { message } }, null, 2));
  process.exit(1);
}

// ── HTTP Helpers (zero-dependency) ───────────────────────────────────

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
