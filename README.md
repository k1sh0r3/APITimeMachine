# API Time Machine ⏱

A public archive that snapshots popular free APIs every day and records exactly what changed in their response schemas — and when.

**Live site:** *(GitHub Pages URL goes here after the parent pushes)*

## Why

APIs change silently. A field gets renamed, a type flips from number to string, a nested object disappears — and your integration breaks at 2am. This project keeps a version-controlled, field-level changelog of what public APIs actually return, so drift is visible instead of surprising.

## Architecture

```
.github/workflows/snapshot.yml   daily 06:00 UTC cron
        │
        ▼
scripts/snapshot.js ──► fetches each endpoint (sequential, 1s delay, 15s timeout)
        │
        ▼
scripts/schema.js ──► extractSchema() → canonicalize() → hash → diffSchemas()
        │
        ▼
data/
  snapshots/<api>.json    latest full schema tree per API
  changelog/<api>.json    reverse-chronological {date, endpoint, changes[]}
  index.json              dashboard feed: status, lastChange, changeCount
        │
        ▼
index.html / api.html / about.html   static site, reads data/*.json directly
```

Zero npm dependencies. Zero API keys. The site is pure static HTML/CSS/JS — GitHub Pages serves the repo root.

## Tracked APIs (all keyless)

| API | Endpoint snapshotted |
|---|---|
| GitHub REST API | `GET /repos/octocat/Hello-World` |
| Open-Meteo | Forecast for Berlin, DE |
| REST Countries | `GET /v3.1/alpha/usa` |
| JSONPlaceholder | `GET /posts/1` |
| Kraken | `GET /0/public/Ticker?pair=XBTUSD` |
| Dog CEO | `GET /api/breeds/list/all` |
| Open Library | `GET /works/OL45883W.json` |
| Agify | `GET /?name=michael` |

## Local dev

```bash
node scripts/snapshot.js   # refresh data/ (Node 18+)
python3 -m http.server     # preview the site at localhost:8000
```

## Add your own API

1. Add an entry to `config/apis.json` (see `about.html` for the exact shape).
2. Run `node scripts/snapshot.js` to seed the snapshot.
3. Commit — the scheduled workflow picks it up from there.

Rules: no API key required, endpoint must be stable (same input daily), JSON responses under ~1MB.
