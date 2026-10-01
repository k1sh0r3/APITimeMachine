// API Time Machine — daily snapshot runner.
// Fetches every configured endpoint, extracts its response schema, diffs
// against the previous snapshot, and records changes. Zero dependencies,
// Node 18+ (global fetch).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractSchema, canonicalize, diffSchemas } = require('./schema.js');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'config', 'apis.json');
const SNAP_DIR = path.join(ROOT, 'data', 'snapshots');
const LOG_DIR = path.join(ROOT, 'data', 'changelog');
const INDEX = path.join(ROOT, 'data', 'index.json');

const REQUEST_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_REQUESTS_MS = 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
function hash(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

async function fetchJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'api-time-machine/1.0 (daily schema snapshot; github.com)',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const config = readJSON(CONFIG, null);
  if (!config || !Array.isArray(config.apis)) {
    console.error('config/apis.json missing or invalid');
    process.exit(1);
  }

  const index = { generatedAt: new Date().toISOString(), apis: [] };

  for (const api of config.apis) {
    console.log(`\n== ${api.id} (${api.name})`);
    const prevSnap = readJSON(path.join(SNAP_DIR, `${api.id}.json`), null);
    const prevLog = readJSON(path.join(LOG_DIR, `${api.id}.json`), { id: api.id, entries: [] });

    const endpoints = {};
    let status = 'ok';
    let error = null;

    for (const ep of api.endpoints) {
      const url = api.baseUrl.replace(/\/$/, '') + ep.path;
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
      try {
        const body = await fetchJSON(url);
        const schema = extractSchema(body);
        const h = hash(canonicalize(schema));
        endpoints[ep.path] = {
          label: ep.label, url, status: 'ok', httpStatus: 200,
          fetchedAt: new Date().toISOString(), hash: h, schema
        };
        console.log(`  ok  ${ep.path} (hash ${h})`);

        // Diff against previous snapshot for this endpoint.
        const prevEp = prevSnap && prevSnap.endpoints && prevSnap.endpoints[ep.path];
        if (prevEp && prevEp.hash !== h) {
          const changes = diffSchemas(prevEp.schema, schema);
          if (changes.length) {
            prevLog.entries.unshift({ date: today(), endpoint: ep.path, changes });
            console.log(`  !! ${changes.length} schema change(s) on ${ep.path}`);
          }
        }
      } catch (e) {
        endpoints[ep.path] = { label: ep.label, url, status: 'error', error: String(e.message || e) };
        status = 'error';
        error = `${ep.path}: ${e.message || e}`;
        console.log(`  ERR ${ep.path}: ${e.message || e}`);
      }
    }

    if (status === 'ok') {
      writeJSON(path.join(SNAP_DIR, `${api.id}.json`), {
        id: api.id, name: api.name, fetchedAt: new Date().toISOString(), endpoints
      });
      writeJSON(path.join(LOG_DIR, `${api.id}.json`), prevLog);
    } else {
      console.log('  keeping previous snapshot untouched (fetch failed)');
    }

    const entries = prevLog.entries;
    index.apis.push({
      id: api.id,
      name: api.name,
      description: api.description,
      lastChecked: new Date().toISOString(),
      lastChange: entries.length ? entries[0].date : null,
      changeCount: entries.reduce((n, e) => n + e.changes.length, 0),
      status,
      ...(error ? { error } : {})
    });
  }

  writeJSON(INDEX, index);
  console.log('\nwrote data/index.json');
}

main().catch(e => { console.error('fatal:', e); process.exit(1); });
