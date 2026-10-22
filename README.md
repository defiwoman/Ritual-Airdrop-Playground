# Ritual Airdrop Playground

An unofficial, just-for-fun Ritual community simulator. The original green/white frontend and supplied Ritual logo are retained. This application does not establish eligibility, claim tokens, connect wallets, verify Discord roles, or fetch live token prices.

## Run and verify

Use Node **24.19.0** (`nvm use`) and npm. From a fresh checkout:

```sh
npm ci
npm test
npm run build
npm run dev
```

Open `http://localhost:4173`. Netlify Dev serves the static frontend and Functions, with local Blobs emulation, in offline mode. Local `.netlify` data is ignored by Git. `npm run dev -- --port 8888` selects another port. No production storage credentials are needed locally.

`npm run build` runs the tests and verifies syntax, static assets, Function exports and the public directory. Netlify also bundles the Functions during deployment. The publish directory is `dist`; server code is in `netlify/functions` and `netlify/lib`.

## Model and versions

`dist/models/exponential-v1.mjs` is shared by browser and server, with `dist/model.mjs` as its compatibility export. The formula is:

```text
effectiveWeight = exp(rawWeight - 1)
budget = pool * modelledShare / 100
denominator = sum(count * effectiveWeight across all 11 categories)
x = budget / denominator
perHolder = x * effectiveWeight for nonzero-count categories
individualTokens = one main-role reward + selected additional-role rewards
USD = individualTokens * assumedPrice
```

Defaults are 50,000,000 tokens, 100% modelled share and USD 0.05 per token. Counts and weights reproduce the supplied community reference; they are unverified assumptions. The rows sum to 3,953 memberships, although the image footer says 3,453. Overlapping memberships are not distinct users. Genesis variants stack independently in this model. A 100% share is not a claim about official contributor allocations.

Default `x` is approximately 5692.707808636479 tokens. Ritualist + Node Runner + dApp Builder produces approximately 69,343.88 tokens, worth USD 3,467.19 at the assumed USD 0.05 price. Full precision is retained internally.

`dist/config.mjs` exposes the app/model/config versions and public notices. Update defaults in Git, keeping old calculation semantics available under the old model version. Any formula change requires a new versioned model and a registry entry in `netlify/lib/calculation.mjs`. Saved snapshots contain all inputs and never fill missing values from current defaults.

## API

All endpoints are same-origin JSON. Calculation and creation accept the compact version-1 scenario directly:

```json
{"v":1,"p":50000000,"s":100,"t":0.05,"m":"ritualist","e":["node","builder"],"r":[[513,1],[517,1.8],[185,2.7],[22,3.6],[9,4.5],[500,2.5],[100,1.8],[207,1.8],[400,1.4],[1000,1.4],[500,1]]}
```

The fixed `r` order is Bitty, Ritty, Ritualist, Zealot, Radiant Ritualist, Node Runner, Prime Genesis, dApp Builder, Early Genesis, Frenrug, Genesis. `p` means total pool, `s` means percentage assigned to these roles, and `t` means assumed USD price.

| Endpoint | Method | Response |
| --- | --- | --- |
| `/api/config` | GET | Versions, role metadata, defaults and warnings |
| `/api/calculate` | POST | Validated scenario, model version, token/USD totals, x, denominator, budget, rows, selected breakdown and warnings; no storage |
| `/api/scenarios` | POST | HTTP 201: random ID, relative sharePath, creation time, model version, scenario and recalculated result |
| `/api/scenarios/:id` | GET | The same saved snapshot and its reproduced result |
| `/api/health` | GET | App/model version, calculation availability, storage context status; does not probe storage or write records |

Example, after saving the JSON above as `scenario.json`:

```sh
curl -H 'Content-Type: application/json' --data-binary @scenario.json http://localhost:4173/api/calculate
```

The calculation response includes `"tokens":69343.88364961414` and `"usd":3467.1941824807072`. A share response includes `"sharePath":"/?s=<32-hex-character-id>"`; it does not construct an absolute URL from request headers.

Errors use `{"error":{"code":"INVALID_SCENARIO","message":"Check the scenario assumptions.","fields":[{"field":"t","message":"Enter a finite number between 0 and 100000."}]}}`. Status codes include 400 invalid JSON/ID, 403 cross-origin rejection, 404 missing route/snapshot, 405 unsupported method, 413 body over 16 KiB, 415 unsupported media, 422 invalid scenario/model, 429 throttling and 503 temporary service/storage failure. Function responses set JSON, no-store, nosniff and restrictive CSP headers. Unknown API paths never return the app HTML as a successful response.

Inputs require finite numeric values, integer counts, known fields, one main role and distinct extras. Counts are 0–10,000,000, weights 0–10, pool 1–1e12, share 0–100 and price 0–100,000. Zero share/price are valid; a selected zero-count role or all-zero denominator is invalid. Actual streamed body bytes are limited, even when Content-Length is absent or false.

## Storage and privacy

Local scenario saves remain in browser storage, with a limit of three cards. Only **Create share link** writes to the server. Anyone possessing a share link can view its roles and assumptions. No names, addresses, Discord accounts, wallets, IP addresses or arbitrary text are stored in snapshot documents. The hosting platform may retain its normal operational logs.

Server IDs use 16 cryptographically random bytes (128 bits). Conditional `onlyIfNew` writes prevent overwriting. Records are immutable, have no public listing/edit/delete API, and are retained until the site owner removes them administratively. Stored fields are schema version, model version, UTC creation time and the complete compact scenario. Strong reads are used.

Production uses the site-wide `ritual-scenarios-production-v1` store, so data survives deploys. Preview/branch deployments use separate stores derived from the trusted platform deploy ID. Local development uses `ritual-scenarios-local-v1`. Missing or unknown platform context fails closed. Never choose a store from client input.

Encoded `?scenario=` links and existing local-storage data remain supported. Short `?s=` links restore the original snapshot. Network failures leave the local calculator and encoded links available. The frontend debounces checks by 350 ms, ignores obsolete responses, and distinguishes “Calculated locally” from “Server checked.” Neither status verifies airdrop eligibility.

## Throttling

Function configuration defines platform rate limits per IP and domain: scenario creation 20 requests per 60 seconds; calculation, snapshot reads, configuration and health 120 per 60 seconds. Exceeded limits rewrite to `/api/rate-limited`, which returns JSON HTTP 429 with Retry-After 60. Netlify documents an enforcement delay of up to 10 seconds; these are not absolute global spending caps. No in-memory counter is presented as a durable limiter. Local emulation does not verify edge enforcement; check the deployed rules in Netlify before launch.

## Deploy through GitHub

Repository: `https://github.com/defiwoman/Ritual-Airdrop-Playground`.

1. Sign into the intended Netlify team. Reuse its existing project connected to this repository if one exists; otherwise import this exact GitHub repository.
2. Use the intended production branch (normally `main`). Set base directory to the repository root. The checked-in `netlify.toml` sets build command `npm run build`, publish directory `dist`, and Functions directory `netlify/functions`.
3. Netlify builds with Node 24.19.0; its compatible Node 24 Functions runtime follows the build version. No application secrets are required. Netlify automatically supplies its Blobs runtime context. `.env.example` documents optional local CLI project linking only; authenticate with `netlify login`, never a committed token.
4. Enable Deploy Previews, deploy the implementation branch/PR, and verify the complete app and Functions there before merging. Preview data is deliberately separate from production data.
5. Merge through the repository's permitted workflow after required checks pass. Verify the production URL and real storage round trip. A static drag-and-drop upload is insufficient for this application.

Read-only deployment smoke checks:

```sh
npm run verify:deployment -- https://YOUR-PROJECT.netlify.app --read-only
```

To explicitly create one non-sensitive test snapshot and verify a storage round trip:

```sh
npm run verify:deployment -- https://YOUR-PROJECT.netlify.app --create-scenario
```

Keep that returned share link and reopen it after the next production deployment to verify cross-deploy persistence. Do not claim production verification based on unit tests or local emulation.

## Rollback

Use Netlify's deploy history to publish the last known-good production deploy, then revert the problematic Git commit through a new commit/PR. Do not force-push or delete snapshot stores. Retain the old versioned model code for existing links. Keep the production store name stable across ordinary deploys.

## Technical references

- https://docs.netlify.com/build/functions/api/
- https://docs.netlify.com/build/functions/configuration/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
- https://docs.netlify.com/deploy/create-deploys/
