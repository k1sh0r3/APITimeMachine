# CtrlZ_API ⏱

**Live site:** https://k1sh0r3.github.io/CtrlZ_API/


*Ctrl+Z for the API economy — every schema change, archived.*

A public archive that snapshots popular free APIs every day and records exactly what changed in their response schemas — and when.

## Why

APIs change silently. A field gets renamed, a type flips from number to string, a nested object disappears — and your integration breaks at 2am. This project keeps a version-controlled, field-level changelog of what public APIs actually return, so drift is visible instead of surprising.

## Architecture

```
.github/workflows/snapshot.yml   daily 06:00 UTC cron
        │
        ▼
scripts/snapshot.js ──► fetches each endpoint (sequential, 1s delay, 15s timeout,
                         per-API headers from config/apis.json)
        │
        ▼
scripts/schema.js ──► extractSchema() → canonicalize() → hash → diffSchemas()
        │
        ▼
data/
  snapshots/<api>.json    latest full schema tree per API
  changelog/<api>.json    reverse-chronological {date, endpoint, changes[]}
  index.json              dashboard feed: category, status, lastChange, changeCount, totalApis
        │
        ▼
index.html / api.html / about.html   static site, reads data/*.json directly
```

Zero npm dependencies. Zero API keys. The site is pure static HTML/CSS/JS — GitHub Pages serves the repo root.

## Tracked APIs (33, all keyless and production-grade)

| Category | APIs |
|---|---|
| Weather | Open-Meteo, Open-Meteo Air Quality, Open-Meteo Geocoding, USGS Earthquakes, Sunrise-Sunset |
| Finance | Kraken, Coinbase, Fear & Greed Index, Frankfurter FX, ExchangeRate-API |
| Geo | REST Countries, Zippopotam, Nager Public Holidays, IP-API |
| Books | Open Library, Gutendex |
| Art | Met Museum, Art Institute of Chicago |
| Dev | GitHub REST API, npm Registry, PyPI, Hacker News, HN Algolia API, Stack Exchange |
| Space | Open Notify (ISS), Open Notify (Astronauts) |
| Reference | Hipolabs Universities |
| Media | TVMaze, Jikan (MyAnimeList) |
| Food | TheMealDB, TheCocktailDB |
| Sports | Jolpica F1 |
| Jobs | Remotive |

## Local dev

```bash
node scripts/snapshot.js   # refresh data/ (Node 18+)
python3 -m http.server     # preview the site at localhost:8000
```

## Add your own API

1. Add an entry to `config/apis.json`:
   ```json
   {
     "id": "my-api",
     "name": "My API",
     "category": "Reference",
     "description": "What this API does.",
     "baseUrl": "https://api.example.com",
     "headers": { "Accept": "application/json" },
     "endpoints": [{ "path": "/v1/things", "label": "List things" }]
   }
   ```
   `category` groups the API on the dashboard; `headers` is optional, only needed when an endpoint requires a special request header.
2. Run `node scripts/snapshot.js` to seed the snapshot.
3. Commit — the scheduled workflow picks it up from there.

Rules: no API key required, endpoint must be stable (same input daily), JSON responses under ~1MB. Only production-grade, genuinely useful APIs — no mock data, jokes, or fandom APIs.
