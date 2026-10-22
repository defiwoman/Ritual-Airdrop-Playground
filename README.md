# Ritual Airdrop Playground

A browser-only, unofficial community calculator. Select exactly one main Discord role and any extra roles, edit assumptions, compare roles, save up to three scenarios locally, copy a result or scenario link, or download a PNG card. The interface uses the supplied Ritual logo and its green-and-white palette. There is no wallet connection, Discord verification, token claim or live price feed.

`CODEX_BACKEND_PROMPT.md` is the comprehensive implementation brief for adding a Netlify Functions backend and durable shared scenarios. That backend is proposed work; it is not implemented in this frontend package.

## Run locally

Serve `dist/` with any static HTTP server. For example, from the project directory run `python -m http.server 8080 --directory dist` and open `http://localhost:8080`.

## Model

Each category uses `effective weight = exp(weight - 1)`. Its per-member reward is `pool * modelled_share / 100 * effective_weight / sum(all_holder_counts * effective_weight)`. The individual's estimate sums one main-role reward and all selected additional-role rewards. Counts represent memberships, not distinct people. Main roles do not stack. Extra categories, including Genesis variants, stack independently as a modelling assumption.

The default 50,000,000 total token pool is from https://tokenomics.ritualfoundation.org/. The assumed price is $0.05. All role weights and counts come from the user-provided community reference in `dist/assets/reference.png`, and are unverified. The rows sum to 3,953 memberships even though the reference footer says 3,453. This implementation uses the row values and reproduces all 11 per-holder token figures.

The official airdrop covers multiple contributor tracks. The model does not establish eligibility or the official allocation across those tracks. Reduce the modelled share to reserve tokens for contributors outside the selected categories.

## Files

- `dist/index.html`: accessible page structure and source disclosures
- `dist/styles.css` and `dist/refinements.css`: responsive design, exact reference green, and interactive scenario controls
- `dist/model.mjs`: calculation, input validation and scenario serialization
- `dist/app.mjs`: interactions, local persistence, share links and PNG rendering
- `model.test.mjs`: reference accuracy, conservation, stacking and edge-case tests
- `dist/assets/ritual-logo.jpg`: original user-supplied logo, preserved byte-for-byte
- `netlify.toml` and `dist/_headers`: static Netlify hosting and security headers
- `CODEX_BACKEND_PROMPT.md`: backend implementation and GitHub-to-Netlify deployment brief

## Check

`node --test model.test.mjs`

## Netlify frontend deployment

Import this source into your GitHub repository, then connect that repository to the intended Netlify project. The included `netlify.toml` sets `dist` as the publish directory. No dependencies or build step are required for the current frontend. Run the Node tests before deploying.

For the complete backend implementation, provide Codex with this source, `CODEX_BACKEND_PROMPT.md`, the original logo if you want to replace the bundled copy, and access to the intended repository and Netlify project. Codex should add server functions and storage before deploying that full version through Git. A static-only deployment does not implement the backend described in the prompt.

The working Sites checkout tracks its separate Site identity in `.openai/hosting.json`. The portable frontend source archive deliberately excludes that identity and Git metadata.
