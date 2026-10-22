# Codex implementation prompt: Ritual Airdrop Playground

Act as an expert full-stack developer and Netlify deployment engineer. Implement the backend for my existing Ritual Airdrop Playground, integrate it with the supplied frontend, and deploy the finished application to my GitHub-connected Netlify project. Do the implementation and verification, not only a plan.

This is an unofficial, just-for-fun community airdrop simulator. Its results are hypothetical estimates based on editable assumptions. It is not an eligibility checker, token claim service, official Ritual application, or promise of rewards.

## 1. Start from the supplied application

Inspect the connected GitHub repository and the attached frontend source archive before changing anything. If the repository is empty, import the archive into the repository root. If it already contains the application, preserve its structure and unrelated changes. Follow applicable repository instructions.

The supplied frontend is buildless HTML, CSS, and JavaScript ES modules:

- `dist/index.html`: page structure and disclosures.
- `dist/styles.css` and `dist/refinements.css`: responsive interface and Ritual-inspired colors.
- `dist/app.mjs`: role selection, comparisons, scenarios, URL sharing, and PNG export.
- `dist/model.mjs`: calculation, validation, defaults, and scenario serialization.
- `dist/assets/ritual-logo.jpg`: supplied Ritual logo; I may attach a replacement original.
- `dist/assets/reference.png`: community assumption reference.
- `model.test.mjs`: existing model tests.
- `netlify.toml` and `dist/_headers`: initial static hosting configuration.

Keep this frontend and its visual identity. Extend it to use the backend; do not rebuild it with a different framework just to add API endpoints. Retain exclusive main-role selection, additional-role checkboxes, animated estimates, price and pool-share controls, editable counts and weights, role comparisons, up to three locally saved scenarios, share links, PNG downloads, and the mobile result bar.

## 2. Use the exact supplied Ritual logo

Use my attached original logo, or the existing supplied logo when no replacement is attached. Do not redraw it, generate an imitation, replace it with a letter, or alter its geometry. Preserve aspect ratio and use the same asset in the header, footer, result card, and downloaded image. Derive an appropriate favicon from the original without changing the mark.

Preserve the current green, white, and mint theme. The existing reference green is `#1A6B4A`; keep contrast accessible. Optimize the image only when that does not visibly change the logo. Keep assets local so they work on the deployed domain and in PNG export.

Keep a visible notice near results and on shared/downloaded cards: “Unofficial community simulation. For fun only. Assumptions are editable; rewards and token prices are not guaranteed.” Do not describe server validation as confirmation of real airdrop eligibility.

## 3. Backend architecture

Use Netlify Functions with JavaScript ES modules, the current supported Node.js runtime, and the current Netlify Request/Response handler API. Confirm current APIs in official Netlify documentation before implementing. Retain the static frontend with `dist` as the publish directory and use `netlify/functions` for functions. Avoid an always-running Express server.

Use one shared pure calculation module for browser and server so the formulas cannot drift. Keep server-only storage code outside `dist`. Use Netlify Blobs for small, immutable, anonymous shared-scenario documents. A separate database, authentication service, wallet connection, or Discord OAuth flow is unnecessary for this version.

Create a versioned configuration for defaults and role metadata. Maintain it in Git. Visitors may customize their own scenario, but cannot modify global defaults. Do not build a public configuration editor or an admin dashboard.

Use a site-wide Blobs store so production scenarios survive future deploys. Because site-wide stores can be accessible across deploy contexts, explicitly isolate production data from previews and local development with trusted server-side context configuration. Do not accept a storage namespace from the client. Use strong reads where needed and conditional creation to avoid overwriting existing records. Use the documented Netlify runtime integration instead of exposing storage credentials to browsers.

Add only necessary dependencies, pin a supported runtime and lockfile, and provide working development, test, and build commands. Do not add paid services or unnecessary infrastructure.

## 4. Preserve and document the calculation

The current frontend uses the reference-image exponential model, not direct linear payout multiples. Preserve its default behavior. The numbers below are community assumptions, not verified current Discord counts or official allocation weights.

| ID | Role | Type | Assumed memberships | Raw weight |
| --- | --- | --- | ---: | ---: |
| bitty | Bitty | Main | 513 | 1.0 |
| ritty | Ritty | Main | 517 | 1.8 |
| ritualist | Ritualist | Main | 185 | 2.7 |
| zealot | Zealot | Main | 22 | 3.6 |
| radiant | Radiant Ritualist | Main | 9 | 4.5 |
| node | Node Runner | Additional | 500 | 2.5 |
| prime | Prime Genesis | Additional | 100 | 1.8 |
| builder | dApp Builder | Additional | 207 | 1.8 |
| early | Early Genesis | Additional | 400 | 1.4 |
| frenrug | Frenrug | Additional | 1000 | 1.4 |
| genesis | Genesis | Additional | 500 | 1.0 |

Default pool: 50,000,000 tokens. Default share assigned to these categories: 100%. Default hypothetical token price: USD 0.05. Keep these editable. A 100% modelled share is a scenario assumption, not a claim that every airdrop token belongs to these Discord categories.

For every role category i:

```text
effectiveWeight_i = exp(rawWeight_i - 1)
budget = totalPool * modelledSharePercent / 100
denominator = sum(membershipCount_i * effectiveWeight_i)
x = budget / denominator
tokensPerHolder_i = x * effectiveWeight_i, when membershipCount_i > 0
categoryAllocation_i = membershipCount_i * tokensPerHolder_i
userTokens = tokensPerHolder_main + sum(tokensPerHolder_selectedAdditionalRoles)
userUSD = userTokens * assumedTokenPrice
```

A zero-count category contributes zero allocation and cannot be selected for a valid result. Reject an all-zero denominator. Require exactly one main role and distinct additional roles. Do not stack main roles or exponentiate the combined raw weights of selected roles. Additional categories, including Genesis variants, stack independently in this model; disclose this assumption.

These rows sum to 3,953 memberships, not unique people. The reference image footer says 3,453; preserve the row values and explain this discrepancy. Do not invent a unique-user total from overlapping roles.

Use full precision internally and round only for presentation. The default denominator is approximately 8783.166408812405 and x is approximately 5692.707808636479 tokens. Bitty receives approximately 5,692.71 tokens; Radiant Ritualist approximately 188,516.59. Ritualist + Node Runner + dApp Builder gives approximately 69,343.88 tokens and USD 3,467.19 at USD 0.05. The earlier 1x/2x/4x/8x concept is a different model; do not silently blend it into this one.

## 5. API contract and validation

Implement same-origin JSON endpoints with documented request and response examples:

| Endpoint | Behavior |
| --- | --- |
| `GET /api/config` | Return public, versioned defaults, role metadata, model version, and assumption notices. |
| `POST /api/calculate` | Validate the complete scenario and return the server-calculated total, USD value, per-role breakdown, category allocations, denominator, model version, and warnings. No persistence. |
| `POST /api/scenarios` | Validate and recalculate a scenario, save an immutable snapshot, and return its generated ID and a relative share path. |
| `GET /api/scenarios/:id` | Load and validate the saved snapshot, reproduce its result using its recorded model version, and return the scenario and result. |
| `GET /api/health` | Report application/model version and basic service status without exposing secrets or writing data. |

Use a strict, versioned schema. Accept only known roles and fields. Never trust a client-supplied reward total. Validate structural types before calling existing calculation helpers, including nulls and malformed objects.

Preserve these limits: pool is a finite number from 1 to 1e12; modelled share is finite from 0 to 100; price is finite from 0 to 100,000; counts are integers from 0 to 10,000,000; raw weights are finite from 0 to 10. A zero price and zero modelled share are valid. Reject duplicate extras, an additional role used as a main role, a main role listed as an extra, unknown role IDs, unsupported schema versions, selected zero-count categories, and an all-zero denominator. Reject numeric strings rather than silently coercing them.

Limit actual request bodies to 16 KiB, not only a claimed Content-Length. Return consistent JSON errors with a stable code, friendly message, and field errors where useful. Handle malformed JSON, invalid input, missing IDs, oversized bodies, unsupported media types/methods, rate limits, and storage outages with appropriate HTTP status codes. Do not expose stack traces or raw provider errors.

Configure routes so API failures never fall through to a successful HTML page. Avoid permissive cross-origin access. Add platform-supported throttling for public writes and calculation abuse; document actual limits. Do not pretend an in-memory function counter provides a durable global rate limit. Keep request logs minimal and never log secrets or whole submitted payloads.

## 6. Shared scenarios and frontend integration

Keep “Save scenario” as local browser storage. Add a clearly labeled “Create share link” action for server storage; only persist when the user explicitly invokes it. Explain that anyone with the link can view the role selections and assumptions. Do not collect names, Discord IDs, emails, wallet addresses, free-text biographies, or IP addresses in saved documents.

Generate unguessable server-side IDs with at least 128 bits of randomness. Store the schema/model version, creation timestamp, selected roles, pool, share, price, and all role counts/weights used. Snapshots must preserve results if defaults later change. Do not expose a public list of all saved scenarios or public mutation/deletion endpoints. Use relative paths for links to avoid trusting a supplied URL or Host header.

Load shared scenarios through `?s=<id>` or an equally simple documented route. Support the existing encoded `?scenario=` links and local-storage data without breaking them. The current compact scenario format is `{v,p,s,t,m,e,r}`, where `r` contains `[count,weight]` pairs in the existing `ROLES` order. Version any migration explicitly and preserve round trips.

Keep local calculations immediate. Debounce server verification, cancel or ignore obsolete requests, and ensure a slow response cannot replace a newer selection. Show “Calculated locally” or “Server checked” accurately; these describe computation only. Do not issue a storage write on every slider movement.

Include accessible loading, success, validation, not-found, and retry states. If the backend is unavailable, allow local calculations and the existing encoded share link with a clear status message; do not claim a scenario was saved remotely. Handle unavailable browser storage and clipboard APIs gracefully. Keep the exact logo and disclaimer in downloaded PNG cards.

## 7. GitHub and Netlify deployment

Use the GitHub repository selected for this Codex task and my existing connected Netlify project when available. Verify the repository, production branch, and target project before publishing. If the correct target cannot be identified, finish the code and deployment configuration first, then ask only for the missing repository/project identifier or secure sign-in step. Do not ask me to paste access tokens into chat.

Update `netlify.toml` with the correct publish directory, functions directory, build/test command, and API routing. Preserve useful security headers and verify they permit same-origin API calls and image exports. Ensure function responses receive suitable security and cache headers; do not assume static `_headers` rules automatically cover them. Exclude server source, environment files, and secrets from published assets.

Configure Git-based continuous deployment, not only a one-off static drag-and-drop deploy. Use a branch and a Deploy Preview to check the complete app with real Functions and storage. Respect existing GitHub branch protections and required checks. After checks pass, publish to the selected production Netlify project through the authorized repository workflow. Do not force-push, overwrite unrelated projects, change repository visibility, or purchase services.

Use secure existing integrations or the supported Netlify authentication flow. If access is missing, provide a ready-to-merge branch or deployment-ready commit and the exact remaining user action; do not claim the application is live. If no Netlify project exists, identify the correct GitHub repository/team and create or import only the intended project once access is available.

## 8. Verification and acceptance criteria

Run the existing model tests, then add focused backend tests that verify behavior rather than implementation details. Cover reference values, budget conservation, additive role selection, USD-only effects of price changes, scaling from pool/share changes, zero inputs, malformed JSON, type errors, duplicate roles, zero-holder selections, body size limits, and unsupported schema versions. Test that server and browser calculations agree.

Test scenario creation/read round trips, invalid and missing IDs, immutable snapshots after default changes, preview/production store separation, and graceful storage failures. Use deterministic mocked storage for unit tests and a real Netlify preview for the deployed integration check. Never run destructive tests against production data.

Check the deployed interface at mobile and desktop widths: role controls, price/share sliders, advanced assumptions, comparisons, local save/load/remove, short share links opened in a fresh browser session, old encoded links, PNG downloads, reset behavior, keyboard access, reduced motion, and readable errors. Check for console errors, failed assets, layout overflow, and logo distortion.

Verify the production URL itself serves the correct frontend and real API responses. Save a scenario in production and confirm it reloads accurately from its link. Confirm saved production scenarios remain readable after a subsequent deploy when practical; otherwise explicitly report that this persistence check remains unverified.

## 9. Deliver the finished work

Commit the complete application with a lockfile, deployment configuration, meaningful tests, and an updated README. Include local setup, development/test/build commands, the model formula and assumptions, API examples, storage behavior, any environment variable names with placeholder values only, GitHub-to-Netlify deployment steps, and rollback instructions. A fresh checkout should be reproducible.

Report the verified live Netlify URL, GitHub repository/branch/commit, deployment status, completed tests, and any material limitations. Distinguish local checks, preview checks, and production checks. Never substitute an example URL or static-only deployment for a working backend deployment.

Start by inspecting the supplied files and connected repository, then implement, test, and deploy. Make reasonable implementation decisions autonomously. Ask only about information or access that truly blocks completion.

Official technical references to verify during implementation:

- https://docs.netlify.com/build/functions/get-started/
- https://docs.netlify.com/build/functions/api/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/deploy/create-deploys/
