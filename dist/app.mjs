import { renderAirdropCard } from './card.mjs';
import { ROLES, defaults, calculate, scenarioData, readScenario } from './model.mjs';
import { DISCLAIMER } from './config.mjs';
import { requestJson, createVerifier, resultMatches } from './api.mjs';

const $ = id => document.getElementById(id);
const storageKey = 'ritual-airdrop-playground-v1';
const integers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const priceFormat = n => '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 8, minimumFractionDigits: 2 }).format(n);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const fmt = n => Number.isFinite(n) ? integers.format(n) : '—';
const money = n => Number.isFinite(n) ? usd.format(n) : '—';
const initialSharedId = new URL(location.href).searchParams.get('s');
let state = defaults();
let revision = 0;
let publishing = false;
let loadedShare = null;
let shareController;
let loadGeneration = 0;
let output;
let startupMessage = '';
let toastTimer;
let liveTimer;
let counterFrame;
let displayedTokens = 0;
let comparisonUnit = 'tokens';
let savedScenarios = [];
const savedKey = 'ritual-scenario-board-v1';
const brandLogo = new Image();
brandLogo.src = 'assets/ritual-logo.jpg';
const verifier = createVerifier({ onStatus: (kind, message) => {
  $('server-status').textContent = message;
  $('server-status').dataset.status = kind;
  $('retry-verification').hidden = !['offline', 'error'].includes(kind);
} });

try {
  const saved = JSON.parse(localStorage.getItem(savedKey) || '[]');
  if (Array.isArray(saved)) savedScenarios = saved.slice(0, 3).flatMap(data => {
    try { const parsed = readScenario(data); return calculate(parsed).valid ? [parsed] : []; } catch { return []; }
  });
} catch { /* Storage access is optional. */ }

try {
  const shared = new URL(location.href).searchParams.get('scenario');
  if (shared && !initialSharedId) {
    if (shared.length > 6000) throw new Error('Scenario too long');
    state = readScenario(JSON.parse(atob(shared.replace(/-/g, '+').replace(/_/g, '/'))));
    startupMessage = 'Shared scenario loaded. All numbers are hypothetical.';
  } else if (!initialSharedId) {
    const saved = localStorage.getItem(storageKey);
    if (saved) state = readScenario(JSON.parse(saved));
  }
} catch {
  state = defaults();
  startupMessage = 'That saved scenario could not be read. Reference defaults are loaded.';
}

function buildInputs() {
  $('main-roles').innerHTML = ROLES.filter(r => r.kind === 'main').map(r => `<label class="role-card" title="${r.description}"><input type="radio" name="main-role" value="${r.id}" aria-label="${r.name}"><span class="role-card-top">${icon(r.icon)}<span class="radio-mark"></span></span><span class="role-name">${r.name}</span><span class="role-meta"><span id="count-${r.id}"></span><strong id="mult-${r.id}"></strong></span></label>`).join('');
  $('extra-roles').innerHTML = ROLES.filter(r => r.kind === 'extra').map(r => `<label class="extra-card" title="${r.description}"><input type="checkbox" name="extra-role" value="${r.id}" aria-label="${r.name}">${icon(r.icon)}<span class="extra-card-copy"><strong>${r.name}</strong><small id="bonus-${r.id}"></small></span><span class="checkbox-mark">${icon('check')}</span></label>`).join('');
  const ordered = [...ROLES].sort((a, b) => b.weight - a.weight);
  $('assumption-rows').innerHTML = ordered.map(r => `<tr><td>${r.name}<small>${r.kind === 'main' ? 'MAIN' : 'EXTRA'}</small></td><td><input type="number" data-role="${r.id}" data-field="count" min="0" max="10000000" step="1" inputmode="numeric" aria-label="${r.name} assumed holder count"></td><td><input type="number" data-role="${r.id}" data-field="weight" min="0" max="10" step="any" inputmode="decimal" aria-label="${r.name} weight"></td><td id="row-mult-${r.id}">—</td><td id="row-tokens-${r.id}">—</td><td id="row-share-${r.id}">—</td></tr>`).join('');
}

function syncInputs() {
  $('pool-input').value = state.pool;
  $('share-input').value = state.share;
  $('price-input').value = state.price;
  document.querySelectorAll('input[name="main-role"]').forEach(el => { el.checked = el.value === state.main; });
  document.querySelectorAll('input[name="extra-role"]').forEach(el => { el.checked = state.extras.includes(el.value); });
  document.querySelectorAll('input[data-role]').forEach(el => { el.value = state.roles[el.dataset.role][el.dataset.field]; });
  syncPlayControls();
}

function assumptionsChanged() {
  const d = defaults();
  return state.pool !== d.pool || state.share !== d.share || state.price !== d.price || ROLES.some(r => state.roles[r.id].count !== d.roles[r.id].count || state.roles[r.id].weight !== d.roles[r.id].weight);
}

function update(animate = false) {
  revision++;
  output = calculate(state);
  renderAirdropCard(state, output, sharedUrl);
  $('extra-count').textContent = `${state.extras.length} SELECTED`;
  $('clear-extras').disabled = state.extras.length === 0;
  $('model-status').textContent = assumptionsChanged() ? 'CUSTOM ASSUMPTIONS' : 'REFERENCE DEFAULTS';
  const budget = Number.isFinite(state.pool * state.share) ? state.pool * state.share / 100 : NaN;
  $('summary-pool').textContent = Number.isFinite(budget) ? compact.format(budget) + ' RITUAL' : '—';
  $('stat-pool').replaceChildren(document.createTextNode(fmt(state.pool) + ' '), small('RITUAL'));
  $('stat-pool').nextElementSibling.textContent = state.pool === 50000000 ? 'Editable community pool assumption' : 'Your custom total-pool assumption';
  $('stat-price').replaceChildren(document.createTextNode(Number.isFinite(state.price) ? priceFormat(state.price) + ' ' : '— '), small('USD'));
  const memberships = ROLES.reduce((sum, r) => sum + state.roles[r.id].count, 0);
  $('stat-memberships').replaceChildren(document.createTextNode(fmt(memberships) + ' '), small('across 11 roles'));
  $('table-memberships').textContent = fmt(memberships);
  $('table-allocation').textContent = output.rows.length ? fmt(output.rows.reduce((sum, r) => sum + r.allocation, 0)) : '—';
  $('table-share').textContent = output.rows.length ? '100%' : '—';
  $('result-price').textContent = Number.isFinite(state.price) ? priceFormat(state.price) : '—';
  $('result-error').hidden = output.valid;
  $('result-error').replaceChildren(...output.errors.slice(0, 3).map(message => { const p = document.createElement('p'); p.textContent = message; return p; }));
  for (const role of ROLES) {
    const r = output.rows.find(row => row.id === role.id);
    if (role.kind === 'main') {
      $('count-' + role.id).textContent = fmt(state.roles[role.id].count) + ' holders';
      $('mult-' + role.id).textContent = r ? `${decimals.format(r.multiplier)}×` : '—';
    } else $('bonus-' + role.id).textContent = r ? '+ ' + fmt(r.perHolder) + ' RITUAL' : 'CHECK ASSUMPTIONS';
    $('row-mult-' + role.id).textContent = r ? decimals.format(r.multiplier) + '×' : '—';
    $('row-tokens-' + role.id).textContent = r ? decimals.format(r.perHolder) : '—';
    $('row-share-' + role.id).textContent = r ? decimals.format(r.portion) + '%' : '—';
  }
  renderTokenCount(output.valid ? output.tokens : null, animate);
  $('usd-total').textContent = output.valid ? money(output.usd) : 'Check inputs';
  $('selected-count').textContent = `${1 + state.extras.length} ROLE${state.extras.length ? 'S' : ''}`;
  $('breakdown').replaceChildren();
  if (output.valid) {
    for (const r of output.selected) {
      const row = document.createElement('div'); row.className = 'breakdown-row';
      row.innerHTML = `<span>${icon(r.icon)}${r.name}</span><span><small>${r.kind === 'extra' ? '+' : ''}</small>${decimals.format(r.perHolder)}</span>`;
      $('breakdown').append(row);
    }
    try { localStorage.setItem(storageKey, JSON.stringify(scenarioData(state))); } catch { /* A blocked local store must not stop the calculator. */ }
  }
  ['copy-result', 'copy-link', 'download-card'].forEach(id => { $(id).disabled = !output.valid; });
  document.querySelectorAll('[data-price]').forEach(button => { button.setAttribute('aria-pressed', String(Number(button.dataset.price) === state.price)); });
  syncPlayControls();
  renderExploration();
  renderComposition();
  $('mobile-tokens').textContent = output.valid ? fmt(output.tokens) + ' RITUAL' : 'Check your inputs';
  $('mobile-usd').textContent = output.valid ? money(output.usd) : 'View result';
  $('pin-scenario').disabled = !output.valid || savedScenarios.length >= 3;
  $('pin-counter').textContent = `${savedScenarios.length} / 3`;
  $('create-share').disabled = !output.valid || publishing;
  verifier.schedule(output.valid ? scenarioData(state) : null, output);
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { $('result-live').textContent = output.valid ? `Hypothetical estimate: ${fmt(output.tokens)} RITUAL, worth ${money(output.usd)} at an assumed price of ${priceFormat(state.price)}.` : output.errors[0]; }, 350);
  if (animate && output.valid) {
    $('token-total').classList.remove('pulse');
    requestAnimationFrame(() => $('token-total').classList.add('pulse'));
  }
}

function renderTokenCount(target, animate) {
  cancelAnimationFrame(counterFrame);
  if (target === null) { $('token-total').textContent = '—'; return; }
  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { displayedTokens = target; $('token-total').textContent = fmt(target); return; }
  const start = performance.now(); const from = displayedTokens;
  const tick = now => {
    const progress = Math.min(1, (now - start) / 380);
    displayedTokens = from + (target - from) * (1 - Math.pow(1 - progress, 3));
    $('token-total').textContent = fmt(displayedTokens);
    if (progress < 1) counterFrame = requestAnimationFrame(tick);
  };
  counterFrame = requestAnimationFrame(tick);
}

function syncPlayControls() {
  const slider = $('price-slider');
  const max = Number.isFinite(state.price) ? Math.max(1, Math.ceil(state.price * 10) / 10) : 1;
  slider.max = max;
  slider.value = Number.isFinite(state.price) ? state.price : 0;
  slider.style.setProperty('--progress', `${Math.max(0, Math.min(100, state.price / max * 100)) || 0}%`);
  slider.setAttribute('aria-valuetext', Number.isFinite(state.price) ? priceFormat(state.price) + ' per token, hypothetical' : 'Check token price');
  $('price-range-max').textContent = priceFormat(max);
  if (document.activeElement !== $('play-price')) $('play-price').value = Number.isFinite(state.price) ? state.price : '';
  $('share-slider').value = Number.isFinite(state.share) ? state.share : 0;
  $('share-slider').style.setProperty('--progress', `${Math.max(0, Math.min(100, state.share)) || 0}%`);
  $('share-slider').setAttribute('aria-valuetext', `${state.share}% of the total pool`);
  $('play-share').textContent = Number.isFinite(state.share) ? state.share + '%' : '—';
  const budget = state.pool * state.share / 100;
  $('play-budget').textContent = Number.isFinite(budget) ? compact.format(budget) + ' RITUAL modelled' : 'Check assumptions';
}

function renderExploration() {
  const host = $('role-comparison'); host.replaceChildren();
  if (!output.valid) { const p = document.createElement('p'); p.textContent = 'Correct the assumptions above to compare roles.'; host.append(p); $('comparison-note').textContent = ''; return; }
  const extras = output.selected.filter(r => r.kind === 'extra').reduce((sum, r) => sum + r.perHolder, 0);
  const rows = output.rows.filter(r => r.kind === 'main');
  const largest = Math.max(...rows.map(r => r.count ? r.perHolder + extras : 0), 0);
  for (const r of rows) {
    const amount = r.perHolder + extras;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'compare-row'; b.dataset.main = r.id;
    b.setAttribute('aria-pressed', String(r.id === state.main));
    b.setAttribute('aria-label', `Try ${r.name}: ${fmt(amount)} RITUAL including selected extras`);
    b.disabled = r.count === 0;
    const value = comparisonUnit === 'usd' ? money(amount * state.price) : fmt(amount);
    b.innerHTML = `<span class="compare-name">${icon(r.icon)}<span>${r.name}</span></span><span class="compare-track"><span style="width:${largest && r.count ? amount / largest * 100 : 0}%"></span></span><strong>${r.count ? value : 'No holders'}</strong><span class="compare-arrow" aria-hidden="true">${r.id === state.main ? '✓' : '↗'}</span>`;
    host.append(b);
  }
  $('comparison-note').textContent = state.extras.length ? `${state.extras.length} selected extra role${state.extras.length === 1 ? '' : 's'} included in every row. All values are hypothetical.` : 'Main roles only. Choose extra roles above to see them included in every comparison.';
}

function renderComposition() {
  $('composition-track').replaceChildren();
  if (!output.valid) { $('composition-caption').textContent = ''; return; }
  const base = output.selected.find(r => r.kind === 'main');
  const baseShare = output.tokens ? base.perHolder / output.tokens * 100 : 0;
  const main = document.createElement('span'); main.style.width = baseShare + '%'; main.className = 'main-slice';
  const extra = document.createElement('span'); extra.style.width = output.tokens ? (100 - baseShare) + '%' : '0%'; extra.className = 'extra-slice';
  $('composition-track').append(main, extra);
  $('composition-caption').textContent = output.tokens ? `${Math.round(baseShare)}% main role · ${Math.round(100 - baseShare)}% extra roles` : 'No tokens allocated at the current pool share.';
}

function persistBoard() { try { localStorage.setItem(savedKey, JSON.stringify(savedScenarios.map(scenarioData))); } catch { toast('Browser storage is unavailable; scenarios last for this visit.'); } }

function renderBoard() {
  const host = $('saved-scenarios'); host.replaceChildren();
  if (!savedScenarios.length) {
    const empty = document.createElement('div'); empty.className = 'board-empty';
    empty.innerHTML = `<span aria-hidden="true">＋</span><div><strong>A few possibilities, side by side.</strong><p>Use “Save this scenario” on your result, then try another role or price.</p></div>`; host.append(empty);
  }
  savedScenarios.forEach((s, i) => {
    const result = calculate(s); if (!result.valid) return;
    const role = ROLES.find(r => r.id === s.main);
    const card = document.createElement('article'); card.className = 'saved-card';
    card.innerHTML = `<div class="saved-top"><span>SCENARIO 0${i + 1}</span><button type="button" data-remove="${i}" aria-label="Remove saved scenario ${i + 1}">×</button></div><h3>${role.name}<small>${s.extras.length ? ' + ' + s.extras.length + ' extra' + (s.extras.length === 1 ? '' : 's') : ' · main role only'}</small></h3><strong class="saved-tokens">${fmt(result.tokens)} <small>RITUAL</small></strong><p class="saved-value">${money(result.usd)} <span>at ${priceFormat(s.price)}</span></p><p class="saved-meta">${fmt(result.budget)} token pool · ${s.share}% modelled</p><button class="load-scenario" type="button" data-load="${i}">Load scenario <span aria-hidden="true">↗</span></button>`;
    host.append(card);
  });
  $('pin-counter').textContent = `${savedScenarios.length} / 3`;
  $('pin-scenario').disabled = !output?.valid || savedScenarios.length >= 3;
}

function small(text) { const el = document.createElement('small'); el.textContent = text; return el; }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3800); }

function openAssumptions() { $('assumptions').open = true; }
['nav-assumptions', 'edit-assumptions'].forEach(id => $(id).addEventListener('click', openAssumptions));
if (location.hash === '#assumptions') openAssumptions();

document.addEventListener('change', event => {
  const el = event.target;
  if (el.name === 'main-role') { state.main = el.value; update(true); }
  if (el.name === 'extra-role') { state.extras = [...document.querySelectorAll('input[name="extra-role"]:checked')].map(input => input.value); update(true); }
});

$('assumptions').addEventListener('input', event => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) return;
  const n = el.value.trim() === '' ? NaN : Number(el.value);
  if (el.dataset.role) state.roles[el.dataset.role][el.dataset.field] = n;
  else if (el.id === 'pool-input') state.pool = n;
  else if (el.id === 'share-input') state.share = n;
  else if (el.id === 'price-input') state.price = n;
  else return;
  update();
});

document.querySelectorAll('[data-price]').forEach(button => button.addEventListener('click', () => { state.price = Number(button.dataset.price); $('price-input').value = state.price; update(true); }));
$('clear-extras').addEventListener('click', () => { state.extras = []; syncInputs(); update(true); });
$('reset-assumptions').addEventListener('click', () => { const main = state.main; const extras = [...state.extras]; state = defaults(); state.main = main; state.extras = extras; syncInputs(); update(true); toast('Reference assumptions restored. Your roles are kept.'); });
$('price-slider').addEventListener('input', event => { state.price = Number(event.target.value); $('price-input').value = state.price; update(); });
$('play-price').addEventListener('input', event => { state.price = event.target.value.trim() === '' ? NaN : Number(event.target.value); $('price-input').value = event.target.value; update(); });
$('share-slider').addEventListener('input', event => { state.share = Number(event.target.value); $('share-input').value = state.share; update(); });
$('role-comparison').addEventListener('click', event => { const button = event.target.closest('[data-main]'); if (!button || button.disabled) return; state.main = button.dataset.main; syncInputs(); update(true); });
document.querySelectorAll('[data-compare]').forEach(button => button.addEventListener('click', () => { comparisonUnit = button.dataset.compare; document.querySelectorAll('[data-compare]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderExploration(); }));
$('pin-scenario').addEventListener('click', () => {
  if (!output.valid || savedScenarios.length >= 3) return;
  const data = scenarioData(state);
  if (savedScenarios.some(s => JSON.stringify(scenarioData(s)) === JSON.stringify(data))) { toast('This exact scenario is already on your board.'); return; }
  savedScenarios.push(readScenario(data)); persistBoard(); renderBoard(); toast(`Scenario ${savedScenarios.length} saved. Try changing a role or price.`);
});
$('saved-scenarios').addEventListener('click', event => {
  const load = event.target.closest('[data-load]'); const remove = event.target.closest('[data-remove]');
  if (load) { const saved = savedScenarios[Number(load.dataset.load)]; if (!saved) return; state = readScenario(scenarioData(saved)); syncInputs(); update(true); toast('Saved roles and assumptions restored.'); }
  if (remove) { const index = Number(remove.dataset.remove); if (!savedScenarios[index]) return; savedScenarios.splice(index, 1); persistBoard(); renderBoard(); toast('Scenario removed from your board.'); }
});
$('reset-all').addEventListener('click', () => { state = defaults(); syncInputs(); update(true); toast('Current scenario reset. Your saved scenarios are kept.'); });

function sharedUrl() {
  const url = new URL(location.href); url.hash = ''; url.search = '';
  url.searchParams.set('scenario', btoa(JSON.stringify(scenarioData(state))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''));
  return url.toString();
}

function resultText() {
  const names = output.selected.map(r => r.name).join(' + ');
  return `My hypothetical Ritual bag 👀\n\n${names}\n≈ ${fmt(output.tokens)} RITUAL\n≈ ${money(output.usd)} at an assumed ${priceFormat(state.price)}/token\n\nModel: ${fmt(state.pool)} total tokens × ${state.share}% assigned to these roles; exponential weights from editable community assumptions.\n\n${DISCLAIMER}\nFull assumptions: ${sharedUrl()}\n\ngRitual 💚`;
}

async function copy(text, message) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text); toast(message);
  } catch {
    $('copy-fallback').value = text; $('copy-dialog').showModal(); $('copy-fallback').focus(); $('copy-fallback').select();
  }
}
$('copy-result').addEventListener('click', () => { if (output.valid) copy(resultText(), 'Result copied, with its assumptions and just-for-fun note.'); });
$('copy-link').addEventListener('click', () => { if (output.valid) copy(sharedUrl(), 'Scenario link copied, including every assumption.'); });
$('close-dialog').addEventListener('click', () => $('copy-dialog').close());
$('select-text').addEventListener('click', () => { $('copy-fallback').focus(); $('copy-fallback').select(); });
$('copy-dialog').addEventListener('click', event => { if (event.target === $('copy-dialog')) { const rect = $('copy-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('copy-dialog').close(); } });

function fitText(ctx, text, x, y, width, size, family = 'Arial', weight = '500') {
  while (size > 12) { ctx.font = `${weight} ${size}px ${family}`; if (ctx.measureText(text).width <= width) break; size -= 2; }
  ctx.fillText(text, x, y);
}
function wrapText(ctx, text, x, y, width, lineHeight) {
  const words = text.split(' '); let line = '';
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > width && line) { ctx.fillText(line, x, y); line = word; y += lineHeight; } else line = next; }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

$('download-card').addEventListener('click', () => $('card-download').click());

buildInputs(); syncInputs(); update(); renderBoard();
if (startupMessage) toast(startupMessage);


$('retry-verification').addEventListener('click', () => verifier.schedule(output.valid ? scenarioData(state) : null, output));
$('create-share').addEventListener('click', async () => {
  if (!output.valid || publishing) return;
  publishing = true;
  $('create-share').disabled = true;
  $('create-share').textContent = 'Creating share link…';
  $('share-status').textContent = 'Saving only this snapshot of your roles and assumptions…';
  $('share-output').hidden = true;
  const snapshot = scenarioData(state);
  const expected = calculate(readScenario(snapshot));
  const snapshotRevision = revision;
  try {
    const saved = await requestJson('/api/scenarios', { payload: snapshot });
    if (!/^[a-f0-9]{32}$/.test(saved.id) || saved.sharePath !== `/?s=${saved.id}` || !resultMatches(expected, saved.result)) throw new Error('The saved result could not be verified. Please retry.');
    $('share-url').value = new URL(saved.sharePath, location.origin).href;
    $('share-output').hidden = false;
    $('share-status').textContent = snapshotRevision === revision ? 'Share link created. Anyone with the link can view this snapshot.' : 'Link created for your earlier snapshot. Your current edits are kept.';
    toast('Your shared snapshot is saved. Copy its link below.');
  } catch (error) {
    $('share-status').textContent = `${error.message} Nothing is confirmed saved. You can still copy a local scenario link.`;
  } finally {
    publishing = false;
    $('create-share').disabled = !output.valid;
    $('create-share').textContent = 'Create share link';
  }
});
$('copy-short-link').addEventListener('click', () => copy($('share-url').value, 'Saved snapshot link copied.'));

function sharedNotice(message, action, label = 'Retry loading') {
  $('shared-notice').hidden = false;
  $('shared-message').textContent = message;
  $('shared-action').hidden = !action;
  $('shared-action').textContent = label;
  $('shared-action').onclick = action || null;
}
function applyShared(data) {
  state = readScenario(data.scenario); syncInputs(); update(true);
  sharedNotice('Shared snapshot loaded. Its original roles and assumptions are restored. This remains a hypothetical simulation.');
}
async function loadShared(id) {
  const generation = ++loadGeneration;
  const initialRevision = revision;
  shareController?.abort(); shareController = new AbortController();
  if (!/^[a-f0-9]{32}$/.test(id)) { sharedNotice('This shared link has an invalid ID. You can still use the local calculator.'); return; }
  sharedNotice('Loading the shared snapshot… You can keep using the calculator.');
  try {
    const saved = await requestJson(`/api/scenarios/${id}`, { signal: shareController.signal });
    if (generation !== loadGeneration) return;
    const expected = calculate(readScenario(saved.scenario));
    if (!expected.valid || !resultMatches(expected, saved.result)) throw new Error('This shared calculation could not be reproduced.');
    loadedShare = saved;
    if (revision === initialRevision) applyShared(saved);
    else sharedNotice('The shared snapshot is ready. Loading it will replace your current selections.', () => applyShared(loadedShare), 'Load shared snapshot');
  } catch (error) {
    if (generation !== loadGeneration || error.name === 'AbortError') return;
    sharedNotice(`${error.message} Your local calculator is available.`, error.status === 404 || error.status === 400 ? null : () => loadShared(id));
  }
}
if (initialSharedId !== null) loadShared(initialSharedId);
