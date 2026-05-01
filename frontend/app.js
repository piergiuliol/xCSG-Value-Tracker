/**
 * app.js — xCSG Value Measurement Tracker SPA v2
 * Alira Health · Confidential
 *
 * Vanilla JS, no frameworks. Chart.js 4.4.0 loaded via CDN (defer).
 * String values for D3 moat test use em dashes (—).
 */

/* ═══════════════════════════════════════════════════════════════════════
   STATE & CONFIG
   ═══════════════════════════════════════════════════════════════════════ */

const API = '/api';
const ENGAGEMENT_STAGES = ['New business (pre-mandate)', 'Active engagement', 'Post-engagement (follow-on)'];
const TEAM_SIZES = ['1', '2', '3', '4+'];
const REVISION_DEPTH_OPTIONS = ['No revisions needed', 'Cosmetic only', 'Moderate rework', 'Major rework'];
const SCOPE_OPTIONS = [
  'Yes expanded scope', 'Yes new engagement', 'No', 'Not yet delivered'
];
const CLIENT_PULSE_OPTIONS = ['Not yet received', 'Exceeded expectations', 'Met expectations', 'Below expectations'];

const state = {
  user: null,
  token: sessionStorage.getItem('xcsg_token') || null,
  categories: [],
  practices: [],
};

const charts = {};
let schema = null;

async function loadSchema() {
  if (!schema) {
    try {
      const resp = await fetch(API + '/schema');
      if (resp.ok) schema = await resp.json();
    } catch { /* will retry next route */ }
  }
}

async function loadSettings() {
  if (window._defaultCurrency) return;
  try {
    const s = await apiCall('GET', '/settings');
    window._defaultCurrency = s?.default_currency || 'EUR';
  } catch {
    window._defaultCurrency = 'EUR';
  }
}

function getAssessmentFields() {
  if (!schema) return [];
  const sectionOrder = ['B', 'C', 'D', 'E', 'F', 'G'];
  return sectionOrder.map(sec => {
    const secMeta = schema.sections[sec];
    if (!secMeta) return null;
    const fields = Object.entries(schema.fields)
      .filter(([k, f]) => f.section === sec)
      .map(([key, f]) => ({
        id: key.split('_')[0].toUpperCase(),
        key,
        label: f.label,
        scores: f.scores || {},
      }));
    if (!fields.length) return null;
    return { section: sec, title: secMeta.title, icon: secMeta.icon, desc: secMeta.desc, fields };
  }).filter(Boolean);
}

function getExpertSections() {
  return schema?.sections || {};
}

function scoreColor(s) {
  if (s >= 0.75) return 'var(--success, #10B981)';
  if (s >= 0.5) return 'var(--blue, #3B82F6)';
  if (s >= 0.25) return 'var(--warning, #F59E0B)';
  return 'var(--danger, #EF4444)';
}

function fmtCurrency(value, currency) {
  if (value == null || isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(value);
  } catch (e) {
    return `${currency || 'EUR'} ${Number(value).toLocaleString()}`;
  }
}

function fmtPctMaybe(v) {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

function fmtRatioMaybe(v) {
  return v == null ? '—' : `${v.toFixed(2)}×`;
}

function ratioTone(v) {
  if (v == null) return '';
  const t = schema?.dashboard?.thresholds?.metric_tone;
  const success = t?.success_above ?? 1.5;
  const blue    = t?.blue_above    ?? 1.0;
  const warning = t?.warning_above ?? 0.8;
  if (v >= success) return 'chip-green';
  if (v >= blue)    return 'chip-amber';   // chip-blue not in CSS; amber used per Task 10 adaptation
  if (v >= warning) return 'chip-amber';
  return 'chip-red';
}

function pctTone(v) {
  if (v == null) return '';
  if (v < 0) return 'chip-red';
  const t = schema?.dashboard?.thresholds?.pct_tone;
  const success = t?.success_above ?? 0.8;
  const blue    = t?.blue_above    ?? 0.6;
  const warning = t?.warning_above ?? 0.4;
  if (v >= success) return 'chip-green';
  if (v >= blue)    return 'chip-amber';
  if (v >= warning) return 'chip-amber';
  return 'chip-red';
}

function renderEconomicsTilesGrid(summary, schemaEconomicsTiles) {
  // schemaEconomicsTiles is window.schema.economics_tiles (or the deep-tab equivalent
  // in PR3 if we ever differentiate). Each tile entry: { key, label, format }.
  const baseCurrency = summary.base_currency || 'USD';
  const fc = (v) => fmtCurrency(v, baseCurrency);
  const tileFor = (def) => {
    let raw, formatted;
    if (def.format === 'currency') {
      raw = summary[def.key];
      formatted = fc(raw);
    } else if (def.format === 'percent') {
      raw = summary[def.key];
      formatted = fmtPctMaybe(raw);
    } else if (def.format === 'fraction') {
      // Special case: qualifying_project_count is "N of M" against total_complete_count.
      const num = summary[def.key];
      const den = summary.total_complete_count;
      raw = num;
      formatted = (num == null || den == null) ? '—' : `${num} / ${den}`;
    } else {
      raw = summary[def.key];
      formatted = raw == null ? '—' : String(raw);
    }
    // Color tone: percent uses pct_tone, currency/ratio use metric_tone.
    const toneKey = def.format === 'percent' ? 'pct_tone' : 'metric_tone';
    return `<div class="metric-tile" title="${esc(def.label)}">
      <div class="metric-tile-value" style="color:${metricTone(raw, toneKey)}">${formatted}</div>
      <div class="metric-tile-label">${esc(def.label)}</div>
    </div>`;
  };
  return `<div class="metrics-grid">${schemaEconomicsTiles.map(tileFor).join('')}</div>`;
}

function renderPioneerEconomicsTiles(summary) {
  if (!summary) return '';
  const baseCurrency = summary.base_currency || 'USD';
  const fc = (v) => fmtCurrency(v, baseCurrency);
  const tiles = [
    { label: 'Revenue contribution', value: summary.total_revenue, format: 'currency' },
    { label: 'Cost saved',           value: summary.total_cost_saved, format: 'currency' },
    { label: 'Avg margin %',         value: summary.avg_margin_pct, format: 'percent' },
    { label: 'Avg revenue / day',    value: summary.avg_revenue_per_day_xcsg, format: 'currency' },
  ];
  const tileHtml = tiles.map(t => {
    let formatted, raw = t.value;
    if (t.format === 'currency') formatted = fc(raw);
    else if (t.format === 'percent') formatted = fmtPctMaybe(raw);
    else formatted = raw == null ? '—' : String(raw);
    const toneKey = t.format === 'percent' ? 'pct_tone' : 'metric_tone';
    return `<div class="metric-tile" title="${esc(t.label)}">
      <div class="metric-tile-value" style="color:${metricTone(raw, toneKey)}">${formatted}</div>
      <div class="metric-tile-label">${esc(t.label)}</div>
    </div>`;
  }).join('');
  return `<div class="metrics-grid" data-testid="pioneer-economics-tiles">${tileHtml}</div>`;
}

function renderEconomicsSummaryCard(data) {
  if (!data || !data.summary) return '';
  const s = data.summary;
  const tiles = (schema && schema.economics_tiles) || [];
  const charts = ((schema && schema.economics_charts) || [])
    .filter(c => c.surface === 'summary');

  // Empty state.
  if ((s.qualifying_project_count || 0) === 0) {
    const denom = s.total_complete_count || 0;
    const msg = denom === 0
      ? 'No completed projects yet.'
      : `0 of ${denom} completed projects have full economics data (revenue + legacy team mix).`;
    return `<div class="card economics-card" style="margin-top:24px;padding:24px;border:1px solid var(--gray-200);border-radius:8px;background:var(--gray-50)">
      <h3 style="margin:0 0 8px;color:var(--navy)">Economics</h3>
      <p style="margin:0;color:var(--gray-500)">${esc(msg)} <a href="#projects" style="color:var(--brand-blue,#6EC1E4)">Edit projects →</a></p>
    </div>`;
  }

  // FX-missing banner.
  const missing = s.currencies_missing_fx || [];
  const banner = missing.length === 0 ? '' : `
    <div style="margin:12px 0;padding:8px 12px;background:var(--amber-50,#fffbeb);border-left:3px solid var(--amber-400,#fbbf24);color:var(--gray-700);font-size:12px">
      Excluded from total: ${missing.map(esc).join(', ')} —
      <a href="#settings" style="color:var(--brand-blue,#6EC1E4)">set rates in Settings</a>.
    </div>`;

  // Caveat line under tiles.
  const caveat = `<div style="margin-top:8px;color:var(--gray-500);font-size:12px">
    Across ${s.qualifying_project_count} of ${s.total_complete_count} completed projects with full economics data.
    Converted to ${esc(s.base_currency)} using rates from Settings.
  </div>`;

  // Chart containers (heights from schema). Only render when there's quarterly
  // data — otherwise _initEconomicsCharts skips them and we'd be left with
  // empty 240px-tall boxes.
  const hasQuarterly = (data.trends && Array.isArray(data.trends.quarterly) && data.trends.quarterly.length > 0);
  const chartCards = !hasQuarterly ? '' : charts.map(c => `
    <div class="chart-card" data-chart-id="${c.id}" data-testid="${c.id}">
      <div class="chart-card-title">${esc(c.title)}</div>
      <div class="chart-body" style="height:${c.height}px">
        <div id="${c.id}" style="width:100%;height:100%"></div>
      </div>
    </div>`).join('');

  return `<div class="card economics-card" data-testid="economics-summary-card" style="margin-top:24px;padding:24px;border:1px solid var(--gray-200);border-radius:8px;background:var(--gray-50)">
    <h3 style="margin:0 0 16px;color:var(--navy)">Economics</h3>
    ${renderEconomicsTilesGrid(s, tiles)}
    ${caveat}
    ${banner}
    ${!hasQuarterly ? '' : `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:16px;margin-top:16px">
      ${chartCards}
    </div>`}
  </div>`;
}

function renderEconomicsBreakdownTable(byPractice, baseCurrency) {
  const fc = (v) => fmtCurrency(v, baseCurrency || 'USD');
  if (!Array.isArray(byPractice) || byPractice.length === 0) {
    return `<div class="card" style="padding:16px;color:var(--gray-500);font-size:13px">No per-practice breakdown available.</div>`;
  }
  const rows = byPractice.map(r => `
    <tr>
      <td><strong>${esc(r.practice_code || '—')}</strong></td>
      <td>${r.n}</td>
      <td>${fc(r.revenue)}</td>
      <td>${fc(r.cost_saved)}</td>
      <td>${fmtPctMaybe(r.margin_pct)}</td>
    </tr>`).join('');
  return `<div class="card" data-testid="economics-by-practice-table" style="overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--gray-200);font-weight:600;color:var(--navy)">By Practice</div>
    <table class="data-table" style="width:100%">
      <thead><tr>
        <th>Practice</th><th>Projects</th><th>Revenue</th><th>Cost saved</th><th>Avg margin %</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderEconomicsCurrencyTiles(byCurrency) {
  if (!Array.isArray(byCurrency) || byCurrency.length === 0) {
    return `<div class="card" style="padding:16px;color:var(--gray-500);font-size:13px">No currency breakdown available.</div>`;
  }
  const tiles = byCurrency.map(c => {
    const amount = fmtCurrency(c.native_revenue, c.code);
    const projectsLbl = `${c.n_projects} project${c.n_projects === 1 ? '' : 's'}`;
    return `<div class="metric-tile" data-testid="currency-tile-${esc(c.code)}" title="Native amount in ${esc(c.code)}">
      <div class="metric-tile-value">${amount}</div>
      <div class="metric-tile-label">${esc(c.code)} · ${projectsLbl}</div>
    </div>`;
  }).join('');
  return `<div class="card" data-testid="economics-currency-mix" style="padding:16px">
    <div style="font-weight:600;color:var(--navy);margin-bottom:12px">Currency mix (native amounts)</div>
    <div class="metrics-grid">${tiles}</div>
  </div>`;
}

function renderEconomicsTab(data) {
  if (!data || !data.summary) {
    return `<div class="empty-state" style="padding:32px;color:var(--gray-500)">Loading economics…</div>`;
  }
  const s = data.summary;
  const breakdowns = data.breakdowns || {};
  const tiles = (schema && schema.economics_tiles) || [];
  const tabCharts = ((schema && schema.economics_charts) || [])
    .filter(c => c.surface === 'tab');

  // Empty state — same wording as the Summary card.
  if ((s.qualifying_project_count || 0) === 0) {
    const denom = s.total_complete_count || 0;
    const msg = denom === 0
      ? 'No completed projects yet.'
      : `0 of ${denom} completed projects have full economics data (revenue + legacy team mix).`;
    return `<div class="empty-state" style="padding:32px">
      <h3 style="margin:0 0 8px;color:var(--navy)">Economics</h3>
      <p style="margin:0;color:var(--gray-500)">${esc(msg)} <a href="#projects" style="color:var(--brand-blue,#6EC1E4)">Edit projects →</a></p>
    </div>`;
  }

  // Caveat line.
  const caveat = `<div style="color:var(--gray-500);font-size:12px;margin-bottom:16px">
    Across ${s.qualifying_project_count} of ${s.total_complete_count} completed projects with full economics data.
    Converted to ${esc(s.base_currency)} using rates from Settings.
  </div>`;

  // FX-missing banner (same as Summary card).
  const missing = s.currencies_missing_fx || [];
  const banner = missing.length === 0 ? '' : `
    <div style="margin:0 0 16px;padding:8px 12px;background:var(--amber-50,#fffbeb);border-left:3px solid var(--amber-400,#fbbf24);color:var(--gray-700);font-size:12px">
      Excluded from total: ${missing.map(esc).join(', ')} —
      <a href="#settings" style="color:var(--brand-blue,#6EC1E4)">set rates in Settings</a>.
    </div>`;

  // Chart cards (heights from schema). Each chart only renders when its
  // backing breakdown is non-empty — _initEconomicsTabCharts skips empty data,
  // so without this gate users would see empty 320px-tall boxes with titles.
  const quarterly = (data.trends && Array.isArray(data.trends.quarterly)) ? data.trends.quarterly : [];
  const hasQuarterly = quarterly.length > 0;
  const hasPricing = Array.isArray(breakdowns.by_pricing_model) && breakdowns.by_pricing_model.length > 0;
  const hasPioneer = Array.isArray(breakdowns.by_pioneer) && breakdowns.by_pioneer.length > 0;
  const chartShouldRender = (id) => {
    if (id === 'economics_pricing_mix') return hasPricing;
    if (id === 'economics_pioneer_productivity') return hasPioneer;
    if (id.startsWith('economics_quarterly_')) return hasQuarterly;
    return true;
  };
  const chartCard = (c) => `
    <div class="chart-card" data-chart-id="${c.id}" data-testid="${c.id}">
      <div class="chart-card-title">${esc(c.title)}</div>
      <div class="chart-body" style="height:${c.height}px">
        <div id="${c.id}" style="width:100%;height:100%"></div>
      </div>
    </div>`;
  const chartGrid = tabCharts.filter(c => chartShouldRender(c.id)).map(chartCard).join('');

  return `<div data-testid="economics-tab-content">
    <h3 style="margin:0 0 8px;color:var(--navy)">Economics</h3>
    ${caveat}
    ${banner}
    ${renderEconomicsTilesGrid(s, tiles)}
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:16px;margin-top:24px">
      ${renderEconomicsBreakdownTable(breakdowns.by_practice, s.base_currency)}
      ${renderEconomicsCurrencyTiles(breakdowns.by_currency)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:16px;margin-top:16px">
      ${chartGrid}
    </div>
  </div>`;
}

function renderEconomicsCard(project, metrics) {
  if (!project) return '';
  const hasSignal = (
    project.engagement_revenue != null ||
    (project.pioneers || []).some(p => p.day_rate != null) ||
    metrics.legacy_rate_effective != null
  );
  if (!hasSignal) return '';

  const cur = project.currency || window._defaultCurrency || 'EUR';
  const fc = (v) => fmtCurrency(v, cur);

  const header = `
    <div class="econ-header" style="display:flex;gap:18px;flex-wrap:wrap;color:var(--gray-600);font-size:13px;margin-bottom:10px">
      <span><strong>Revenue:</strong> ${fc(project.engagement_revenue)}</span>
      <span><strong>Pricing:</strong> ${esc(project.xcsg_pricing_model || '—')}</span>
      <span><strong>Currency:</strong> ${esc(cur)}</span>
    </div>`;

  const chip = (toneFn, value, label, fmt) => `
    <div class="assessment-metric-chip ${toneFn(value)}">
      <span class="chip-value">${fmt(value)}</span>
      <span class="chip-label">${label}</span>
    </div>`;

  const grid = `
    <div class="metric-chips-grid" style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:8px">
      ${chip(ratioTone, metrics.margin_gain, 'Margin Gain', fmtRatioMaybe)}
      ${chip(() => '', metrics.xcsg_cost, 'xCSG cost', fc)}
      ${chip(() => '', metrics.legacy_cost, 'Legacy cost', fc)}
      ${chip(() => metrics.xcsg_margin != null && metrics.xcsg_margin < 0 ? 'chip-red' : '', metrics.xcsg_margin, 'xCSG margin', fc)}
      ${chip(pctTone, metrics.xcsg_margin_pct, 'xCSG margin %', fmtPctMaybe)}
      ${chip(ratioTone, metrics.cost_per_quality_point_gain, 'Cost/quality gain', fmtRatioMaybe)}
    </div>`;

  const footer = project.scope_expansion_revenue != null
    ? `<div style="margin-top:10px;color:var(--gray-600);font-size:13px"><strong>Scope-expansion revenue:</strong> ${fc(project.scope_expansion_revenue)}</div>`
    : '';

  // Phase 2c: contextual hint for missing legacy team mix.
  const hasRevenue = project.engagement_revenue != null;
  const hasLegacyTeam = (project.legacy_team || []).length > 0;
  const legacyHint = (!hasLegacyTeam && hasRevenue && metrics?.legacy_cost == null)
    ? `<div style="margin-top:10px;padding:8px;background:var(--amber-50,#fffbeb);border-left:3px solid var(--amber-400,#fbbf24);color:var(--gray-700);font-size:12px">
         <strong>Legacy cost not computed.</strong> Add a Legacy team mix on the project edit form to enable Margin Gain, Delivery Speed, and Cost / Quality comparisons.
       </div>`
    : '';

  return `
    <div class="economics-card" style="margin-top:16px;padding:16px;border:1px solid var(--gray-200);border-radius:8px;background:var(--gray-50)">
      <h3 style="margin:0 0 12px;color:var(--navy);font-size:15px">Economics</h3>
      ${header}
      ${grid}
      ${footer}
      ${legacyHint}
    </div>`;
}

function gaugeHTML(score, size) {
  const pct = Math.round(score * 100);
  const color = scoreColor(score);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score);
  return `<svg class="score-gauge" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="5"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
      transform="rotate(-90 ${size/2} ${size/2})"/>
    <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="central"
      font-size="${size > 50 ? 16 : 12}" font-weight="700" fill="${color}">${pct}</text>
  </svg>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   METRIC_DETAILS — single source of truth for methodology + side panel
   ═══════════════════════════════════════════════════════════════════════ */

// METRIC_DETAILS moved to frontend/metric-details.js (loaded before this script)
const METRIC_DETAILS = window.METRIC_DETAILS;

const SCALING_GATE_DETAILS = [
  { name: 'Multi-engagement', threshold: '\u22652 deliverable types completed', description: 'Proves xCSG works across different deliverable types, not just one niche.' },
  { name: 'Effort reduction', threshold: 'Avg delivery speed >1.3\u00D7', description: 'Average delivery speed ratio across all completed projects must exceed 1.3\u00D7.' },
  { name: 'Client-invisible quality', threshold: '\u22651 project with low revisions + no negative client pulse', description: 'At least one project with minimal rework and no negative client feedback.' },
  { name: 'Transferability', threshold: 'F2 productization \u226550% AND \u22652 pioneers across 2+ categories', description: 'Deliverables can be reused, and multiple people across categories can deliver.' },
  { name: 'Flywheel validation', threshold: 'Recent 5 avg Value Gain \u2265 first 5 (need 6+ projects)', description: 'The model is improving over time \u2014 recent projects outperform earlier ones.' },
  { name: 'Compounding', threshold: 'D2 knowledge reuse rate \u226540%', description: 'At least 40% of projects reuse prior knowledge assets, showing compounding returns.' },
  { name: 'Adoption confidence', threshold: 'G1 "Yes without hesitation" \u226570%', description: 'At least 70% of experts would choose xCSG again without hesitation.' },
];

/* ═══════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════ */

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

async function apiCall(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  if (res.status === 401) { handleLogout(); throw new Error('Session expired'); }
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) {
    // `detail` can be either a plain string or a structured object (e.g. the
    // completeness gate returns {message, missing_fields}). Prefer message for
    // the human-readable text but stash the whole object for callers that care.
    let msg;
    if (typeof json.detail === 'string') {
      msg = json.detail;
    } else if (json.detail && typeof json.detail === 'object') {
      msg = json.detail.message || `Error ${res.status}`;
    } else {
      msg = json.message || `Error ${res.status}`;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.detail = json.detail;
    throw err;
  }
  return json;
}

// Variant of apiCall that returns {status, body} so callers can distinguish
// 200 (matched existing) from 201 (created new). Mirrors apiCall's error
// shape for parity.
async function apiCallWithStatus(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  if (res.status === 401) { handleLogout(); throw new Error('Session expired'); }
  if (res.status === 204) return { status: 204, body: null };
  const json = await res.json();
  if (!res.ok) {
    let msg;
    if (typeof json.detail === 'string') {
      msg = json.detail;
    } else if (json.detail && typeof json.detail === 'object') {
      msg = json.detail.message || `Error ${res.status}`;
    } else {
      msg = json.message || `Error ${res.status}`;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.detail = json.detail;
    throw err;
  }
  return { status: res.status, body: json };
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

function showModal(html) {
  const overlay = document.getElementById('globalModal');
  const card = document.getElementById('globalModalCard');
  if (!overlay || !card) return;
  card.innerHTML = html;
  overlay.classList.add('active');
}

function hideModal() {
  const overlay = document.getElementById('globalModal');
  if (overlay) overlay.classList.remove('active');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => showToast('Copied to clipboard!'),
    () => showToast('Failed to copy', 'error')
  );
}

function formatDate(d) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '\u2014';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function round2(n) { return Math.round(n * 100) / 100; }
function canWrite() { return state.user && state.user.role !== 'viewer'; }
function isAdmin() { return state.user && state.user.role === 'admin'; }

// Schedule variance (actual - expected) helpers — shared across form, tables, and dashboard.
function scheduleDelta(dateExpected, dateActual) {
  if (!dateExpected || !dateActual) return null;
  const e = new Date(dateExpected), a = new Date(dateActual);
  if (isNaN(e) || isNaN(a)) return null;
  return Math.round((a - e) / 86400000);
}
function formatScheduleDelta(delta) {
  if (delta == null) return '';
  if (delta === 0) return 'On time';
  return delta > 0 ? `+${delta}d late` : `${Math.abs(delta)}d early`;
}
function scheduleDeltaBadgeClass(delta) {
  if (delta == null) return '';
  if (delta <= 0) return 'badge-green';
  if (delta <= 3) return 'badge-warning';
  return 'badge-orange';
}

function optionsHTML(arr, selected) {
  return '<option value="">\u2014 Select \u2014</option>' +
    arr.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

function categoryOptionsHTML(selected) {
  return '<option value="">\u2014 Select Category \u2014</option>' +
    state.categories.map(c => `<option value="${c.id}"${c.id == selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
}

async function loadCategories() {
  if (state.categories.length === 0 && state.token) {
    try { state.categories = await apiCall('GET', '/categories'); } catch { /* ignore */ }
  }
}

function practiceOptionsHTML(selected, categoryId) {
  // If a category is provided, restrict the dropdown to that category's allowed practices.
  // Otherwise (no category yet or category unknown), show an empty placeholder.
  let allowed = state.practices;
  if (categoryId != null && categoryId !== '') {
    const cat = state.categories.find(c => c.id == categoryId);
    if (cat && Array.isArray(cat.practices)) {
      const allowedIds = new Set(cat.practices.map(p => p.id));
      allowed = state.practices.filter(p => allowedIds.has(p.id));
    } else {
      allowed = [];
    }
  } else {
    allowed = [];
  }
  if (allowed.length === 0) {
    return '<option value="">— Pick a category first —</option>';
  }
  if (allowed.length === 1) {
    const p = allowed[0];
    return `<option value="${p.id}" selected>${esc(p.code)}</option>`;
  }
  return '<option value="">— Select Practice —</option>' +
    allowed.map(p => `<option value="${p.id}"${p.id == selected ? ' selected' : ''}>${esc(p.code)}</option>`).join('');
}

async function loadPractices() {
  if (state.practices.length === 0 && state.token) {
    try { state.practices = await apiCall('GET', '/practices'); } catch { /* ignore */ }
  }
}

async function loadPracticeRoles(practiceId) {
  try {
    return await apiCall('GET', `/practices/${practiceId}/roles`);
  } catch (e) {
    return [];
  }
}

async function loadProjectPracticeRoles(practiceId, currency) {
  if (!practiceId || !currency) return [];
  try {
    const all = await apiCall('GET', `/practices/${practiceId}/roles`);
    return all.filter(r => r.currency === currency);
  } catch (e) {
    return [];
  }
}

async function loadAllPioneers() {
  try {
    const list = await apiCall('GET', '/pioneers');
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function loadTaxonomy() {
  await Promise.all([loadCategories(), loadPractices()]);
}

/* ═══════════════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════════════ */

function handleLogout() {
  state.token = null;
  state.user = null;
  state.categories = [];
  state.practices = [];
  _dashboardCache = null;
  _projectsCache = null;
  _economicsCache = null;
  _takeawaysCache = {};
  sessionStorage.removeItem('xcsg_token');
  showScreen('login');
}

function showScreen(screen) {
  document.getElementById('loginScreen').style.display = screen === 'login' ? 'flex' : 'none';
  document.getElementById('appShell').style.display = screen === 'app' ? 'flex' : 'none';
  document.getElementById('expertView').style.display = screen === 'expert' ? 'flex' : 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in\u2026';
  try {
    const data = await apiCall('POST', '/auth/login', { username, password });
    state.token = data.access_token;
    state.user = data.user;
    sessionStorage.setItem('xcsg_token', data.access_token);
    document.getElementById('topbarUsername').textContent = data.user.name || data.user.username;
    document.getElementById('topbarAvatar').textContent = (data.user.name || data.user.username)[0].toUpperCase();
    showScreen('app');
    window.location.hash = '#portfolio';
  } catch (err) {
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTING
   ═══════════════════════════════════════════════════════════════════════ */

let _routeCounter = 0;

async function route() {
  const thisRoute = ++_routeCounter;
  const hash = window.location.hash || '#portfolio';

  // Dispose any charts left over from the previous route (pioneer detail,
  // dashboard, norms, etc.) so we don't leak ECharts instances or
  // ResizeObservers when navigating away.
  if (typeof disposeAllCharts === 'function') disposeAllCharts();

  if (hash.startsWith('#expert/') || hash.startsWith('#assess/')) {
    const token = hash.slice(hash.indexOf('/') + 1);
    showScreen('expert');
    renderExpert(token);
    return;
  }

  if (!state.token) { showScreen('login'); return; }
  showScreen('app');

  await Promise.all([loadTaxonomy(), loadSchema(), loadSettings()]);
  if (thisRoute !== _routeCounter) return; // stale route — newer navigation happened

  // Hide write-only UI for viewers
  const navNew = document.getElementById('navNew');
  if (navNew) navNew.style.display = canWrite() ? '' : 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const routeName = hash.slice(1).split('/')[0];
  const navEl = document.querySelector(`.nav-item[data-route="${routeName}"]`);
  if (navEl) navEl.classList.add('active');

  // Show/hide monitoring nav for admin/analyst
  const navMonitoring = document.getElementById('navMonitoring');
  if (navMonitoring) navMonitoring.style.display = (isAdmin() || (state.user && state.user.role === 'analyst')) ? '' : 'none';

  const titles = {
    portfolio: 'Portfolio', new: 'New Project', edit: 'Edit Project',
    projects: 'Projects', pioneers: 'Pioneers', pioneer: 'Pioneer',
    settings: 'Settings', norms: 'Norms', activity: 'Activity Log',
    monitoring: 'Monitoring', methodology: 'How Scores Work', notes: 'Notes'
  };
  document.getElementById('topbarTitle').textContent = titles[routeName] || 'Portfolio';

  const mc = document.getElementById('mainContent');
  if (mc) { mc.classList.remove('view-fade-in'); void mc.offsetWidth; mc.classList.add('view-fade-in'); }

  if (hash === '#portfolio') renderPortfolio();
  else if (hash === '#new') { if (canWrite()) renderNewProject(); else { document.getElementById('mainContent').innerHTML = '<div class="error-state">You do not have permission to create projects.</div>'; } }
  else if (hash.startsWith('#project/')) renderProjectDetail(hash.split('/')[1]);
  else if (hash.startsWith('#edit/')) renderEditProject(hash.split('/')[1]);
  else if (hash === '#projects') renderProjects();
  else if (hash === '#pioneers') renderPioneersIndex();
  else if (hash.startsWith('#pioneer/')) { const id = parseInt(hash.split('/')[1]); if (id) renderPioneerDetail(id); }
  else if (hash === '#monitoring') renderMonitoring();
  else if (hash === '#settings') renderSettings();
  else if (hash === '#norms') renderNormsPage();
  else if (hash === '#activity') renderActivity();
  else if (hash === '#notes') renderNotes();
  else if (hash === '#methodology') renderMethodology();
  else renderPortfolio();
}

/* ═══════════════════════════════════════════════════════════════════════
   PORTFOLIO (Dashboard)
   ═══════════════════════════════════════════════════════════════════════ */

const CHECKPOINTS = [
  { id: 1, name: 'First Light', threshold: 1, icon: '\uD83C\uDF05', desc: 'Individual project scorecard — effort ratio, quality score, productivity, and flywheel leg scores.' },
  { id: 2, name: 'Pattern Detection', threshold: 3, icon: '\uD83D\uDCCA', desc: 'Trend lines, category comparison charts, and effort comparison bars.' },
  { id: 3, name: 'Proof of Concept', threshold: 8, icon: '\uD83D\uDD2C', desc: 'Flywheel leg scores, scatter plots, and deeper performance analytics.' },
  { id: 4, name: 'At Scale', threshold: 20, icon: '\uD83D\uDE80', desc: 'Full dashboard with disprove matrix, scaling gates, and per-category breakdowns.' },
];

function toggleCheckpointCard(cpId) {
  const card = document.querySelector(`.checkpoint-card[data-cp="${cpId}"]`);
  if (card) card.classList.toggle('collapsed');
}

// Cache dashboard data for filtering
let _dashboardCache = null;
let _projectsCache = null;
let _takeawaysCache = {};
let _economicsCache = null;

function _avg(arr) {
  const vals = arr.filter(v => v != null);
  return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function _computeLocalMetrics(projects) {
  // Match the server's /api/dashboard/metrics behaviour — include both 'complete'
  // and 'partial' projects (metrics are valid with ≥1 submitted response).
  const withMetrics = projects.filter(p => p.metrics && (p.status === 'complete' || p.status === 'partial'));
  const m = withMetrics.map(p => p.metrics);
  return {
    total_projects: projects.length,
    complete_projects: withMetrics.length,
    average_effort_ratio: _avg(m.map(x => x.delivery_speed)),
    average_quality_ratio: _avg(m.map(x => x.output_quality)),
    average_advantage: _avg(m.map(x => x.productivity_ratio)),
    average_outcome_rate_ratio: _avg(m.map(x => x.productivity_ratio)),
    machine_first_avg: _avg(m.map(x => x.machine_first_score)),
    senior_led_avg: _avg(m.map(x => x.senior_led_score)),
    proprietary_knowledge_avg: _avg(m.map(x => x.proprietary_knowledge_score)),
    rework_efficiency_avg: _avg(m.map(x => x.rework_efficiency)),
    client_impact_avg: _avg(m.map(x => x.client_impact)),
    data_independence_avg: _avg(m.map(x => x.data_independence)),
    reuse_intent_avg: _avg(m.map(x => x.reuse_intent_score)),
    ai_survival_avg: _avg(m.map(x => x.ai_survival_rate)),
    client_pulse_avg: _avg(m.map(x => x.client_pulse_score)),
  };
}

// filterState.pioneers stores pioneer_id integers. This returns them as a plain
// array for query-string building. Names can collide and renames silently
// orphan filter entries, so IDs are the canonical key.
function _getSelectedPioneerIds() {
  return [...filterState.pioneers];
}

// Builds the query-string suffix for dashboard API calls, appending any selected pioneer_id values.
function _buildDashboardQS() {
  const ids = _getSelectedPioneerIds();
  if (!ids.length) return '';
  return '?' + ids.map(id => `pioneer_id=${encodeURIComponent(id)}`).join('&');
}

async function loadEconomicsData() {
  const qs = _buildDashboardQS();
  return await apiCall('GET', `/dashboard/economics${qs}`);
}

async function loadPioneerEconomics(pioneerId) {
  return await apiCall('GET', '/dashboard/economics?pioneer_id=' + encodeURIComponent(pioneerId));
}

async function renderPortfolio() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading portfolio\u2026</div>';
  const myRoute = _routeCounter;

  // Ensure pioneer list is available for filter wiring and query-string building.
  if (!window._allPioneers || window._allPioneers.length === 0) {
    window._allPioneers = await loadAllPioneers();
  }

  try {
    const qs = _buildDashboardQS();
    const [dashboard, allProjects, takeaways, economics] = await Promise.all([
      apiCall('GET', `/dashboard/metrics${qs}`),
      apiCall('GET', '/projects'),
      apiCall('GET', `/dashboard/takeaways${qs}`).catch(() => ({})),
      loadEconomicsData().catch(err => { console.warn('economics load failed', err); return null; }),
    ]);
    if (myRoute !== _routeCounter) return; // stale — user navigated away

    _dashboardCache = dashboard;
    _projectsCache = allProjects;
    _takeawaysCache = takeaways || {};
    _economicsCache = economics;

    if (!allProjects.length) {
      mc.innerHTML = `<div class="empty-state"><h2>Welcome to the xCSG Value Tracker</h2><p>Start by creating your first project to begin measuring xCSG performance.</p>${canWrite() ? '<a href="#new" class="btn btn-primary" style="margin-top:16px">Create First Project</a>' : ''}</div>`;
      return;
    }

    _renderDashboardView(allProjects, dashboard);
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load portfolio: ${esc(err.message)}</div>`;
  }
}


// ── Filter engine ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = () => ({
  practices: new Set(), categories: new Set(), pioneers: new Set(), projects: new Set(),
  delivered_from: null, delivered_to: null,
});

let filterState = _loadFilters();

function _loadFilters() {
  try {
    const raw = localStorage.getItem(DASHBOARD.filterStorageKey);
    if (!raw) return DEFAULT_FILTERS();
    const j = JSON.parse(raw);
    // pioneers is a Set<number> (pioneer_id). Old persisted state may carry
    // strings (names) — they get pruned in renderFilterBar() against the
    // current pioneer list before any query runs.
    return {
      practices:  new Set(j.practices  || []),
      categories: new Set(j.categories || []),
      pioneers:   new Set((j.pioneers  || []).map(v => typeof v === 'number' ? v : Number(v)).filter(v => Number.isFinite(v))),
      projects:   new Set((j.projects  || []).map(Number)),
      delivered_from: j.delivered_from || null,
      delivered_to:   j.delivered_to   || null,
    };
  } catch (_) { return DEFAULT_FILTERS(); }
}

function _saveFilters() {
  localStorage.setItem(DASHBOARD.filterStorageKey, JSON.stringify({
    practices:  [...filterState.practices],
    categories: [...filterState.categories],
    pioneers:   [...filterState.pioneers],
    projects:   [...filterState.projects],
    delivered_from: filterState.delivered_from,
    delivered_to:   filterState.delivered_to,
  }));
}

function clearFilters() {
  filterState = DEFAULT_FILTERS();
  _saveFilters();
}

function applyFilters(allProjects, state) {
  state = state || filterState;
  return allProjects.filter(p => {
    if (state.practices.size   && !state.practices.has(p.practice_code || '—')) return false;
    if (state.categories.size  && !state.categories.has(p.category_name || '—')) return false;
    if (state.pioneers.size) {
      const ids = (p.pioneers || []).map(pi => pi.pioneer_id).filter(v => v != null);
      const any = ids.some(id => state.pioneers.has(id));
      if (!any) return false;
    }
    if (state.projects.size    && !state.projects.has(p.id)) return false;
    const d = p.date_delivered;
    if (state.delivered_from && (!d || d < state.delivered_from)) return false;
    if (state.delivered_to   && (!d || d > state.delivered_to))   return false;
    return true;
  });
}

function uniq(xs) { return [...new Set(xs)]; }

function renderFilterBar(allProjects) {
  const el = document.getElementById('filterBar');
  if (!el) return;

  const practices  = uniq(allProjects.map(p => p.practice_code || '—')).sort();
  const categories = uniq(allProjects.map(p => p.category_name || '—')).sort();
  // Pioneers come as {id, name} pairs. The canonical pioneer list (used to
  // resolve IDs in the popover and chip summary) is window._allPioneers; if
  // unavailable, we synthesize from project rows.
  const pioneerById = new Map();
  for (const pi of (window._allPioneers || [])) pioneerById.set(pi.id, pi.display_name || pi.name || '');
  for (const proj of allProjects) {
    for (const pi of (proj.pioneers || [])) {
      if (pi.pioneer_id != null && !pioneerById.has(pi.pioneer_id)) {
        pioneerById.set(pi.pioneer_id, pi.display_name || pi.pioneer_name || pi.name || '');
      }
    }
  }
  const pioneers = [...pioneerById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Prune any persisted filter values that reference taxonomy/projects/pioneers
  // which no longer exist. Without this, a deleted entry silently filters out
  // all projects and the user sees a blank dashboard.
  let pruned = false;
  for (const v of [...filterState.practices])  if (!practices.includes(v))   { filterState.practices.delete(v);  pruned = true; }
  for (const v of [...filterState.categories]) if (!categories.includes(v))  { filterState.categories.delete(v); pruned = true; }
  for (const id of [...filterState.pioneers])  if (!pioneerById.has(id))     { filterState.pioneers.delete(id);  pruned = true; }
  const validIds = new Set(allProjects.map(p => p.id));
  for (const id of [...filterState.projects])  if (!validIds.has(id))        { filterState.projects.delete(id);  pruned = true; }
  if (pruned) _saveFilters();

  const summary = (setRef, total) =>
    !setRef.size ? 'All' : setRef.size === 1 ? [...setRef][0] : `${setRef.size} of ${total}`;
  // Pioneer chip summary needs id→name resolution.
  const pioneerSummary = () => {
    if (!filterState.pioneers.size) return 'All';
    if (filterState.pioneers.size === 1) {
      const [id] = filterState.pioneers;
      return pioneerById.get(id) || `#${id}`;
    }
    return `${filterState.pioneers.size} of ${pioneers.length}`;
  };

  const btn = (key, label, sum) =>
    `<button class="filter-chip ${sum === 'All' ? '' : 'active'}" data-filter="${key}">${label}: ${esc(sum)} ▾</button>`;

  el.className = 'filter-bar';
  el.innerHTML =
      btn('practices',  'Practice',  summary(filterState.practices,  practices.length))
    + btn('categories', 'Category',  summary(filterState.categories, categories.length))
    + btn('pioneers',   'Pioneer',   pioneerSummary())
    + btn('projects',   'Projects',  filterState.projects.size ? `${filterState.projects.size} of ${allProjects.length}` : 'All')
    + btn('delivered',  'Delivered', (filterState.delivered_from || filterState.delivered_to) ? `${filterState.delivered_from || '…'} → ${filterState.delivered_to || '…'}` : 'all time')
    + `<button class="filter-chip" data-filter="clear">Clear</button>`;

  el.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () =>
    _openFilterPopover(b.dataset.filter, b, { practices, categories, pioneers, allProjects })));
}

function _openFilterPopover(key, anchor, lists) {
  document.querySelectorAll('.filter-popover').forEach(p => p.remove());
  if (key === 'clear') { clearFilters(); _reapplyFilters(); return; }

  const pop = document.createElement('div');
  pop.className = 'filter-popover';
  const r = anchor.getBoundingClientRect();
  pop.style.top  = (window.scrollY + r.bottom + 6) + 'px';
  pop.style.left = (window.scrollX + r.left)      + 'px';

  const renderMulti = (setRef, options) => options.map(opt =>
    `<label><input type="checkbox" value="${esc(opt)}" ${setRef.has(opt) ? 'checked' : ''}> ${esc(opt)}</label>`
  ).join('');

  if (key === 'practices')  pop.innerHTML = renderMulti(filterState.practices,  lists.practices);
  if (key === 'categories') pop.innerHTML = renderMulti(filterState.categories, lists.categories);
  if (key === 'pioneers')   pop.innerHTML = lists.pioneers.map(pi =>
    `<label><input type="checkbox" data-id="${pi.id}" ${filterState.pioneers.has(pi.id) ? 'checked' : ''}> ${esc(pi.name || '')}</label>`
  ).join('');
  if (key === 'projects')   pop.innerHTML = lists.allProjects.map(p =>
    `<label><input type="checkbox" data-id="${p.id}" ${!filterState.projects.size || filterState.projects.has(p.id) ? 'checked' : ''}> ${esc(p.project_name)}</label>`
  ).join('');
  if (key === 'delivered')  pop.innerHTML =
      `<label>From <input type="date" id="fFrom" value="${filterState.delivered_from || ''}"></label>`
    + `<label>To <input type="date" id="fTo"   value="${filterState.delivered_to   || ''}"></label>`;

  document.body.appendChild(pop);

  pop.addEventListener('change', e => {
    if (key === 'practices' || key === 'categories') {
      const set = filterState[key];
      if (e.target.checked) set.add(e.target.value); else set.delete(e.target.value);
    } else if (key === 'pioneers') {
      const id = Number(e.target.dataset.id);
      if (!Number.isFinite(id)) return;
      if (e.target.checked) filterState.pioneers.add(id); else filterState.pioneers.delete(id);
    } else if (key === 'projects') {
      const id = Number(e.target.dataset.id);
      if (e.target.checked) filterState.projects.add(id); else filterState.projects.delete(id);
      // If every project is ticked, collapse to "All" by clearing the set
      if (filterState.projects.size === lists.allProjects.length) filterState.projects.clear();
    } else if (key === 'delivered') {
      filterState.delivered_from = document.getElementById('fFrom').value || null;
      filterState.delivered_to   = document.getElementById('fTo').value   || null;
    }
    _reapplyFilters();
  });

  setTimeout(() => document.addEventListener('click', function close(e) {
    if (!pop.contains(e.target) && e.target !== anchor) {
      pop.remove();
      document.removeEventListener('click', close);
    }
  }), 0);
}

let _activeTab = 'overview';

function renderTabShell(mountEl) {
  const tabs = schema.dashboard.tabs;
  const charts = schema.dashboard.charts;
  mountEl.insertAdjacentHTML('beforeend',
    `<div class="tab-bar">${tabs.map(t =>
      `<div class="tab ${t.id === _activeTab ? 'active' : ''}" data-tab="${t.id}">${t.icon} ${esc(t.label)}</div>`
    ).join('')}</div>`
  );
  for (const t of tabs) {
    const tabCharts = charts.filter(c => c.tab === t.id);
    const body = tabCharts.map(c => {
      const takeaway = _takeawaysCache[c.id];
      return `
      <div class="chart-card" data-chart-id="${c.id}">
        <div class="chart-card-title">${esc(c.title)}</div>
        ${takeaway ? `<div class="chart-card-takeaway">${esc(takeaway)}</div>` : ''}
        <div class="chart-card-explain">${esc(c.subtitle || '')}</div>
        <div class="chart-body" ${c.height ? `style="height:${c.height}px"` : ''}>
          <div id="${c.id}" style="width:100%;height:100%"></div>
        </div>
      </div>`;
    }).join('');
    mountEl.insertAdjacentHTML('beforeend',
      `<div class="tab-panel ${t.id === _activeTab ? 'active' : ''}" data-panel="${t.id}">${body}</div>`);
  }
  mountEl.querySelectorAll('.tab-bar .tab').forEach(el =>
    el.addEventListener('click', () => _selectTab(el.dataset.tab, mountEl))
  );
}

function _selectTab(id, mountEl) {
  _activeTab = id;
  mountEl.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === id));
  mountEl.querySelectorAll('.tab-panel').forEach(el => el.classList.toggle('active', el.dataset.panel === id));
  // Rebuild charts in the now-visible tab so ECharts picks up correct container sizes.
  // disposeAllCharts() inside renderDashboardCharts also wipes our economics charts,
  // so re-init them when returning to Overview or Economics.
  renderDashboardCharts(_dashboardCache, applyFilters(_projectsCache));
  if (_economicsCache) {
    if (id === 'overview') _initEconomicsCharts(_economicsCache);
    if (id === 'economics') _initEconomicsTabCharts(_economicsCache);
  }
}

function _renderDashboardView(allProjects, dashboard) {
  const mc = document.getElementById('mainContent');

  const filtered = applyFilters(allProjects);
  const localMetrics = filtered.length === allProjects.length ? dashboard : _computeLocalMetrics(filtered);

  const fmtRatio = value => value == null ? '\u2014' : `${round2(value)}\xd7`;
  const fmtPct = value => value == null ? '\u2014' : `${Math.round(value * 100)}%`;
  let html = '';

  // ── HERO SECTION ──
  const advantage = localMetrics.average_advantage || localMetrics.average_outcome_rate_ratio;
  html += `<div class="hero-section">
    <div class="hero-left">
      <div class="hero-label">Portfolio Overview</div>
      <div class="hero-title">All Categories</div>
      <div class="hero-meta">${localMetrics.complete_projects || 0} completed of ${allProjects.length} total</div>
    </div>
    <div class="hero-right">
      <div class="hero-big-number" style="color:${metricTone(advantage)}">${fmtRatio(advantage)}</div>
      <div class="hero-big-label">xCSG Value Gain</div>
      <div class="hero-explain">Quality per person-day: xCSG vs legacy. &gt;1\xd7 = more value per effort.</div>
    </div>
  </div>`;

  // ── FILTER BAR (populated by Task 11) ──
  html += `<div id="filterBar"></div>`;

  // ── KPI GRID (driven by schema.dashboard.kpi_tiles + schema.metrics) ──
  // On-Time Delivery is the only synthetic tile — compute value + sub-label from
  // the currently filtered project list so it reacts to the category slicer.
  const schedTracked = filtered.filter(p => scheduleDelta(p.date_expected_delivered, p.date_delivered) !== null);
  const schedDeltas = schedTracked.map(p => scheduleDelta(p.date_expected_delivered, p.date_delivered));
  const onTimeCount = schedDeltas.filter(d => d <= 0).length;
  const onTimePct = schedTracked.length ? Math.round((onTimeCount / schedTracked.length) * 100) : null;
  const avgDelta = schedTracked.length ? (schedDeltas.reduce((a, b) => a + b, 0) / schedTracked.length) : null;
  const onTimeTip = schedTracked.length
    ? `${onTimeCount}/${schedTracked.length} delivered on or before expected date`
    : 'No projects with both expected and actual delivery dates yet.';
  const avgDeltaLabel = avgDelta == null ? '' : (avgDelta === 0 ? 'avg on time' : (avgDelta > 0 ? `avg +${round2(avgDelta)}d late` : `avg ${round2(Math.abs(avgDelta))}d early`));

  const tileDefs = schema.dashboard.kpi_tiles.map(t => {
    const meta = t.synthetic ? t : (schema.metrics[t.metric_key] || {});
    return {
      label: meta.label || t.metric_key,
      icon: meta.icon || '',
      tip: meta.tip || '',
      format: meta.format || 'ratio',
      serverKey: t.server_key || t.metric_key,
      synthetic: !!t.synthetic,
      metricKey: t.metric_key,
    };
  });

  html += `<div class="metrics-grid">`;
  for (const def of tileDefs) {
    let value, fmt, tip;
    if (def.synthetic && def.metricKey === 'on_time_delivery_pct') {
      // onTimePct is already 0-100; divide by 100 so fmtPct renders it correctly.
      value = onTimePct == null ? null : onTimePct / 100;
      fmt = fmtPct;
      tip = onTimeTip;
    } else {
      value = localMetrics[def.serverKey];
      fmt = def.format === 'pct' ? fmtPct : fmtRatio;
      tip = def.tip;
    }
    const extraClass = def.synthetic
      ? ' metric-tile-schedule'
      : (def.format === 'pct' ? ' metric-tile-signal' : '');
    const subHtml = (def.synthetic && def.metricKey === 'on_time_delivery_pct' && avgDeltaLabel)
      ? `<div class="metric-tile-sub" style="font-size:11px;color:var(--gray-500);margin-top:4px">${esc(avgDeltaLabel)}</div>`
      : '';
    html += `<div class="metric-tile${extraClass}" title="${esc(tip)}">
      <div class="metric-tile-icon">${def.icon}</div>
      <div class="metric-tile-value" style="color:${metricTone(value, def.format === 'pct' ? 'pct_tone' : 'metric_tone')}">${fmt(value)}</div>
      <div class="metric-tile-label">${esc(def.label)} ${infoIcon(def.metricKey)}</div>
      ${subHtml}
    </div>`;
  }
  html += `</div>`;

  // ── CHART SECTIONS (rendered via tab shell, Task 13) ──
  // Scaling Gates and Portfolio Table are now rendered as chart types inside
  // the tab shell (track_scaling_gates + table_portfolio — see registry).
  html += `<div id="tabContainer"></div>`;

  mc.innerHTML = html;
  renderFilterBar(allProjects);
  renderTabShell(document.getElementById('tabContainer'));

  // Inject Economics surfaces (PR2 Summary card on Overview + PR3 deep view on Economics tab).
  if (_economicsCache) {
    const overviewPanel = document.querySelector('#tabContainer .tab-panel[data-panel="overview"]');
    if (overviewPanel) {
      overviewPanel.insertAdjacentHTML('beforeend', renderEconomicsSummaryCard(_economicsCache));
    }
    const economicsPanel = document.querySelector('#tabContainer .tab-panel[data-panel="economics"]');
    if (economicsPanel) {
      economicsPanel.insertAdjacentHTML('beforeend', renderEconomicsTab(_economicsCache));
    }
  }

  requestAnimationFrame(() => {
    renderDashboardCharts(localMetrics, filtered);
    if (_economicsCache) {
      if (_activeTab === 'overview') _initEconomicsCharts(_economicsCache);
      if (_activeTab === 'economics') _initEconomicsTabCharts(_economicsCache);
    }
  });
}

function _reapplyFilters() {
  if (!_projectsCache || !_dashboardCache) return;
  _saveFilters();
  // When a pioneer filter is active, re-fetch server-side aggregates so KPI tiles
  // and chart data reflect the pioneer-scoped dataset returned by the backend.
  if (filterState.pioneers.size) {
    renderPortfolio();
  } else {
    // Non-pioneer filters (practice/category/date) only narrow the client-side
    // visualizations today. /api/dashboard/economics doesn't yet accept those
    // filters, so the cached _economicsCache is still correct — no re-fetch needed.
    _renderDashboardView(_projectsCache, _dashboardCache);
  }
}

function barHTML(score, label) {
  const pct = Math.round(score * 100);
  const color = scoreColor(score);
  return `<div class="assessment-bar">
    <div class="assessment-bar-track"><div class="assessment-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="assessment-bar-label" style="color:${color}">${label || pct + '%'}</span>
  </div>`;
}

function renderExpertAssessment(er, metrics, project) {
  const sectionScores = {};
  for (const sec of getAssessmentFields()) {
    let sum = 0, count = 0;
    for (const f of sec.fields) {
      const val = er[f.key];
      const s = f.scores[val];
      if (s !== undefined) { sum += s; count++; }
    }
    sectionScores[sec.section] = count > 0 ? sum / count : null;
  }

  const coreScores = [sectionScores.B, sectionScores.C, sectionScores.D].filter(s => s !== null);
  const overall = coreScores.length > 0 ? coreScores.reduce((a, b) => a + b, 0) / coreScores.length : null;

  const fmtScore = (v) => v == null ? '\u2014' : round2(v);
  const fmtRatio = (v) => v == null ? '\u2014' : `${round2(v)}x`;

  let html = `<div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
    <span>Expert Assessment</span>
    <span class="badge badge-green" style="font-size:11px">Submitted</span>
  </div><div class="card-body">`;

  html += `<div class="assessment-overall-banner">
    <div class="assessment-overall-left">
      ${overall !== null ? gaugeHTML(overall, 72) : '<div class="score-gauge" style="width:72px;height:72px"><div class="score-na">N/A</div></div>'}
      <div>
        <div class="assessment-overall-title" title="Average of Machine-First (B), Senior-Led (C), and Proprietary Knowledge (D) section scores.">xCSG Score</div>
        <div class="assessment-overall-subtitle">${overall !== null ? Math.round(overall * 100) + '/100' : 'Insufficient data'}</div>
        <div class="assessment-overall-hint">Average of Machine-First, Senior-Led, and Knowledge Moat</div>
      </div>
    </div>
    <div class="assessment-overall-metrics">
      <div class="assessment-metric-chip ${metrics.effort_ratio >= 2 ? 'chip-green' : metrics.effort_ratio >= 1 ? 'chip-amber' : 'chip-red'}" title="Legacy person-days \xf7 xCSG person-days. >1x means xCSG delivered faster.">
        <span class="chip-value">${fmtRatio(metrics.effort_ratio)}</span><span class="chip-label">Effort Ratio ${infoIcon('delivery_speed')}</span></div>
      <div class="assessment-metric-chip ${metrics.quality_score >= 0.7 ? 'chip-green' : metrics.quality_score >= 0.4 ? 'chip-amber' : 'chip-red'}" title="Average of self-assessment, analytical depth, and decision readiness (0-1 scale).">
        <span class="chip-value">${fmtScore(metrics.quality_score)}</span><span class="chip-label">Quality Score ${infoIcon('output_quality')}</span></div>
      <div class="assessment-metric-chip ${metrics.outcome_rate_ratio >= 2 ? 'chip-green' : metrics.outcome_rate_ratio >= 1 ? 'chip-amber' : 'chip-red'}" title="Quality per person-day: xCSG vs legacy. Higher = more value per unit of effort.">
        <span class="chip-value">${fmtRatio(metrics.outcome_rate_ratio)}</span><span class="chip-label">xCSG Value Gain ${infoIcon('productivity_ratio')}</span></div>
    </div>
  </div>`;

  html += renderEconomicsCard(project, metrics);

  for (const sec of getAssessmentFields()) {
    const secScore = sectionScores[sec.section];
    html += `<div class="assessment-section-card">
      <div class="assessment-section-header">
        <div class="assessment-section-title-row">
          <span class="assessment-section-icon">${sec.icon}</span>
          <div><div class="assessment-section-label">Section ${sec.section}: ${esc(sec.title)}</div><div class="assessment-section-desc">${esc(sec.desc)}</div></div>
        </div>
        ${secScore !== null ? gaugeHTML(secScore, 44) : ''}
      </div>
      <div class="assessment-fields">`;
    for (const f of sec.fields) {
      const val = er[f.key] || '\u2014';
      const score = f.scores[val];
      html += `<div class="assessment-field">
        <div class="assessment-field-top">
          <span class="assessment-field-id">${f.id}</span>
          <span class="assessment-field-label">${esc(f.label)}</span>
        </div>
        <div class="assessment-field-answer">
          <span class="assessment-field-value">${esc(val)}</span>
          ${score !== undefined ? barHTML(score) : ''}
        </div>
      </div>`;
    }
    html += `</div></div>`;
  }

  // Show legacy estimates if available — pull all L-fields from schema
  const legacyFields = schema && schema.fields
    ? Object.entries(schema.fields)
        .filter(([k, f]) => f.section === 'L')
        .map(([key, f]) => ({ key, label: f.label }))
    : [
        { key: 'l1_legacy_working_days', label: 'Legacy Working Days' },
        { key: 'l3_legacy_revision_depth', label: 'Legacy Revision Depth' },
        { key: 'l4_legacy_scope_expansion', label: 'Legacy Scope Expansion' },
        { key: 'l5_legacy_client_reaction', label: 'Legacy Client Reaction' },
      ];
  const hasLegacy = legacyFields.some(f => er[f.key] != null);
  if (hasLegacy) {
    html += `<div class="assessment-section-card">
      <div class="assessment-section-header">
        <div class="assessment-section-title-row">
          <span class="assessment-section-icon">\uD83D\uDCDD</span>
          <div><div class="assessment-section-label">Section L: Legacy Estimates</div><div class="assessment-section-desc">Expert\u2019s estimate of traditional delivery performance</div></div>
        </div>
      </div>
      <div class="assessment-fields">`;
    for (const f of legacyFields) {
      const val = er[f.key];
      if (val == null) continue;
      html += `<div class="assessment-field">
        <div class="assessment-field-top"><span class="assessment-field-label">${esc(f.label)}</span></div>
        <div class="assessment-field-answer"><span class="assessment-field-value">${esc(val)}</span></div>
      </div>`;
    }
    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════
   NEW / EDIT PROJECT FORM
   ═══════════════════════════════════════════════════════════════════════ */

function parseOptionalNumber(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function toggleEconomics() {
  const body = document.getElementById('economicsBody');
  const tog = document.getElementById('econToggle');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (tog) tog.textContent = open ? '▸' : '▾';
}

function onCurrencyChange() {
  const sel = document.getElementById('fCurrency');
  if (!sel) return;
  const newCur = sel.value;
  const hasValues = (
    document.getElementById('fRevenue')?.value ||
    document.getElementById('fScopeRev')?.value ||
    Array.from(document.querySelectorAll('.pioneer-day-rate')).some(i => i.value)
  );
  if (hasValues) {
    if (!confirm('Existing values will not be converted — they will be reinterpreted in the new currency. Continue?')) {
      sel.value = sel.dataset.previous || sel.value;
      return;
    }
  }
  sel.dataset.previous = newCur;
  const formScope = sel.closest('form, fieldset, .form-shell, [data-scope="project-form"]') || document.body;
  formScope.querySelectorAll('[data-suffix]').forEach(el => {
    const txt = el.textContent;
    el.textContent = txt.includes('/day') ? `${newCur}/day` : newCur;
  });
  refreshPioneerRoleSelects();
  refreshLegacyTeamRolePickers();
}

function renderPioneerRoleSelect(currentRoleName, availableRoles) {
  const opts = ['<option value="">—</option>'];
  let foundCurrent = false;
  availableRoles.forEach(r => {
    const selected = r.role_name === currentRoleName ? 'selected' : '';
    if (selected) foundCurrent = true;
    const ratePart = r.day_rate != null ? ` — ${r.day_rate}` : '';
    opts.push(`<option value="${esc(r.role_name)}" data-rate="${r.day_rate}" ${selected}>${esc(r.role_name)}${esc(ratePart)}</option>`);
  });
  if (currentRoleName && !foundCurrent) {
    opts.push(`<option value="${esc(currentRoleName)}" selected>${esc(currentRoleName)} (not in catalog)</option>`);
  }
  return `<select class="pioneer-role">${opts.join('')}</select>`;
}

function wirePioneerRoleSelectEvents(rowEl) {
  const sel = rowEl.querySelector('.pioneer-role');
  const rateInput = rowEl.querySelector('.pioneer-day-rate');
  if (!sel || !rateInput) return;
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex];
    if (!opt) return;
    const rate = opt.dataset.rate;
    if (rate != null && rate !== '' && rate !== 'undefined') {
      rateInput.value = parseFloat(rate);
    }
    // Picking "—" (empty) intentionally does NOT clear the rate — leave existing value.
  });
}

function renderPioneerPickerSelect(currentPioneerId, pioneers) {
  const opts = ['<option value="">—</option>'];
  let foundCurrent = false;
  (pioneers || []).forEach(p => {
    const sel = (currentPioneerId != null && p.id === currentPioneerId) ? 'selected' : '';
    if (sel) foundCurrent = true;
    const emailPart = p.email ? ` (${p.email})` : '';
    // Use server-supplied display_name; fall back to legacy `name` for safety.
    const label = p.display_name || p.name || '';
    opts.push(`<option value="${p.id}" ${sel}>${esc(label)}${esc(emailPart)}</option>`);
  });
  opts.push('<option value="__new__">+ New pioneer…</option>');
  return `<select class="pioneer-picker">${opts.join('')}</select>`;
}

function renderInlinePioneerCreate(rowEl) {
  const sel = rowEl.querySelector('.pioneer-picker');
  if (!sel) return;
  const wrapper = document.createElement('span');
  wrapper.className = 'pioneer-inline-create';
  wrapper.style.cssText = 'display:inline-flex;gap:4px;align-items:center';
  wrapper.innerHTML = `
    <input type="text" class="pioneer-inline-first-name" placeholder="First name" maxlength="80" style="min-width:110px">
    <input type="text" class="pioneer-inline-last-name" placeholder="Last name" maxlength="80" style="min-width:130px">
    <input type="email" class="pioneer-inline-email" placeholder="email@example.com" style="min-width:160px">
    <button type="button" class="btn btn-sm btn-primary pioneer-inline-save">Save</button>
    <button type="button" class="btn btn-sm pioneer-inline-cancel">Cancel</button>
  `;
  sel.replaceWith(wrapper);
  wrapper.querySelector('.pioneer-inline-first-name').focus();
}

async function handlePioneerInlineSave(rowEl) {
  const wrapper = rowEl.querySelector('.pioneer-inline-create');
  if (!wrapper) return;
  const firstName = wrapper.querySelector('.pioneer-inline-first-name').value.trim();
  const lastName = wrapper.querySelector('.pioneer-inline-last-name').value.trim();
  const email = wrapper.querySelector('.pioneer-inline-email').value.trim();
  if (!firstName && !lastName) {
    if (typeof showToast === 'function') showToast('First or last name is required');
    else alert('First or last name is required');
    return;
  }
  try {
    const { status, body: result } = await apiCallWithStatus('POST', '/pioneers', {
      first_name: firstName,
      last_name: lastName,
      email: email || null,
    });
    // Refresh module-level pioneer cache.
    window._allPioneers = await loadAllPioneers();
    // Re-render the picker with the new/matched pioneer selected.
    const newSelect = document.createElement('span');
    newSelect.innerHTML = renderPioneerPickerSelect(result.id, window._allPioneers);
    wrapper.replaceWith(newSelect.firstElementChild);
    wirePioneerPickerEvents(rowEl);
    if (typeof showToast === 'function') {
      showToast(status === 200 ? 'Pioneer already existed — selected' : 'Pioneer added');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Failed to create pioneer: ' + (e?.message || e));
    else alert('Failed to create pioneer: ' + (e?.message || e));
  }
}

function handlePioneerInlineCancel(rowEl) {
  const wrapper = rowEl.querySelector('.pioneer-inline-create');
  if (!wrapper) return;
  const newSelect = document.createElement('span');
  newSelect.innerHTML = renderPioneerPickerSelect(null, window._allPioneers || []);
  wrapper.replaceWith(newSelect.firstElementChild);
  wirePioneerPickerEvents(rowEl);
}

function wirePioneerPickerEvents(rowEl) {
  const sel = rowEl.querySelector('.pioneer-picker');
  if (sel) {
    sel.addEventListener('change', () => {
      if (sel.value === '__new__') {
        renderInlinePioneerCreate(rowEl);
        // Re-wire so the newly-created Save/Cancel buttons get their click listeners.
        wirePioneerPickerEvents(rowEl);
      }
    });
  }
  rowEl.querySelectorAll('.pioneer-inline-save').forEach(btn => {
    btn.addEventListener('click', () => handlePioneerInlineSave(rowEl));
  });
  rowEl.querySelectorAll('.pioneer-inline-cancel').forEach(btn => {
    btn.addEventListener('click', () => handlePioneerInlineCancel(rowEl));
  });
}

async function refreshPioneerRoleSelects() {
  const practiceSel = document.getElementById('fPractice') || document.getElementById('fPracticeId');
  const currencySel = document.getElementById('fCurrency');
  const practiceId = practiceSel?.value;
  const currency = currencySel?.value || window._defaultCurrency || 'EUR';
  window._availableRoles = await loadProjectPracticeRoles(practiceId, currency);
  document.querySelectorAll('.pioneer-row').forEach(row => {
    const oldSel = row.querySelector('.pioneer-role');
    if (!oldSel) return;
    const currentRoleName = oldSel.value;
    const newHtml = renderPioneerRoleSelect(currentRoleName, window._availableRoles);
    const wrapper = document.createElement('span');
    wrapper.innerHTML = newHtml;
    oldSel.replaceWith(wrapper.firstChild);
  });
  document.querySelectorAll('.pioneer-row').forEach(wirePioneerRoleSelectEvents);
  refreshLegacyTeamRolePickers();
}

function renderLegacyTeamSection(existingTeam) {
  // existingTeam: [{role_name, count, day_rate}, ...]
  const hasCatalog = (window._availableRoles || []).length > 0;

  let rowsHtml = '';
  (existingTeam || []).forEach((r, idx) => {
    rowsHtml += renderLegacyTeamRow(idx, r);
  });
  if (!existingTeam || existingTeam.length === 0) {
    if (hasCatalog) {
      rowsHtml = `<div class="legacy-team-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No legacy team mix entered yet.</div>`;
    } else {
      const adminMsg = `<div class="legacy-team-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No roles available for this practice + currency. <a href="#settings" onclick="setTimeout(() => document.getElementById('tabPractices')?.click(), 50)" style="color:var(--brand-blue,#6EC1E4)">Configure the practice catalog →</a></div>`;
      const nonAdminMsg = `<div class="legacy-team-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No roles available for this practice + currency. Ask an admin to configure the catalog before entering legacy cost.</div>`;
      rowsHtml = isAdmin() ? adminMsg : nonAdminMsg;
    }
  }

  return `
    <div class="form-group" style="margin-top:16px">
      <label style="font-weight:600;display:block;margin-bottom:6px">Legacy team mix</label>
      <div id="legacyTeamHeader" style="display:grid;grid-template-columns:minmax(0, 1fr) 70px 110px 32px;gap:6px;font-size:11px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.5px;padding:0 4px">
        <span>Role</span><span>Count</span><span>Rate</span><span></span>
      </div>
      <div id="legacyTeamBody">${rowsHtml}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="addLegacyTeamRowBtn" ${hasCatalog ? 'style="margin-top:8px"' : 'disabled style="margin-top:8px;opacity:0.5;cursor:not-allowed"'}>+ Add role</button>
    </div>`;
}

function renderLegacyTeamRow(idx, r) {
  const roleName = r?.role_name || '';
  const count = r?.count ?? '';
  const rate = r?.day_rate ?? '';
  const roleOptions = (window._availableRoles || [])
    .map(role => {
      const sel = role.role_name === roleName ? 'selected' : '';
      return `<option value="${esc(role.role_name)}" data-rate="${role.day_rate}" ${sel}>${esc(role.role_name)} — ${esc(String(role.day_rate))}</option>`;
    }).join('');
  const orphanOpt = (roleName && !(window._availableRoles || []).some(r2 => r2.role_name === roleName))
    ? `<option value="${esc(roleName)}" data-rate="${rate}" selected>${esc(roleName)} (not in catalog)</option>`
    : '';
  return `
    <div class="legacy-team-row" data-row-idx="${idx}" style="display:grid;grid-template-columns:minmax(0, 1fr) 70px 110px 32px;gap:6px;align-items:center;padding:4px;border-bottom:1px solid var(--gray-100)">
      <select class="lt-role"><option value="">—</option>${roleOptions}${orphanOpt}</select>
      <input type="number" class="lt-count" min="1" step="1" value="${esc(String(count))}" placeholder="1">
      <span class="lt-rate" style="color:var(--gray-600);font-size:13px">${rate !== '' ? esc(String(rate)) : '—'}</span>
      <button type="button" class="btn-icon lt-remove" title="Remove" style="background:none;border:0;cursor:pointer;color:var(--danger)">×</button>
    </div>`;
}

function wireLegacyTeamEvents() {
  const body = document.getElementById('legacyTeamBody');
  const addBtn = document.getElementById('addLegacyTeamRowBtn');
  if (!body || !addBtn) return;

  addBtn.addEventListener('click', () => {
    const empty = body.querySelector('.legacy-team-empty');
    if (empty) empty.remove();
    const idx = body.querySelectorAll('.legacy-team-row').length;
    body.insertAdjacentHTML('beforeend', renderLegacyTeamRow(idx, {}));
    wireLegacyTeamRoleChange(body.lastElementChild);
  });

  body.addEventListener('click', (ev) => {
    if (ev.target.classList.contains('lt-remove')) {
      ev.target.closest('.legacy-team-row').remove();
      if (body.querySelectorAll('.legacy-team-row').length === 0) {
        body.innerHTML = `<div class="legacy-team-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No legacy team mix entered yet.</div>`;
      }
    }
  });

  // Wire role-change handlers on existing rows.
  body.querySelectorAll('.legacy-team-row').forEach(wireLegacyTeamRoleChange);
}

function wireLegacyTeamRoleChange(rowEl) {
  const sel = rowEl.querySelector('.lt-role');
  const rateSpan = rowEl.querySelector('.lt-rate');
  if (!sel || !rateSpan) return;
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex];
    const rate = opt?.dataset?.rate;
    rateSpan.textContent = (rate != null && rate !== '' && rate !== 'undefined') ? rate : '—';
  });
}

function refreshLegacyTeamRolePickers() {
  // Called when practice/currency changes — re-render role options
  // but preserve the user's existing selections.
  const body = document.getElementById('legacyTeamBody');
  if (!body) return;

  // If the body contains only the empty-state placeholder, re-render
  // the full section so the catalog-empty vs catalog-available message
  // and the "+ Add role" button disabled state are updated correctly.
  const hasOnlyEmptyState = body.querySelector('.legacy-team-empty') && body.querySelectorAll('.legacy-team-row').length === 0;
  if (hasOnlyEmptyState) {
    const addBtn = document.getElementById('addLegacyTeamRowBtn');
    const hasCatalog = (window._availableRoles || []).length > 0;
    // Update empty-state message.
    if (hasCatalog) {
      body.innerHTML = `<div class="legacy-team-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No legacy team mix entered yet.</div>`;
    } else {
      const adminMsg = `<div class="legacy-team-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No roles available for this practice + currency. <a href="#settings" onclick="setTimeout(() => document.getElementById('tabPractices')?.click(), 50)" style="color:var(--brand-blue,#6EC1E4)">Configure the practice catalog →</a></div>`;
      const nonAdminMsg = `<div class="legacy-team-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No roles available for this practice + currency. Ask an admin to configure the catalog before entering legacy cost.</div>`;
      body.innerHTML = isAdmin() ? adminMsg : nonAdminMsg;
    }
    // Update the add button's disabled state.
    if (addBtn) {
      if (hasCatalog) {
        addBtn.disabled = false;
        addBtn.style.opacity = '';
        addBtn.style.cursor = '';
      } else {
        addBtn.disabled = true;
        addBtn.style.opacity = '0.5';
        addBtn.style.cursor = 'not-allowed';
      }
    }
    return;
  }

  body.querySelectorAll('.legacy-team-row').forEach(row => {
    const sel = row.querySelector('.lt-role');
    if (!sel) return;
    const currentRoleName = sel.value;
    const currentCount = row.querySelector('.lt-count')?.value || '';
    const currentRate = row.querySelector('.lt-rate')?.textContent || '';
    const idx = row.dataset.rowIdx;
    // Re-render the row with current values.
    const newHtml = renderLegacyTeamRow(idx, {
      role_name: currentRoleName,
      count: currentCount,
      day_rate: currentRate === '—' ? '' : currentRate,
    });
    const wrapper = document.createElement('span');
    wrapper.innerHTML = newHtml;
    row.replaceWith(wrapper.firstElementChild);
  });
  body.querySelectorAll('.legacy-team-row').forEach(wireLegacyTeamRoleChange);
}

async function renderNewProject(existing) {
  await loadTaxonomy();
  const mc = document.getElementById('mainContent');
  const isEdit = !!existing;
  const p = existing || {};

  mc.innerHTML = `
    <form id="projectForm" class="project-form">
      <fieldset><legend>Project Info</legend>
        <div class="form-row">
          <div class="form-group"><label>Project Name *</label><input type="text" id="fName" value="${esc(p.project_name || '')}" required></div>
          <div class="form-group"><label>Category * <span class="field-hint" data-hint="Deliverable type. Used for category norms, benchmarking, and the scaling gate &quot;Multi-engagement&quot; (at least 2 types required).">&#9432;</span></label><select id="fCategory" required>${categoryOptionsHTML(p.category_id)}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Practice <span class="field-hint" data-hint="The Alira Health practice leading this project. The list is filtered to the practices allowed for the selected category.">&#9432;</span></label><select id="fPractice">${practiceOptionsHTML(p.practice_id, p.category_id)}</select></div>
          <div class="form-group"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Client Name</label><input type="text" id="fClient" value="${esc(p.client_name || '')}"></div>
          <div class="form-group"><label>Client Contact Email</label><input type="email" id="fClientEmail" value="${esc(p.client_contact_email || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Engagement Stage</label><select id="fStage">${optionsHTML(ENGAGEMENT_STAGES, p.engagement_stage)}</select></div>
          <div class="form-group"><label>Client Pulse</label><select id="fPulse">${optionsHTML(CLIENT_PULSE_OPTIONS, p.client_pulse || 'Not yet received')}</select></div>
        </div>
        <div class="form-group"><label>Description</label><textarea id="fDesc" rows="3">${esc(p.description || '')}</textarea></div>
      </fieldset>

      <fieldset><legend>Pioneers</legend>
        <p class="field-help" style="color:var(--gray-500);font-size:13px;margin:0 0 12px">Each pioneer receives a unique assessment link. They independently evaluate the deliverable by comparing xCSG vs legacy methods across six dimensions (machine-first, senior-led, knowledge, client impact, value creation, honest signal).</p>
        <div id="pioneersContainer"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="addPioneerBtn" style="margin-top:8px">+ Add Pioneer</button>
        <div class="form-row" style="margin-top:16px">
          <div class="form-group">
            <label>Default Rounds <span class="field-hint" data-hint="Number of times each pioneer will be surveyed. Set per-pioneer overrides in the Rounds column above.">&#9432;</span></label>
            <input type="number" id="fDefaultRounds" min="1" max="10" value="${p.default_rounds || 1}" style="width:100px">
            <span class="field-help" style="color:var(--gray-500);font-size:12px;display:block;margin-top:4px">How many survey rounds per pioneer</span>
          </div>
          <div class="form-group">
            <label>Show Previous Answers <span class="field-hint" data-hint="When enabled, pioneers see their prior round responses (read-only) when starting a new round. Useful for longitudinal tracking.">&#9432;</span></label>
            <select id="fShowPrevious">
              <option value="0" ${!p.show_previous_answers ? 'selected' : ''}>No</option>
              <option value="1" ${p.show_previous_answers ? 'selected' : ''}>Yes</option>
            </select>
            <span class="field-help" style="color:var(--gray-500);font-size:12px;display:block;margin-top:4px">Let pioneers view their previous responses</span>
          </div>
          <div class="form-group">
            <label>Show Other Pioneers' Answers <span class="field-hint" data-hint="When enabled, experts can see submitted answers from other pioneers on this project.">&#9432;</span></label>
            <label style="display:flex;align-items:center;gap:8px;font-weight:normal;margin-top:6px">
              <input type="checkbox" id="fShowOtherPioneers" ${p.show_other_pioneers_answers ? 'checked' : ''}>
              <span>Enable cross-pioneer visibility</span>
            </label>
            <span class="field-help" style="color:var(--gray-500);font-size:12px;display:block;margin-top:4px">When enabled, experts can see submitted answers from other pioneers on this project.</span>
          </div>
        </div>
      </fieldset>

      <fieldset><legend>Timeline <span id="calendarDaysBadge" class="badge badge-info" style="font-size:11px"></span> <span id="scheduleDeltaBadge" class="badge" style="font-size:11px"></span></legend>
        <div class="form-row">
          <div class="form-group"><label>Date Started</label><input type="date" id="fDateStart" value="${p.date_started || ''}"></div>
          <div class="form-group"><label>Expected Delivery <span class="field-hint" data-hint="Planned delivery date at kickoff. Can be updated when the plan changes. Used to compute schedule variance vs. actual delivery.">&#9432;</span></label><input type="date" id="fDateExpected" value="${p.date_expected_delivered || ''}"></div>
          <div class="form-group"><label>Date Delivered</label><input type="date" id="fDateEnd" value="${p.date_delivered || ''}"></div>
        </div>
      </fieldset>

      <fieldset><legend>xCSG Performance</legend>
        <p class="field-help" style="color:var(--gray-500);font-size:13px;margin:0 0 12px">Actual delivery metrics for this project using the xCSG approach. Team Size and Revision Rounds are required. Calendar Days auto-compute from dates if left blank. These feed into Delivery Speed = Legacy person-days \u00F7 xCSG person-days.</p>
        <div class="form-row">
          <div class="form-group">
            <label>Calendar Days <span class="field-hint" data-hint="Total elapsed calendar days for xCSG delivery. Auto-computed from dates if left blank.">&#9432;</span></label>
            <input type="number" id="fXDays" min="1" max="365" step="1" value="${esc(p.xcsg_calendar_days || '')}" placeholder="e.g. 5">
            <span class="field-warn" id="warnXDays"></span>
          </div>
          <div class="form-group">
            <label>Team Size * <span class="field-hint" data-hint="Number of people on the xCSG delivery team. Used to compute person-days (working days × team size).">&#9432;</span></label>
            <input type="number" id="fXTeam" min="1" max="50" step="1" value="${esc(p.xcsg_team_size || '')}" required placeholder="e.g. 2">
            <span class="field-warn" id="warnXTeam"></span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Revision Rounds * <span class="field-hint" data-hint="How many revision cycles the xCSG deliverable went through. Feeds into the Rework Efficiency metric.">&#9432;</span></label>
            <input type="number" id="fRevisions" min="0" max="20" step="1" value="${esc(p.xcsg_revision_rounds || '')}" required placeholder="e.g. 1">
            <span class="field-warn" id="warnRevisions"></span>
          </div>
          <div class="form-group"><label>Scope Expansion</label><select id="fScopeExpansion">${optionsHTML(SCOPE_OPTIONS, p.xcsg_scope_expansion)}</select></div>
        </div>
        <div class="form-group"><label>Revision Depth</label><select id="fRevDepth">${optionsHTML(REVISION_DEPTH_OPTIONS, p.revision_depth)}</select></div>
      </fieldset>

      <fieldset><legend>Legacy Comparables</legend>
        <p class="field-help" style="color:var(--gray-500);font-size:13px;margin:0 0 12px">Estimated delivery metrics if this project had been done using traditional methods. Pre-filled from category norms when available. The expert survey (Section L) provides more detailed legacy estimates \u2014 expert data takes precedence over these values when computing metrics.</p>
        <div class="form-group">
            <label>Calendar Days</label>
            <input type="number" id="fLDays" min="1" max="365" step="1" value="${esc(p.legacy_calendar_days || '')}" placeholder="e.g. 10">
            <span class="field-warn" id="warnLDays"></span>
          </div>
        <div class="form-group">
          <label>Revision Rounds</label>
          <input type="number" id="fLRevisions" min="0" max="20" step="1" value="${esc(p.legacy_revision_rounds || '')}" placeholder="e.g. 3">
          <span class="field-warn" id="warnLRevisions"></span>
        </div>
        ${renderLegacyTeamSection(p?.legacy_team || [])}
      </fieldset>

      <fieldset class="economics-section">
        <legend style="cursor:pointer;user-select:none" onclick="toggleEconomics()">
          <span id="econToggle">▸</span> Economics <span style="font-weight:400;font-size:12px;color:var(--gray-500)">(optional)</span>
        </legend>
        <div id="economicsBody" style="display:none">
          <p class="field-help" style="color:var(--gray-500);font-size:13px;margin:0 0 12px">Financial parameters for value-gain ROI calculations. All fields are optional.</p>
          <div class="form-row">
            <div class="form-group">
              <label>Currency</label>
              <select id="fCurrency" onchange="onCurrencyChange()" data-previous="${esc(p.currency || window._defaultCurrency || 'EUR')}">
                ${(schema?.currencies || ['EUR','USD','GBP','CHF','CAD','AUD']).map(c => `<option value="${esc(c)}"${(p.currency || window._defaultCurrency || 'EUR') === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Engagement Revenue</label>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="number" id="fRevenue" min="0" step="0.01" value="${esc(p.engagement_revenue ?? '')}" placeholder="e.g. 50000">
                <span class="field-help" data-suffix style="white-space:nowrap">${esc(p.currency || window._defaultCurrency || 'EUR')}</span>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Pricing Model</label>
              <select id="fPricingModel">
                <option value="">—</option>
                ${(schema?.pricing_models || ['Fixed fee','Time & materials','Retainer','Milestone','Other']).map(m => `<option value="${esc(m)}"${p.xcsg_pricing_model === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Scope-Expansion Revenue</label>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="number" id="fScopeRev" min="0" step="0.01" value="${esc(p.scope_expansion_revenue ?? '')}" placeholder="e.g. 10000">
                <span class="field-help" data-suffix style="white-space:nowrap">${esc(p.currency || window._defaultCurrency || 'EUR')}</span>
              </div>
              <span class="field-help" style="color:var(--gray-500);font-size:12px;display:block;margin-top:4px">Revenue from scope expansions triggered by this engagement</span>
            </div>
          </div>
        </div>
      </fieldset>

      <div style="display:flex;gap:12px;margin-top:24px;align-items:center">
        ${canWrite() ? `<button type="submit" class="btn btn-primary" id="fSubmit">${isEdit ? 'Save Changes' : 'Create Project'}</button>` : ''}
        ${isEdit ? '<button type="button" class="btn btn-secondary" onclick="window.location.hash=\'#projects\'">Back to Projects</button>' : ''}
        ${isEdit && isAdmin() ? `<button type="button" class="btn btn-danger" onclick="confirmDelete(${p.id}, '${esc(p.project_name)}')">Delete</button>` : ''}
      </div>
    </form>`;

  // Load role catalog and pioneer list before populating pioneer rows
  const _practiceIdForRoles = p.practice_id || null;
  const _currencyForRoles = p.currency || window._defaultCurrency || 'EUR';
  [window._availableRoles, window._allPioneers] = await Promise.all([
    loadProjectPracticeRoles(_practiceIdForRoles, _currencyForRoles),
    loadAllPioneers(),
  ]);

  // Wire legacy team mix (re-populates role pickers now that _availableRoles is loaded)
  wireLegacyTeamEvents();
  if (window._availableRoles && window._availableRoles.length > 0) {
    refreshLegacyTeamRolePickers();
  }

  // Pioneer row management
  let pioneerIndex = 0;
  function addPioneerRow(pioneerId, rounds, dayRate, roleName) {
    const container = document.getElementById('pioneersContainer');
    const idx = pioneerIndex++;
    const row = document.createElement('div');
    row.className = 'pioneer-row';
    row.dataset.idx = idx;
    const currentCurrency = document.getElementById('fCurrency')?.value || window._defaultCurrency || 'EUR';
    row.innerHTML = `<div class="form-group"><label>Pioneer *</label>${renderPioneerPickerSelect(pioneerId || null, window._allPioneers || [])}</div>`
      + `<div class="form-group" style="flex:0 0 120px"><label>Rounds <span class="field-hint" data-hint="Override the project default for this pioneer. Leave blank to use the Default Rounds setting.">&#9432;</span></label><input type="number" class="pioneer-rounds" min="1" max="10" value="${rounds || ''}" placeholder="Default" style="width:110px"></div>`
      + `<div class="form-group" style="flex:0 0 160px"><label>Role</label>${renderPioneerRoleSelect(roleName || null, window._availableRoles || [])}</div>`
      + `<div class="form-group" style="flex:0 0 160px"><label>Day rate <span class="field-hint" data-hint="Pioneer day rate for cost calculations. Optional.">&#9432;</span></label><div style="display:flex;align-items:center;gap:4px"><input type="number" class="pioneer-day-rate" min="0" step="0.01" value="${esc(dayRate ?? '')}" placeholder="Day rate (optional)" style="width:110px"><span class="field-help" data-suffix style="white-space:nowrap">${esc(currentCurrency)}</span></div></div>`
      + `<button type="button" class="btn btn-sm btn-danger pioneer-remove-btn" style="align-self:flex-end;margin-bottom:2px" title="Remove pioneer">&times;</button>`;
    container.appendChild(row);
    wirePioneerPickerEvents(row);
    wirePioneerRoleSelectEvents(row);
    row.querySelector('.pioneer-remove-btn').addEventListener('click', function() {
      if (container.querySelectorAll('.pioneer-row').length <= 1) {
        showToast('At least one pioneer is required', 'error');
        return;
      }
      row.remove();
    });
  }

  // Populate pioneers: edit mode uses p.pioneers, new mode starts with one empty row
  if (isEdit && p.pioneers && p.pioneers.length) {
    for (const pi of p.pioneers) {
      addPioneerRow(pi.pioneer_id, pi.total_rounds, pi.day_rate, pi.role_name);
    }
  } else if (!isEdit) {
    addPioneerRow(null, '', '', null);
  } else {
    // Edit mode fallback: use legacy pioneer_name if no pioneers array
    addPioneerRow(null, '', '', null);
  }

  document.getElementById('addPioneerBtn').addEventListener('click', function() {
    addPioneerRow(null, '', '', null);
  });

  // Re-populate role pickers when practice changes
  document.getElementById('fPractice').addEventListener('change', function() {
    refreshPioneerRoleSelects();
    refreshLegacyTeamRolePickers();
  });

  // Pioneer table for edit mode
  if (isEdit && p.pioneers && p.pioneers.length) {
    _renderPioneerTable(p, mc);
  }

  // Calendar days auto-compute + schedule variance badge.
  // xDays is auto-filled from (actual || expected) and refreshes while still auto-filled.
  // If the user types into it, the autofilled flag is cleared and we stop overwriting.
  function updateCalendarDays() {
    const s = document.getElementById('fDateStart').value;
    const expected = document.getElementById('fDateExpected').value;
    const actual = document.getElementById('fDateEnd').value;
    const badge = document.getElementById('calendarDaysBadge');
    const schedBadge = document.getElementById('scheduleDeltaBadge');
    const xDays = document.getElementById('fXDays');
    const endForDays = actual || expected;
    if (s && endForDays) {
      const days = Math.round((new Date(endForDays) - new Date(s)) / 86400000);
      if (days >= 0) {
        badge.textContent = days + ' calendar days' + (actual ? '' : ' (est.)');
        if (xDays && (!xDays.value || xDays.dataset.autofilled === '1')) {
          xDays.value = days;
          xDays.dataset.autofilled = '1';
        }
      } else {
        badge.textContent = '';
      }
    } else { badge.textContent = ''; }
    if (schedBadge) {
      if (expected && actual) {
        const delta = Math.round((new Date(actual) - new Date(expected)) / 86400000);
        schedBadge.textContent = formatScheduleDelta(delta);
        schedBadge.className = 'badge ' + scheduleDeltaBadgeClass(delta);
      } else {
        schedBadge.textContent = '';
        schedBadge.className = 'badge';
      }
    }
  }
  // Category change → rebuild Practice dropdown with allowed-only options.
  document.getElementById('fCategory').addEventListener('change', function () {
    const pracSel = document.getElementById('fPractice');
    if (pracSel) pracSel.innerHTML = practiceOptionsHTML(null, this.value);
    refreshPioneerRoleSelects();
    refreshLegacyTeamRolePickers();
  });

  document.getElementById('fDateStart').addEventListener('change', updateCalendarDays);
  document.getElementById('fDateExpected').addEventListener('change', updateCalendarDays);
  document.getElementById('fDateEnd').addEventListener('change', updateCalendarDays);
  document.getElementById('fXDays').addEventListener('input', function () {
    this.dataset.autofilled = '';
  });
  updateCalendarDays();

  // Numeric field validation
  function validateNumField(inputId, warnId, { min, max, intOnly, label }) {
    const el = document.getElementById(inputId);
    const warn = document.getElementById(warnId);
    if (!el || !warn) return;
    el.addEventListener('input', () => {
      const v = el.value.trim();
      if (v === '') { warn.textContent = ''; return; }
      const n = Number(v);
      if (isNaN(n)) { warn.textContent = label + ' must be a number'; return; }
      if (intOnly && n !== Math.floor(n)) { warn.textContent = label + ' must be a whole number'; return; }
      if (n < min) { warn.textContent = label + ' seems too low (min ' + min + ')'; return; }
      if (n > max) { warn.textContent = label + ' seems too high (max ' + max + ')'; return; }
      warn.textContent = '';
    });
  }
  validateNumField('fXDays', 'warnXDays', { min: 1, max: 365, intOnly: true, label: 'Calendar days' });
  validateNumField('fXTeam', 'warnXTeam', { min: 1, max: 50, intOnly: true, label: 'Team size' });
  validateNumField('fRevisions', 'warnRevisions', { min: 0, max: 20, intOnly: true, label: 'Revision rounds' });
  validateNumField('fLDays', 'warnLDays', { min: 1, max: 365, intOnly: true, label: 'Calendar days' });
  validateNumField('fLRevisions', 'warnLRevisions', { min: 0, max: 20, intOnly: true, label: 'Revision rounds' });

  // Submit
  document.getElementById('projectForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('fSubmit');
    btn.disabled = true; btn.textContent = isEdit ? 'Saving\u2026' : 'Creating\u2026';
    // Collect pioneers from rows
    const pioneerRows = document.querySelectorAll('#pioneersContainer .pioneer-row');
    const pioneers = [];
    for (const row of pioneerRows) {
      const pickerVal = row.querySelector('.pioneer-picker')?.value || '';
      if (!pickerVal || pickerVal === '__new__') {
        showToast('Please pick a pioneer (or save the inline form) for each row', 'error');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Save Changes' : 'Create Project';
        return;
      }
      const roundsVal = row.querySelector('.pioneer-rounds').value;
      const total_rounds = roundsVal ? parseInt(roundsVal) : null;
      const day_rate = parseOptionalNumber(row.querySelector('.pioneer-day-rate')?.value);
      const role_name = row.querySelector('.pioneer-role')?.value || null;
      pioneers.push({ pioneer_id: parseInt(pickerVal), total_rounds, day_rate, role_name });
    }
    if (pioneers.length === 0) {
      showToast('At least one pioneer is required', 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Project';
      return;
    }

    const legacyTeamRows = Array.from(document.querySelectorAll('#legacyTeamBody .legacy-team-row'));
    const legacy_team = legacyTeamRows.map(row => {
      const role_name = row.querySelector('.lt-role')?.value || '';
      const count = parseInt(row.querySelector('.lt-count')?.value) || 0;
      const rateText = row.querySelector('.lt-rate')?.textContent || '';
      const day_rate = rateText === '—' ? 0 : (parseFloat(rateText) || 0);
      return { role_name, count, day_rate };
    }).filter(r => r.role_name && r.count > 0);

    const practiceVal = document.getElementById('fPractice').value;
    const payload = {
      project_name: document.getElementById('fName').value,
      category_id: parseInt(document.getElementById('fCategory').value),
      practice_id: practiceVal ? parseInt(practiceVal) : null,
      pioneers: pioneers,
      default_rounds: parseInt(document.getElementById('fDefaultRounds').value) || 1,
      show_previous_answers: document.getElementById('fShowPrevious').value === '1',
      show_other_pioneers_answers: document.getElementById('fShowOtherPioneers').checked,
      client_name: document.getElementById('fClient').value || null,
      client_contact_email: document.getElementById('fClientEmail').value || null,
      engagement_stage: document.getElementById('fStage').value || null,
      client_pulse: document.getElementById('fPulse').value || 'Not yet received',
      description: document.getElementById('fDesc').value || null,
      date_started: document.getElementById('fDateStart').value || null,
      date_expected_delivered: document.getElementById('fDateExpected').value || null,
      date_delivered: document.getElementById('fDateEnd').value || null,
      xcsg_calendar_days: document.getElementById('fXDays').value || null,
      xcsg_team_size: document.getElementById('fXTeam').value,
      xcsg_revision_rounds: document.getElementById('fRevisions').value,
      revision_depth: document.getElementById('fRevDepth').value || null,
      xcsg_scope_expansion: document.getElementById('fScopeExpansion').value || null,
      legacy_calendar_days: document.getElementById('fLDays').value || null,
      legacy_revision_rounds: document.getElementById('fLRevisions').value || null,
      legacy_team: legacy_team,
      currency: document.getElementById('fCurrency')?.value || null,
      engagement_revenue: parseOptionalNumber(document.getElementById('fRevenue').value),
      xcsg_pricing_model: document.getElementById('fPricingModel')?.value || null,
      scope_expansion_revenue: parseOptionalNumber(document.getElementById('fScopeRev').value),
    };
    try {
      if (isEdit) {
        await apiCall('PUT', `/projects/${p.id}`, payload);
        showToast('Project updated');
        // Stay on the edit page so the user can keep tweaking.
        // Re-render in place to pick up any server-side recomputation (metrics, auto-filled days).
        route();
      } else {
        const result = await apiCall('POST', '/projects', payload);
        showExpertLinks(result.pioneers || []);
        showToast('Project created');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Project';
    }
  });
}

function showExpertLink(token) {
  const link = window.location.origin + '/#expert/' + token;
  showModal(`<h3 style="color:var(--navy);margin-bottom:12px">Project Created</h3>
    <p style="margin-bottom:12px">Share this expert assessment link:</p>
    <input type="text" value="${esc(link)}" readonly style="width:100%;padding:8px;border:1px solid var(--gray-200);border-radius:6px;font-family:monospace;font-size:13px" id="expertLinkInput">
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('expertLinkInput').value);showToast('Copied!')">Copy Link</button>
      <button class="btn btn-secondary btn-sm" onclick="hideModal()">Close</button>
    </div>`);
}

function showExpertLinks(pioneers) {
  if (!pioneers || pioneers.length === 0) {
    hideModal();
    window.location.hash = '#projects';
    return;
  }
  if (pioneers.length === 1 && pioneers[0].expert_token) {
    showExpertLink(pioneers[0].expert_token);
    return;
  }
  let html = '<h3 style="color:var(--navy);margin-bottom:12px">Project Created</h3>';
  html += '<p style="margin-bottom:16px">Share these expert assessment links with each pioneer:</p>';
  html += '<div style="max-height:400px;overflow-y:auto">';
  for (const pi of pioneers) {
    const link = window.location.origin + '/#expert/' + (pi.expert_token || '');
    html += '<div style="padding:10px 0;border-bottom:1px solid var(--gray-200)">';
    html += '<div style="font-weight:600;margin-bottom:4px">' + esc(pi.display_name || pi.pioneer_name || pi.name || 'Pioneer') + (pi.email ? ' <span style="color:var(--gray-500);font-weight:400">' + esc(pi.email) + '</span>' : '') + '</div>';
    html += '<div style="display:flex;gap:8px;align-items:center">';
    html += '<input type="text" value="' + esc(link) + '" readonly style="flex:1;padding:6px 8px;border:1px solid var(--gray-200);border-radius:4px;font-family:monospace;font-size:12px">';
    html += '<button class="btn btn-primary btn-sm" onclick="copyToClipboard(\'' + esc(link) + '\')">Copy</button>';
    html += '</div></div>';
  }
  html += '</div>';
  html += '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">';
  html += '<button class="btn btn-secondary btn-sm" onclick="hideModal();window.location.hash=\'#projects\'">Done</button>';
  html += '</div>';
  showModal(html);
}

/* ═══════════════════════════════════════════════════════════════════════
   PIONEER TABLE (Project Detail)
   ═══════════════════════════════════════════════════════════════════════ */

function _renderPioneerTable(p, mc) {
  const pioneers = p.pioneers || [];
  if (!pioneers.length) return;

  const section = document.createElement('fieldset');
  section.id = 'pioneerFieldset';
  section.style.marginTop = '24px';
  section.innerHTML = '<legend>Pioneers &amp; Assessment Rounds</legend>';

  const defaultRounds = p.default_rounds || 1;
  const writer = canWrite();

  let html = '<table class="data-table pioneer-rounds-table"><thead><tr><th>Pioneer</th><th>Email</th><th>Rounds</th>';
  if (writer) html += '<th style="text-align:right">Actions</th>';
  html += '</tr></thead><tbody>';

  for (const pi of pioneers) {
    const totalRounds = pi.total_rounds || defaultRounds;
    const rounds = pi.rounds || [];
    const responseCount = pi.response_count || 0;

    let roundsHtml = '<div class="round-chip-row">';
    for (let r = 1; r <= totalRounds; r++) {
      const existing = rounds.find(x => x.round_number === r);
      let chip;
      if (existing && existing.completed_at) {
        const tip = 'Completed ' + formatDateTime(existing.completed_at) + ' \u2014 click to view responses';
        const viewJs = 'event.stopPropagation();viewPioneerRound(' + pi.id + ',' + r + ')';
        chip = '<button type="button" class="round-chip round-chip-done round-chip-clickable" title="' + esc(tip) + '" onclick="' + viewJs + '">R' + r + ' \u2713</button>';
      } else if (existing) {
        const link = window.location.origin + '/#expert/' + (existing.token || '');
        const copyJs = 'event.stopPropagation();copyToClipboard(\'' + esc(link) + '\')';
        const cancelJs = 'event.stopPropagation();cancelPioneerRound(' + p.id + ',' + pi.id + ',' + r + ')';
        chip = '<span class="round-chip round-chip-pending" title="Pending — click Copy to send the link">R' + r + '</span>';
        if (writer) {
          chip += '<button type="button" class="btn btn-xs btn-secondary round-action" onclick="' + copyJs + '">Copy</button>'
               + '<button type="button" class="btn btn-xs btn-ghost round-action" onclick="' + cancelJs + '" title="Cancel this round">\u00d7</button>';
        }
      } else {
        const prevCompleted = r === 1 || (rounds.find(x => x.round_number === r - 1) && rounds.find(x => x.round_number === r - 1).completed_at);
        if (prevCompleted && writer) {
          const issueJs = 'event.stopPropagation();issuePioneerRound(' + p.id + ',' + pi.id + ',' + r + ')';
          chip = '<span class="round-chip round-chip-empty">R' + r + '</span>'
               + '<button type="button" class="btn btn-xs btn-primary round-action" onclick="' + issueJs + '">Issue</button>';
        } else {
          chip = '<span class="round-chip round-chip-locked" title="Issue after previous round is completed">R' + r + '</span>';
        }
      }
      roundsHtml += '<span class="round-chip-group">' + chip + '</span>';
    }
    roundsHtml += '</div>';

    const removeBtn = writer && responseCount === 0
      ? '<button type="button" class="btn btn-sm btn-danger" onclick="event.stopPropagation();removePioneer(' + p.id + ',' + pi.id + ',\'' + esc(pi.display_name || pi.pioneer_name || pi.name || '') + '\')">Remove</button>'
      : '';

    html += '<tr><td><strong>' + esc(pi.display_name || pi.pioneer_name || pi.name || '') + '</strong></td>'
      + '<td>' + esc(pi.pioneer_email || pi.email || '\u2014') + '</td>'
      + '<td>' + roundsHtml + '</td>';
    if (writer) html += '<td class="actions-cell" style="text-align:right">' + removeBtn + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  if (writer) {
    html += '<button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="showAddPioneerForm(' + p.id + ')">+ Add Pioneer</button>';
  }
  section.innerHTML += html;

  const form = mc.querySelector('#projectForm');
  if (form) form.appendChild(section);
}


async function issuePioneerRound(projectId, pioneerId, roundNumber) {
  try {
    const row = await apiCall('POST', '/pioneers/' + pioneerId + '/rounds/' + roundNumber + '/issue', {});
    const link = window.location.origin + '/#expert/' + row.token;
    await _refreshPioneerFieldset(projectId);
    // Show the link in a modal with a user-click Copy button. The clipboard
    // API requires a user gesture, which is lost after the await above, so we
    // can't auto-copy reliably.
    showModal(
      '<h3 style="color:var(--navy);margin-bottom:12px">Round ' + roundNumber + ' issued</h3>'
      + '<p style="margin-bottom:12px">Send this link to the pioneer when ready. They can only open it once.</p>'
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">'
      + '<input type="text" value="' + esc(link) + '" readonly style="flex:1;padding:8px 10px;border:1px solid var(--gray-200);border-radius:4px;font-family:monospace;font-size:12px">'
      + '<button type="button" class="btn btn-primary btn-sm" onclick="copyToClipboard(\'' + esc(link) + '\')">Copy</button>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-secondary btn-sm" onclick="hideModal()">Done</button></div>'
    );
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function cancelPioneerRound(projectId, pioneerId, roundNumber) {
  if (!confirm('Cancel the pending round ' + roundNumber + '? The issued link will stop working.')) return;
  try {
    await apiCall('DELETE', '/pioneers/' + pioneerId + '/rounds/' + roundNumber);
    showToast('Round ' + roundNumber + ' cancelled.');
    await _refreshPioneerFieldset(projectId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewPioneerRound(pioneerId, roundNumber) {
  try {
    const data = await apiCall('GET', '/pioneers/' + pioneerId + '/rounds/' + roundNumber);
    const header = '<h3 style="color:var(--navy);margin-bottom:4px">' + esc(data.pioneer_name) + ' \u2014 Round ' + data.round_number + '</h3>'
      + '<p style="color:var(--gray-500);font-size:13px;margin-bottom:16px">Submitted ' + esc(formatDateTime(data.submitted_at)) + '</p>';
    const body = renderExpertAssessment(data.response, data.metrics || {}, data.project);
    const footer = '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button type="button" class="btn btn-secondary btn-sm" onclick="hideModal()">Close</button></div>';
    showModal('<div class="pioneer-round-modal">' + header + body + footer + '</div>');
  } catch (err) {
    showToast('Failed to load round: ' + err.message, 'error');
  }
}

async function _refreshPioneerFieldset(projectId) {
  // Partial refresh of only the pioneer fieldset — avoids re-rendering the whole
  // project edit view (which would scroll to top and lose form state).
  try {
    const p = await apiCall('GET', '/projects/' + projectId);
    const mc = document.getElementById('mainContent');
    if (!mc) return;
    const existing = document.getElementById('pioneerFieldset');
    if (existing) existing.remove();
    _renderPioneerTable(p, mc);
  } catch (err) {
    showToast('Failed to refresh pioneers: ' + err.message, 'error');
  }
}

function removePioneer(projectId, pioneerId, name) {
  showModal('<h3>Remove Pioneer</h3>'
    + '<p>Are you sure you want to remove <strong>' + esc(name) + '</strong>? This is only possible if they have no submitted responses.</p>'
    + '<div class="form-actions">'
    + '<button class="btn btn-danger" onclick="doRemovePioneer(' + projectId + ',' + pioneerId + ')">Remove</button>'
    + '<button class="btn btn-secondary" onclick="hideModal()">Cancel</button></div>');
}

async function doRemovePioneer(projectId, pioneerId) {
  hideModal();
  try {
    await apiCall('DELETE', '/projects/' + projectId + '/pioneers/' + pioneerId);
    showToast('Pioneer removed');
    renderEditProject(projectId);
  } catch (err) { showToast(err.message, 'error'); }
}

function showAddPioneerForm(projectId) {
  showModal('<h3>Add Pioneer</h3>'
    + '<div style="display:flex;gap:8px">'
    + '<div class="form-group" style="flex:1"><label>First name *</label><input type="text" id="addPioneerFirstName" data-testid="add-pioneer-first-name" placeholder="First name" maxlength="80"></div>'
    + '<div class="form-group" style="flex:1"><label>Last name *</label><input type="text" id="addPioneerLastName" data-testid="add-pioneer-last-name" placeholder="Last name" maxlength="80"></div>'
    + '</div>'
    + '<div class="form-group" style="margin-top:12px"><label>Email</label><input type="email" id="addPioneerEmail" placeholder="Email (optional)"></div>'
    + '<div class="form-group" style="margin-top:12px"><label>Total Rounds</label><input type="number" id="addPioneerRounds" min="1" max="10" placeholder="Uses project default"></div>'
    + '<div class="form-actions" style="margin-top:16px">'
    + '<button class="btn btn-primary" onclick="submitAddPioneer(' + projectId + ')">Add</button>'
    + '<button class="btn btn-secondary" onclick="hideModal()">Cancel</button></div>');
}

async function submitAddPioneer(projectId) {
  const first_name = document.getElementById('addPioneerFirstName').value.trim();
  const last_name = document.getElementById('addPioneerLastName').value.trim();
  const email = document.getElementById('addPioneerEmail').value.trim() || null;
  const roundsVal = document.getElementById('addPioneerRounds').value;
  const total_rounds = roundsVal ? parseInt(roundsVal) : null;
  if (!first_name && !last_name) { showToast('Pioneer first or last name is required', 'error'); return; }
  hideModal();
  try {
    await apiCall('POST', '/projects/' + projectId + '/pioneers', { first_name, last_name, email, total_rounds });
    showToast('Pioneer added');
    renderEditProject(projectId);
  } catch (err) { showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT PROJECT
   ═══════════════════════════════════════════════════════════════════════ */

async function renderEditProject(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading\u2026</div>';
  try {
    const p = await apiCall('GET', `/projects/${id}`);
    await renderNewProject(p);

    if (p.expert_response) {
      const er = p.expert_response;
      const m = p.metrics || {};
      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginTop = '24px';
      card.innerHTML = renderExpertAssessment(er, m, p);
      mc.appendChild(card);
    }

    // Notes-from-experts section (collapsed by default).
    // The project detail payload doesn't carry per-response notes, so we fetch
    // /api/notes and filter to this project client-side.
    try {
      const allNotes = await apiCall('GET', '/notes');
      const notes = (allNotes || []).filter(n => n.project_id === p.id);
      _renderProjectNotesSection(notes, mc);
    } catch (_) {
      // Silent: notes are a nice-to-have here, not critical path.
    }
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load project: ${esc(err.message)}</div>`;
  }
}

function _renderProjectNotesSection(notes, mc) {
  // Sort newest-first (the API already orders by submitted_at DESC, but be safe).
  notes = notes.slice().sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));

  const details = document.createElement('details');
  details.className = 'project-notes-section';
  if (notes.length > 0) details.open = true;
  let html = '<summary>Notes from experts (' + notes.length + ')</summary>';
  if (!notes.length) {
    html += '<div class="project-notes-empty">No notes from experts yet. Experts can add an optional note at the end of each survey submission.</div>';
  } else {
    html += '<div class="project-notes-list">';
    for (const n of notes) {
      const when = n.submitted_at ? String(n.submitted_at).slice(0, 10) : '—';
      html += '<div class="project-note-card">'
        + '<div class="project-note-header">'
        + '<span class="project-note-pioneer">' + esc(n.pioneer_name || '—') + '</span>'
        + '<span class="project-note-meta">Round ' + esc(n.round_number) + ' · ' + esc(when) + '</span>'
        + '</div>'
        + '<div class="project-note-body">' + esc(n.notes || '').replace(/\n/g, '<br>') + '</div>'
        + '</div>';
    }
    html += '</div>';
  }
  details.innerHTML = html;

  const form = mc.querySelector('#projectForm');
  if (form) form.appendChild(details);
  else mc.appendChild(details);
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECTS LIST
   ═══════════════════════════════════════════════════════════════════════ */

async function renderProjects() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading projects\u2026</div>';
  const myRoute = _routeCounter;
  try {
    const rows = await apiCall('GET', '/projects');
    if (myRoute !== _routeCounter) return;
    if (!rows || rows.length === 0) {
      mc.innerHTML = `<div class="empty-state"><h3>No projects yet</h3><p>Create your first one to get started.</p><a href="#new" class="btn btn-primary">New Project</a></div>`;
      return;
    }

    const cats = [...new Set(rows.map(p => p.category_name).filter(Boolean))].sort();
    const practices = [...new Set(rows.map(p => p.practice_code).filter(Boolean))].sort();

    const fmtScore = (v) => v == null ? '\u2014' : round2(v);

    let html = `
      <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
        <select id="statusFilter" class="filter-select">
          <option value="">All Status</option>
          <option value="pending">Expert Pending</option>
          <option value="partial">Partial</option>
          <option value="complete">Complete</option>
        </select>
        <select id="catFilter" class="filter-select">
          <option value="">All Categories</option>
          ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        <select id="practiceFilter" class="filter-select">
          <option value="">All Practices</option>
          ${practices.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        ${canWrite() ? '<a href="#new" class="btn btn-primary" style="margin-left:auto">+ New Project</a>' : ''}
      </div>
      <div class="card"><table class="data-table" id="projectTable"><thead><tr>
        <th>Project</th><th>Category</th><th>Practice</th><th>Pioneers</th><th>Responses</th><th title="Actual delivery vs. expected delivery.">Schedule</th><th>Quality Score</th><th>G2 Client Pulse</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>`;

    for (const p of rows) {
      // Compute pioneer info
      const pioneers = p.pioneers || [];
      const pioneerCount = pioneers.length;
      const pioneerNames = pioneers.map(pi => pi.display_name || pi.pioneer_name || pi.name || '').filter(Boolean);
      const pioneerLabel = pioneerCount + ' pioneer' + (pioneerCount !== 1 ? 's' : '');
      const pioneerTooltip = pioneerNames.join(', ');

      // Compute response info
      const defaultRounds = p.default_rounds || 1;
      const totalExpected = pioneers.reduce((sum, pi) => sum + (pi.total_rounds || defaultRounds), 0);
      const totalCompleted = pioneers.reduce((sum, pi) => sum + (pi.response_count || 0), 0);
      const responsesLabel = totalCompleted + ' of ' + totalExpected;

      // Status badge with partial support
      let statusBadge, effectiveStatus;
      if (p.status === 'complete') {
        statusBadge = '<span class="badge badge-green">Complete</span>';
        effectiveStatus = 'complete';
      } else if (totalCompleted > 0) {
        statusBadge = '<span class="badge badge-warning">Partial</span>';
        effectiveStatus = 'partial';
      } else {
        statusBadge = '<span class="badge badge-orange">Expert Pending</span>';
        effectiveStatus = 'pending';
      }

      const pulseSelect = `<select class="filter-select client-pulse-inline" data-project-id="${p.id}" onchange="updateClientPulse(${p.id}, this.value)">${optionsHTML(CLIENT_PULSE_OPTIONS, p.client_pulse || 'Not yet received')}</select>`;
      const qualityScore = p.metrics ? fmtScore(p.metrics.quality_score) : '\u2014';
      const trashSvg = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      const _isAdmin = isAdmin();
      const deleteBtn = _isAdmin
        ? `<button class="btn-icon btn-danger-icon" title="Delete" onclick="event.stopPropagation();confirmDelete(${p.id},'${esc(p.project_name)}')">${trashSvg}</button>`
        : '';
      const schedDelta = scheduleDelta(p.date_expected_delivered, p.date_delivered);
      const schedCell = schedDelta == null
        ? '<span style="color:var(--gray-400)">\u2014</span>'
        : `<span class="badge ${scheduleDeltaBadgeClass(schedDelta)}" title="Expected: ${esc(p.date_expected_delivered)} \xb7 Delivered: ${esc(p.date_delivered)}">${formatScheduleDelta(schedDelta)}</span>`;
      html += `<tr class="clickable-row" data-status="${effectiveStatus}" data-cat="${esc(p.category_name)}" data-practice="${esc(p.practice_code || '')}" onclick="window.location.hash='#edit/${p.id}'">
        <td>${esc(p.project_name)}</td>
        <td>${esc(p.category_name || '\u2014')}</td>
        <td>${esc(p.practice_code || '\u2014')}</td>
        <td title="${esc(pioneerTooltip)}">${esc(pioneerLabel)}</td>
        <td>${responsesLabel}</td>
        <td>${schedCell}</td>
        <td>${qualityScore}</td>
        <td onclick="event.stopPropagation()">${pulseSelect}</td>
        <td>${statusBadge}</td>
        <td class="actions-cell">${deleteBtn}</td>
      </tr>`;
    }
    html += '</tbody></table></div>';
    mc.innerHTML = html;

    // Filters
    function applyProjectFilters() {
      const sf = document.getElementById('statusFilter')?.value || '';
      const cf = document.getElementById('catFilter')?.value || '';
      const pf = document.getElementById('practiceFilter')?.value || '';
      document.querySelectorAll('#projectTable tbody tr').forEach(tr => {
        const show =
          (!sf || tr.dataset.status === sf) &&
          (!cf || tr.dataset.cat === cf) &&
          (!pf || tr.dataset.practice === pf);
        tr.style.display = show ? '' : 'none';
      });
    }
    document.getElementById('statusFilter')?.addEventListener('change', applyProjectFilters);
    document.getElementById('catFilter')?.addEventListener('change', applyProjectFilters);
    document.getElementById('practiceFilter')?.addEventListener('change', applyProjectFilters);

  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load: ${esc(err.message)}</div>`;
  }
}

async function updateClientPulse(projectId, value) {
  try {
    await apiCall('PUT', `/projects/${projectId}`, { client_pulse: value });
    showToast('Client pulse updated');
  } catch (err) { showToast(err.message, 'error'); }
}

function confirmDelete(id, name) {
  showModal(`
    <h3>Delete Project</h3>
    <p>Are you sure you want to delete <strong>${esc(name)}</strong>? This will also delete any expert responses.</p>
    <div class="form-actions">
      <button class="btn btn-danger" onclick="doDelete(${id})">Delete</button>
      <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </div>
  `);
}

async function doDelete(id) {
  hideModal();
  try {
    await apiCall('DELETE', `/projects/${id}`);
    showToast('Project deleted');
    renderProjects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD CHARTS
   ═══════════════════════════════════════════════════════════════════════ */



const chartInstances = {};
function ecInit(id) {
  const dom = document.getElementById(id);
  if (!dom) return null;
  // Dispose previous instance and tear down its ResizeObserver so we don't
  // accumulate observers across tab switches.
  if (chartInstances[id]) {
    try { chartInstances[id].dispose(); } catch (_) {}
    if (chartInstances[id].__resizeObserver) {
      try { chartInstances[id].__resizeObserver.disconnect(); } catch (_) {}
    }
  }
  const inst = echarts.init(dom, null, { renderer: 'canvas' });
  const ro = new ResizeObserver(() => inst.resize());
  ro.observe(dom);
  inst.__resizeObserver = ro;
  chartInstances[id] = inst;
  return inst;
}
function tone(v) { return v == null ? DASHBOARD.palette.gray : v > 1.5 ? DASHBOARD.palette.green : v >= 1 ? DASHBOARD.palette.blue : v >= 0.8 ? DASHBOARD.palette.orange : DASHBOARD.palette.red; }
function barColor(v) { return tone(v); }
// Module-level: used by _renderDashboardView and chart renderers (e.g. table_portfolio).
// Reads schema.dashboard.thresholds so it's self-contained once schema is loaded.
function metricTone(value, toneKey = 'metric_tone') {
  if (value == null) return 'var(--gray-400)';
  const t = schema.dashboard.thresholds[toneKey] || schema.dashboard.thresholds.metric_tone;
  if (value > t.success_above) return 'var(--success)';
  if (value >= t.blue_above) return 'var(--blue)';
  if (value >= t.warning_above) return 'var(--warning)';
  return 'var(--danger)';
}
function tip() {
  return { backgroundColor: 'rgba(18,31,107,0.94)', borderColor: 'none', borderRadius: 10, padding: [12, 16],
    textStyle: { color: '#fff', fontSize: 13, fontFamily: 'Inter, system-ui' },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.2);' };
}
function axisLbl() { return { color: '#6B7280', fontSize: 12, fontFamily: 'Inter, system-ui' }; }

// ── Chart renderer registry ────────────────────────────────────────────────
const CHART_RENDERERS = {};

function registerChart(type, fn) { CHART_RENDERERS[type] = fn; }

// Tear down every tracked ECharts instance and its ResizeObserver so charts
// from the previous tab/route don't linger in memory or keep observing
// detached DOM nodes.
function disposeAllCharts() {
  Object.keys(chartInstances).forEach(k => {
    try { chartInstances[k].dispose(); } catch (_) {}
    if (chartInstances[k] && chartInstances[k].__resizeObserver) {
      try { chartInstances[k].__resizeObserver.disconnect(); } catch (_) {}
    }
    delete chartInstances[k];
  });
}

function renderDashboardCharts(dashboard, filtered) {
  if (typeof echarts === 'undefined') return;
  disposeAllCharts();

  const localMetrics = (filtered && _projectsCache && filtered.length === _projectsCache.length) ? dashboard : _computeLocalMetrics(filtered || []);
  const activeCharts = schema.dashboard.charts.filter(c => c.tab === _activeTab);
  for (const cfg of activeCharts) {
    const fn = CHART_RENDERERS[cfg.type];
    if (!fn) {
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        console.warn('No renderer for chart.type', cfg.type, 'id=', cfg.id);
      }
      continue;
    }
    try { fn(cfg, filtered || [], localMetrics, dashboard); }
    catch (err) { console.error('Chart render error for', cfg.id, err); }
  }
}

function _initEconomicsCharts(data) {
  if (typeof echarts === 'undefined') return;
  if (!data || !data.trends || !Array.isArray(data.trends.quarterly)) return;
  const quarterly = data.trends.quarterly;
  const baseCurrency = (data.summary && data.summary.base_currency) || 'USD';

  // Skip if there's nothing to plot — leaves the empty card body without
  // killing the page (e.g. when projects exist but have no date_delivered).
  if (quarterly.length === 0) return;

  const quarters = quarterly.map(q => q.quarter);
  const fmtMoney = (v) => fmtCurrency(v, baseCurrency);

  // ── Chart 1: Quarterly revenue + cost saved (grouped bar) ──
  const revBar = ecInit('economics_quarterly_revenue');
  if (revBar) {
    revBar.setOption({
      tooltip: {
        ...tip(),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const lines = params.map(p => `${p.marker}${p.seriesName}: <b>${fmtMoney(p.value)}</b>`);
          return `<div><b>${params[0].axisValueLabel}</b></div>${lines.join('<br/>')}`;
        },
      },
      legend: { top: 0, textStyle: { color: '#6B7280', fontFamily: 'Inter, system-ui' } },
      grid: { left: 60, right: 16, top: 36, bottom: 32 },
      xAxis: { type: 'category', data: quarters, axisLabel: axisLbl() },
      yAxis: { type: 'value', axisLabel: { ...axisLbl(), formatter: (v) => fmtMoney(v) } },
      series: [
        { name: 'Revenue', type: 'bar', data: quarterly.map(q => q.revenue || 0), itemStyle: { color: '#6EC1E4' } },
        { name: 'Cost saved', type: 'bar', data: quarterly.map(q => q.cost_saved || 0), itemStyle: { color: '#10B981' } },
      ],
    });
  }

  // ── Chart 2: Margin % over time (line) ──
  const marginLine = ecInit('economics_margin_trend');
  if (marginLine) {
    marginLine.setOption({
      tooltip: {
        ...tip(),
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `<div><b>${p.axisValueLabel}</b></div>Margin: <b>${fmtPctMaybe(p.value)}</b>`;
        },
      },
      grid: { left: 50, right: 16, top: 16, bottom: 32 },
      xAxis: { type: 'category', data: quarters, axisLabel: axisLbl() },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { ...axisLbl(), formatter: (v) => `${Math.round(v * 100)}%` } },
      series: [{
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: quarterly.map(q => q.margin_pct),
        itemStyle: { color: '#121F6B' },
        lineStyle: { color: '#121F6B', width: 2 },
        areaStyle: { color: 'rgba(18,31,107,0.1)' },
      }],
    });
  }
}

function _initEconomicsTabCharts(data) {
  if (typeof echarts === 'undefined') return;
  if (!data || !data.summary) return;
  const baseCurrency = data.summary.base_currency || 'USD';
  const fmtMoney = (v) => fmtCurrency(v, baseCurrency);
  const breakdowns = data.breakdowns || {};
  const quarterly = (data.trends && Array.isArray(data.trends.quarterly)) ? data.trends.quarterly : [];

  // ── 1. Pricing model mix (donut) ──
  const byPricing = Array.isArray(breakdowns.by_pricing_model) ? breakdowns.by_pricing_model : [];
  if (byPricing.length > 0) {
    const donut = ecInit('economics_pricing_mix');
    if (donut) {
      const total = byPricing.reduce((acc, e) => acc + (e.revenue || 0), 0) || 1;
      donut.setOption({
        tooltip: {
          ...tip(),
          trigger: 'item',
          formatter: (p) => `${p.marker}<b>${esc(p.name)}</b><br/>Revenue: ${fmtMoney(p.value)}<br/>Share: ${(p.value / total * 100).toFixed(1)}%`,
        },
        legend: { orient: 'vertical', right: 8, top: 'middle', textStyle: { color: '#6B7280', fontFamily: 'Inter, system-ui' } },
        series: [{
          type: 'pie', radius: ['45%', '70%'], center: ['38%', '50%'],
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false }, labelLine: { show: false },
          data: byPricing.map(e => ({ name: e.model, value: e.revenue || 0 })),
        }],
      });
    }
  }

  // ── 2. Cost productivity by pioneer (horizontal bar, top 10 by cost_saved) ──
  const byPioneer = Array.isArray(breakdowns.by_pioneer) ? breakdowns.by_pioneer : [];
  if (byPioneer.length > 0) {
    const bar = ecInit('economics_pioneer_productivity');
    if (bar) {
      const top = byPioneer
        .slice()
        .sort((a, b) => (b.cost_saved || 0) - (a.cost_saved || 0))
        .slice(0, 10);
      bar.setOption({
        tooltip: {
          ...tip(),
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const p = params[0];
            return `<b>${esc(p.name)}</b><br/>Cost saved: ${fmtMoney(p.value)}`;
          },
        },
        grid: { left: 140, right: 16, top: 16, bottom: 32 },
        xAxis: { type: 'value', axisLabel: { ...axisLbl(), formatter: (v) => fmtMoney(v) } },
        yAxis: { type: 'category', inverse: true, data: top.map(p => p.display_name || `#${p.pioneer_id}`), axisLabel: axisLbl() },
        series: [{
          type: 'bar',
          data: top.map(p => p.cost_saved || 0),
          itemStyle: { color: '#10B981' },
          barMaxWidth: 24,
        }],
      });
    }
  }

  // ── 3. Quarterly revenue trend (full-size line) ──
  if (quarterly.length > 0) {
    const line = ecInit('economics_quarterly_revenue_full');
    if (line) {
      line.setOption({
        tooltip: {
          ...tip(),
          trigger: 'axis',
          formatter: (params) => {
            const p = params[0];
            return `<b>${esc(p.axisValueLabel)}</b><br/>Revenue: ${fmtMoney(p.value)}`;
          },
        },
        grid: { left: 70, right: 16, top: 16, bottom: 32 },
        xAxis: { type: 'category', data: quarterly.map(q => q.quarter), axisLabel: axisLbl() },
        yAxis: { type: 'value', axisLabel: { ...axisLbl(), formatter: (v) => fmtMoney(v) } },
        series: [{
          type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
          data: quarterly.map(q => q.revenue || 0),
          itemStyle: { color: '#6EC1E4' },
          lineStyle: { color: '#6EC1E4', width: 2 },
          areaStyle: { color: 'rgba(110,193,228,0.18)' },
        }],
      });
    }

    // ── 4. Quarterly cost productivity trend (dual-line: xCSG vs legacy revenue/day) ──
    const dual = ecInit('economics_quarterly_productivity');
    if (dual) {
      dual.setOption({
        tooltip: {
          ...tip(),
          trigger: 'axis',
          formatter: (params) => {
            const lines = params.map(p => `${p.marker}${p.seriesName}: <b>${fmtMoney(p.value)}</b>`);
            return `<div><b>${esc(params[0].axisValueLabel)}</b></div>${lines.join('<br/>')}`;
          },
        },
        legend: { top: 0, textStyle: { color: '#6B7280', fontFamily: 'Inter, system-ui' } },
        grid: { left: 70, right: 16, top: 36, bottom: 32 },
        xAxis: { type: 'category', data: quarterly.map(q => q.quarter), axisLabel: axisLbl() },
        yAxis: { type: 'value', axisLabel: { ...axisLbl(), formatter: (v) => fmtMoney(v) } },
        series: [
          {
            name: 'xCSG revenue / day', type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
            data: quarterly.map(q => q.revenue_per_day_xcsg),
            itemStyle: { color: '#10B981' }, lineStyle: { color: '#10B981', width: 2 },
          },
          {
            name: 'Legacy revenue / day', type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
            data: quarterly.map(q => q.revenue_per_day_legacy),
            itemStyle: { color: '#9CA3AF' }, lineStyle: { color: '#9CA3AF', width: 2, type: 'dashed' },
          },
        ],
      });
    }
  }
}

// Helper: filter to projects with metrics (used by several renderers)
function _doneProjects(filtered) {
  return filtered.filter(p => p.metrics && (p.status === 'complete' || p.status === 'partial'));
}

// ── Registered renderers ───────────────────────────────────────────────────

registerChart('scatter_disprove', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = _doneProjects(filtered);
  if (!done.length) return;
  const pts = done.map(p => {
    const m = p.metrics;
    if (m.delivery_speed == null || m.output_quality == null) return null;
    const q = (m.delivery_speed >= 1 && m.output_quality >= 1);
    return { value: [m.delivery_speed, m.output_quality], name: p.project_name, pioneer: p.pioneer_name, client: p.client_name, cat: p.category_name, good: q };
  }).filter(Boolean);
  if (!pts.length) return;
  const maxX = Math.max(...pts.map(p => p.value[0])) * 1.15;
  const maxY = Math.max(...pts.map(p => p.value[1])) * 1.15;
  s.setOption({
    tooltip: { ...tip(), trigger: 'item',
      formatter: p => { const d = pts[p.dataIndex]; return `<b style="font-size:14px">${d.name}</b><br><span style="opacity:.6">${d.pioneer} · ${d.client}</span><br><br>Speed: <b>${d.value[0]}×</b> &nbsp; Quality: <b>${d.value[1]}×</b>`; } },
    grid: { left: 55, right: 30, top: 30, bottom: 45 },
    xAxis: { type: 'value', max: maxX, name: 'Delivery Speed', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
      axisLine: { lineStyle: { color: DASHBOARD.palette.gray200 } }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: DASHBOARD.palette.gray100, type: 'dashed' } } },
    yAxis: { type: 'value', max: maxY, name: 'Output Quality', nameLocation: 'middle', nameGap: 35, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: DASHBOARD.palette.gray100, type: 'dashed' } } },
    series: [{ type: 'scatter', data: pts.map(d => ({
      value: d.value,
      symbolSize: 28,
      itemStyle: { color: d.good ? DASHBOARD.palette.green : DASHBOARD.palette.orange, borderColor: '#fff', borderWidth: 2, shadowBlur: 8, shadowColor: d.good ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)' },
    })), emphasis: { scale: 1.5, itemStyle: { shadowBlur: 16 } },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#D1D5DB', type: 'dashed', width: 1.5 },
        data: [{ xAxis: 1 }, { yAxis: 1 }] } }],
    graphic: [
      { type: 'text', right: 30, top: 15, style: { text: '✓ Thesis Validated', fill: 'rgba(16,185,129,0.5)', fontSize: 13, fontWeight: 600 } },
      { type: 'text', left: 30, bottom: 55, style: { text: '✗ Model Failing', fill: 'rgba(239,68,68,0.4)', fontSize: 13, fontWeight: 600 } },
    ],
  });
});

registerChart('radar_gains', (cfg, filtered, localMetrics) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const cap = schema.dashboard.thresholds.radar_axis_cap;
  const labels = ['Machine-First', 'Senior-Led', 'Knowledge', 'Rework Eff.', 'Client Impact', 'Data Ind.'];
  const raw = [
    localMetrics.machine_first_avg,
    localMetrics.senior_led_avg,
    localMetrics.proprietary_knowledge_avg,
    localMetrics.rework_efficiency_avg,
    localMetrics.client_impact_avg,
    localMetrics.data_independence_avg,
  ];
  const pairs = labels
    .map((l, i) => ({ l, raw: raw[i], clipped: raw[i] == null ? null : Math.min(raw[i], cap) }))
    .filter(p => p.clipped != null);
  if (!pairs.length) return;
  const pal = DASHBOARD.palette;
  s.setOption({
    tooltip: { ...DASHBOARD.tooltip, trigger: 'item',
               formatter: () => pairs.map(x =>
                 `${esc(x.l)}: <strong>${round2(x.raw)}×</strong>${x.raw > cap ? ` <em style="color:${pal.gray500}">(clipped at ${cap}×)</em>` : ''}`
               ).join('<br>') },
    legend: { ...DASHBOARD.legend, bottom: 5 },
    radar: {
      shape: 'circle',
      indicator: pairs.map(p => ({ name: `${p.l}${p.raw > cap ? ` ${cap}×+` : ''}`, max: cap })),
      axisName: { color: '#374151', fontSize: 12, fontWeight: 500 },
      splitArea: { areaStyle: { color: ['rgba(243,244,246,0.6)', 'rgba(255,255,255,0.6)'] } },
      splitLine: { lineStyle: { color: pal.gray200 } },
      axisLine:  { lineStyle: { color: pal.gray200 } },
    },
    series: [{
      type: 'radar',
      data: [
        { value: pairs.map(p => p.clipped), name: 'xCSG Average',
          areaStyle: { color: 'rgba(99,102,241,0.2)' },
          lineStyle: { color: pal.indigo, width: 3 },
          itemStyle: { color: pal.indigo, borderWidth: 2, borderColor: '#fff' },
          symbol: 'circle', symbolSize: 8 },
        { value: pairs.map(() => 1.0), name: 'Baseline (1×)',
          lineStyle: { color: pal.gray, type: 'dashed', width: 1.5 },
          itemStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' }, symbol: 'none' },
      ],
    }],
  });
});

// Merged advantage-trend + speed-vs-quality into a single 3-line chart.
registerChart('timeline_per_project', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = _doneProjects(filtered);
  if (!done.length) return;
  const sorted = [...done].sort((a, b) => new Date(a.date_delivered || a.date_started || 0) - new Date(b.date_delivered || b.date_started || 0));
  const lbl = sorted.map(p => new Date(p.date_delivered || p.date_started).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  s.setOption({
    tooltip: { ...tip(), trigger: 'axis' },
    legend: { bottom: 5, textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 18, itemHeight: 3, itemGap: 24 },
    grid: { left: 55, right: 20, top: 36, bottom: 40 },
    xAxis: { type: 'category', data: lbl, axisLine: { lineStyle: { color: DASHBOARD.palette.gray200 } }, axisTick: { show: false }, axisLabel: axisLbl() },
    yAxis: { type: 'value', name: 'Ratio', nameGap: 14, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 }, min: 0,
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: DASHBOARD.palette.gray100, type: 'dashed' } } },
    series: [
      { type: 'line', name: 'Speed', data: sorted.map(p => p.metrics.delivery_speed), smooth: 0.4, symbol: 'circle', symbolSize: 8, showSymbol: true,
        lineStyle: { color: DASHBOARD.palette.blue, width: 3 }, itemStyle: { color: DASHBOARD.palette.blue, borderWidth: 2, borderColor: '#fff' } },
      { type: 'line', name: 'Quality', data: sorted.map(p => p.metrics.output_quality), smooth: 0.4, symbol: 'circle', symbolSize: 8, showSymbol: true,
        lineStyle: { color: DASHBOARD.palette.navy, width: 3 }, itemStyle: { color: DASHBOARD.palette.navy, borderWidth: 2, borderColor: '#fff' } },
      { type: 'line', name: 'Value Gain', data: sorted.map(p => p.metrics.productivity_ratio), smooth: 0.4, symbol: 'diamond', symbolSize: 9, showSymbol: true,
        lineStyle: { color: DASHBOARD.palette.green, width: 3, type: 'dashed' }, itemStyle: { color: DASHBOARD.palette.green, borderWidth: 2, borderColor: '#fff' } },
    ],
  });
});

registerChart('scatter_schedule', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const pts = filtered
    .map(p => {
      const delta = scheduleDelta(p.date_expected_delivered, p.date_delivered);
      if (delta == null) return null;
      return { name: p.project_name, cat: p.category_name, delta, expected: p.date_expected_delivered, actual: p.date_delivered };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.actual) - new Date(b.actual));
  if (pts.length) {
    const maxAbs = Math.max(...pts.map(p => Math.abs(p.delta)), 1);
    const ySpan = Math.ceil(maxAbs * 1.2);
    s.setOption({
      tooltip: { ...tip(), trigger: 'item',
        formatter: p => { const d = pts[p.dataIndex]; return `<b style="font-size:14px">${esc(d.name)}</b><br><span style="opacity:.7">${esc(d.cat || '')}</span><br><br>Expected: <b>${d.expected}</b><br>Delivered: <b>${d.actual}</b><br>Delta: <b>${formatScheduleDelta(d.delta)}</b>`; } },
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: { type: 'category', data: pts.map((_, i) => i + 1), name: 'Project (chronological)', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
        axisLine: { lineStyle: { color: DASHBOARD.palette.gray200 } }, axisTick: { show: false }, axisLabel: { ...axisLbl(), fontSize: 10 } },
      yAxis: { type: 'value', name: 'Days (actual − expected)', nameLocation: 'middle', nameGap: 45, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
        min: -ySpan, max: ySpan,
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(),
        splitLine: { lineStyle: { color: DASHBOARD.palette.gray100, type: 'dashed' } } },
      series: [{
        type: 'scatter',
        data: pts.map((d, i) => ({
          value: [i, d.delta],
          symbolSize: 22,
          itemStyle: {
            color: d.delta <= 0 ? DASHBOARD.palette.green : (d.delta <= 3 ? DASHBOARD.palette.orange : '#EF4444'),
            borderColor: '#fff', borderWidth: 2,
            shadowBlur: 6, shadowColor: d.delta <= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.3)',
          },
        })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9CA3AF', width: 1.5 }, data: [{ yAxis: 0 }], label: { show: false } },
        emphasis: { scale: 1.4 },
      }],
      graphic: [
        { type: 'text', right: 30, top: 10, style: { text: 'Late ▲', fill: 'rgba(239,68,68,0.55)', fontSize: 12, fontWeight: 600 } },
        { type: 'text', right: 30, bottom: 60, style: { text: 'Early ▼', fill: 'rgba(16,185,129,0.55)', fontSize: 12, fontWeight: 600 } },
      ],
    });
  } else {
    s.setOption({
      graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'No projects with both expected and actual delivery dates yet.', fill: '#9CA3AF', fontSize: 13 } }],
    });
  }
});

registerChart('bar_by_category', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = _doneProjects(filtered);
  if (!done.length) return;
  const byCat = {};
  done.forEach(p => { const c = p.category_name || 'Other'; const v = p.metrics.productivity_ratio; if (v != null) { if (!byCat[c]) byCat[c] = []; byCat[c].push(v); } });
  let catE = Object.entries(byCat).map(([n, vs]) => ({ n, a: vs.reduce((a, b) => a + b, 0) / vs.length, c: vs.length })).sort((a, b) => b.a - a.a);
  const topN = schema.dashboard.thresholds.bar_top_n;
  const catMore = catE.length > topN ? catE.slice(topN) : [];
  catE = catE.slice(0, topN);
  // Auto-resize chart body height based on item count (base from cfg.height)
  const baseH = cfg.height || 260;
  const catH = Math.max(baseH, catE.length * DASHBOARD.bar.rowHeight + DASHBOARD.bar.padding);
  document.getElementById(cfg.id)?.parentElement?.parentElement?.querySelector('.chart-body')?.style.setProperty('height', catH + 'px');
  if (!catE.length) return;
  s.setOption({
    tooltip: { ...tip(), trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: ps => { const d = catE[ps[0].dataIndex]; return `<b>${d.n}</b><br>Avg: <b>${round2(d.a)}×</b> · ${d.c} project${d.c > 1 ? 's' : ''}`; } },
    grid: { left: 180, right: 50, top: 5, bottom: catMore.length ? 25 : 10 },
    xAxis: { type: 'value', min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: DASHBOARD.palette.gray100, type: 'dashed' } } },
    yAxis: { type: 'category', data: catE.map(e => e.n.length > 30 ? e.n.slice(0, 27) + '…' : e.n), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisLbl(), fontSize: 12 } },
    series: [{ type: 'bar', data: catE.map(e => ({ value: round2(e.a), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: barColor(e.a) }, { offset: 1, color: barColor(e.a) + 'AA' }]), borderRadius: [0, 5, 5, 0] } })),
      barWidth: 18, label: { show: true, position: 'right', fontSize: 11, fontWeight: 600, color: '#374151', formatter: '{c}×' },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.1)' } } }],
    graphic: catMore.length ? [{ type: 'text', right: 10, bottom: 5, style: { text: `+${catMore.length} more`, fontSize: 11, fill: DASHBOARD.palette.gray, fontStyle: 'italic' } }] : [],
  });
});

registerChart('bar_by_practice', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = _doneProjects(filtered);
  if (!done.length) return;
  const byPr = {};
  done.forEach(p => { const code = p.practice_code || 'Unassigned'; const v = p.metrics.productivity_ratio; if (v != null) { if (!byPr[code]) byPr[code] = []; byPr[code].push(v); } });
  let prE = Object.entries(byPr).map(([n, vs]) => ({ n, a: vs.reduce((a, b) => a + b, 0) / vs.length, c: vs.length })).sort((a, b) => b.a - a.a);
  const topN = schema.dashboard.thresholds.bar_top_n;
  const prMore = prE.length > topN ? prE.slice(topN) : [];
  prE = prE.slice(0, topN);
  const baseH = cfg.height || 260;
  const prH = Math.max(baseH, prE.length * DASHBOARD.bar.rowHeight + DASHBOARD.bar.padding);
  document.getElementById(cfg.id)?.parentElement?.parentElement?.querySelector('.chart-body')?.style.setProperty('height', prH + 'px');
  if (!prE.length) return;
  s.setOption({
    tooltip: { ...tip(), trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: ps => { const d = prE[ps[0].dataIndex]; return `<b>${d.n}</b><br>Avg: <b>${round2(d.a)}×</b> · ${d.c} project${d.c > 1 ? 's' : ''}`; } },
    grid: { left: 140, right: 50, top: 5, bottom: prMore.length ? 25 : 10 },
    xAxis: { type: 'value', min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: DASHBOARD.palette.gray100, type: 'dashed' } } },
    yAxis: { type: 'category', data: prE.map(e => e.n), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisLbl(), fontSize: 12 } },
    series: [{ type: 'bar', data: prE.map(e => ({ value: round2(e.a), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: barColor(e.a) }, { offset: 1, color: barColor(e.a) + 'AA' }]), borderRadius: [0, 5, 5, 0] } })),
      barWidth: 18, label: { show: true, position: 'right', fontSize: 11, fontWeight: 600, color: '#374151', formatter: '{c}×' },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.1)' } } }],
    graphic: prMore.length ? [{ type: 'text', right: 10, bottom: 5, style: { text: `+${prMore.length} more`, fontSize: 11, fill: DASHBOARD.palette.gray, fontStyle: 'italic' } }] : [],
  });
});

registerChart('bar_by_pioneer', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = _doneProjects(filtered);
  if (!done.length) return;
  const byP = {};
  done.forEach(p => { const pn = p.pioneer_name || 'Unknown'; const v = p.metrics.productivity_ratio; if (v != null) { if (!byP[pn]) byP[pn] = []; byP[pn].push(v); } });
  let pE = Object.entries(byP).map(([n, vs]) => ({ n, a: vs.reduce((a, b) => a + b, 0) / vs.length, c: vs.length })).sort((a, b) => b.a - a.a);
  const topN = schema.dashboard.thresholds.bar_top_n;
  const pMore = pE.length > topN ? pE.slice(topN) : [];
  pE = pE.slice(0, topN);
  const baseH = cfg.height || 260;
  const pH = Math.max(baseH, pE.length * DASHBOARD.bar.rowHeight + DASHBOARD.bar.padding);
  document.getElementById(cfg.id)?.parentElement?.parentElement?.querySelector('.chart-body')?.style.setProperty('height', pH + 'px');
  if (!pE.length) return;
  s.setOption({
    tooltip: { ...tip(), trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: ps => { const d = pE[ps[0].dataIndex]; return `<b>${d.n}</b><br>Avg: <b>${round2(d.a)}×</b> · ${d.c} project${d.c > 1 ? 's' : ''}`; } },
    grid: { left: 140, right: 50, top: 5, bottom: pMore.length ? 25 : 10 },
    xAxis: { type: 'value', min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: DASHBOARD.palette.gray100, type: 'dashed' } } },
    yAxis: { type: 'category', data: pE.map(e => e.n), axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl() },
    series: [{ type: 'bar', data: pE.map(e => ({ value: round2(e.a), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: barColor(e.a) }, { offset: 1, color: barColor(e.a) + 'AA' }]), borderRadius: [0, 5, 5, 0] } })),
      barWidth: 18, label: { show: true, position: 'right', fontSize: 11, fontWeight: 600, color: '#374151', formatter: '{c}×' },
      emphasis: { itemStyle: { shadowBlur: 8 } } }],
    graphic: pMore.length ? [{ type: 'text', right: 10, bottom: 5, style: { text: `+${pMore.length} more`, fontSize: 11, fill: DASHBOARD.palette.gray, fontStyle: 'italic' } }] : [],
  });
});

registerChart('donut_client_pulse', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = _doneProjects(filtered);
  if (!done.length) return;
  const pc = { 'Exceeded expectations': 0, 'Met expectations': 0, 'Below expectations': 0, 'Not yet received': 0 };
  done.forEach(p => { const v = p.client_pulse; if (pc[v] !== undefined) pc[v]++; });
  const responded = pc['Exceeded expectations'] + pc['Met expectations'] + pc['Below expectations'];
  const totalPulse = responded + pc['Not yet received'];
  if (totalPulse <= 0) return;
  const data = [
    { value: pc['Exceeded expectations'], name: 'Exceeded', itemStyle: { color: DASHBOARD.palette.green } },
    { value: pc['Met expectations'], name: 'Met', itemStyle: { color: DASHBOARD.palette.blue } },
    { value: pc['Below expectations'], name: 'Below', itemStyle: { color: DASHBOARD.palette.red } },
  ];
  if (pc['Not yet received'] > 0) data.push({ value: pc['Not yet received'], name: 'Pending', itemStyle: { color: DASHBOARD.palette.gray200 } });
  s.setOption({
    tooltip: { ...tip(), trigger: 'item',
      formatter: p => `<b>${p.name}</b><br>${p.value} project${p.value !== 1 ? "s" : ""} (${Math.round(p.percent)}%)` },
    legend: { bottom: 10, textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 14, itemHeight: 14, itemGap: 20 },
    series: [
      { type: 'pie', radius: ['50%', '75%'], center: ['50%', '45%'],
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', color: DASHBOARD.palette.navy },
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)' } },
        data },
      { type: 'pie', radius: [0, 0], center: ['50%', '45%'], silent: true,
        label: { show: true, position: 'center', formatter: `{big|${responded}/${totalPulse}}\n{sub|responded}`,
          rich: { big: { fontSize: 26, fontWeight: 800, color: DASHBOARD.palette.navy, fontFamily: 'Inter', lineHeight: 32 },
                  sub: { fontSize: 11, color: DASHBOARD.palette.gray, fontFamily: 'Inter', lineHeight: 18 } } },
        data: [{ value: 1, itemStyle: { color: 'transparent' } }] },
    ],
  });
});

registerChart('donut_reuse_intent', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = _doneProjects(filtered);
  if (!done.length) return;
  let enthusiastic = 0, reserved = 0, noReuse = 0, pending = 0;
  done.forEach(p => {
    const sc = p.metrics && p.metrics.reuse_intent_score;
    if (sc === 1.0) enthusiastic++;
    else if (sc === 0.5) reserved++;
    else if (sc != null && sc === 0) noReuse++;
    else pending++;
  });
  const responded = enthusiastic + reserved + noReuse;
  const totalReuse = responded + pending;
  if (totalReuse <= 0) return;
  const data = [
    { value: enthusiastic, name: 'Enthusiastic', itemStyle: { color: DASHBOARD.palette.green } },
    { value: reserved, name: 'Reserved', itemStyle: { color: DASHBOARD.palette.orange } },
    { value: noReuse, name: 'No', itemStyle: { color: DASHBOARD.palette.red } },
  ];
  if (pending > 0) data.push({ value: pending, name: 'Pending', itemStyle: { color: DASHBOARD.palette.gray200 } });
  s.setOption({
    tooltip: { ...tip(), trigger: 'item',
      formatter: p => `<b>${p.name}</b><br>${p.value} project${p.value !== 1 ? "s" : ""} (${Math.round(p.percent)}%)` },
    legend: { bottom: 10, textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 14, itemHeight: 14, itemGap: 20 },
    series: [
      { type: 'pie', radius: ['50%', '75%'], center: ['50%', '45%'],
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', color: DASHBOARD.palette.navy },
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)' } },
        data },
      { type: 'pie', radius: [0, 0], center: ['50%', '45%'], silent: true,
        label: { show: true, position: 'center', formatter: `{big|${responded}/${totalReuse}}\n{sub|responded}`,
          rich: { big: { fontSize: 26, fontWeight: 800, color: DASHBOARD.palette.navy, fontFamily: 'Inter', lineHeight: 32 },
                  sub: { fontSize: 11, color: DASHBOARD.palette.gray, fontFamily: 'Inter', lineHeight: 18 } } },
        data: [{ value: 1, itemStyle: { color: 'transparent' } }] },
    ],
  });
});

registerChart('track_scaling_gates', (cfg, filtered, localMetrics, dashboard) => {
  const host = document.getElementById(cfg.id);
  if (!host) return;
  const gates = dashboard.scaling_gates || [];
  if (!gates.length || (filtered && _projectsCache && filtered.length !== _projectsCache.length)) {
    // Gates are defined against the FULL dataset; when filters are active they mean nothing.
    host.innerHTML = '<div style="color:#9CA3AF;font-size:13px;padding:16px">Clear filters to see scaling-gate progress.</div>';
    return;
  }
  const passed = gates.filter(g => g.status === 'pass').length;
  const total = gates.length;
  host.innerHTML = `
    <div class="gates-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>${passed}/${total} passed</div>
      <div class="gates-progress-ring">${passed}/${total}</div>
    </div>
    <div class="gates-track">
      ${gates.map(g => {
        const ok = g.status === 'pass';
        return `<div class="gate-card ${ok ? 'gate-pass' : 'gate-pending'}">
          <div class="gate-status">${ok ? '✓' : '✕'}</div>
          <div class="gate-info">
            <div class="gate-name">${esc(g.name)}</div>
            <div class="gate-threshold">${esc(g.description || '')}</div>
            <div class="gate-detail">${esc(g.detail)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="gates-legend">
      <span class="gates-legend-item"><span class="gate-legend-icon gate-legend-pass">✓</span> Passed</span>
      <span class="gates-legend-item"><span class="gate-legend-icon gate-legend-fail">✕</span> Not yet met</span>
    </div>
  `;
});

registerChart('table_portfolio', (cfg, filtered) => {
  const host = document.getElementById(cfg.id);
  if (!host) return;
  host.style.height = 'auto';   // Table has no fixed height
  host.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table portfolio-table">
        <thead><tr>
          <th>Project</th><th>Category</th><th>Practice</th><th>Pioneers</th>
          <th title="Actual delivery vs. expected delivery.">Schedule</th>
          <th class="r" title="Legacy person-days ÷ xCSG person-days. >1× = xCSG faster.">Speed ${infoIcon('delivery_speed')}</th>
          <th class="r" title="xCSG quality ÷ legacy quality. >1× = xCSG higher quality.">Quality ${infoIcon('output_quality')}</th>
          <th class="r" title="Quality per person-day: xCSG vs legacy.">xCSG Value Gain ${infoIcon('productivity_ratio')}</th>
          <th class="r">Actions</th>
        </tr></thead>
        <tbody>
          ${filtered.map(row => {
            const m = row.metrics || {};
            const rowPioneers = row.pioneers || [];
            const rowPioneerNames = rowPioneers.map(pi => pi.display_name || pi.pioneer_name || pi.name || '').filter(Boolean);
            const pioneerDisplay = rowPioneerNames.length > 0 ? rowPioneerNames.length + ' pioneer' + (rowPioneerNames.length !== 1 ? 's' : '') : esc(row.pioneer_name || '—');
            const pioneerTooltip = rowPioneerNames.join(', ') || row.pioneer_name || '';
            const schedDelta = scheduleDelta(row.date_expected_delivered, row.date_delivered);
            const schedCell = schedDelta == null
              ? '<span style="color:var(--gray-400)">—</span>'
              : `<span class="badge ${scheduleDeltaBadgeClass(schedDelta)}" title="Expected: ${esc(row.date_expected_delivered || '')} · Delivered: ${esc(row.date_delivered || '')}">${formatScheduleDelta(schedDelta)}</span>`;
            const ratioFmt = v => v == null ? '—' : `${round2(v)}×`;
            return `<tr>
              <td><strong>${esc(row.project_name)}</strong></td>
              <td>${esc(row.category_name || '—')}</td>
              <td>${esc(row.practice_code || '—')}</td>
              <td title="${esc(pioneerTooltip)}">${pioneerDisplay}</td>
              <td>${schedCell}</td>
              <td class="r" style="color:${metricTone(m.delivery_speed)};font-weight:700">${ratioFmt(m.delivery_speed)}</td>
              <td class="r" style="color:${metricTone(m.output_quality)};font-weight:700">${ratioFmt(m.output_quality)}</td>
              <td class="r" style="color:${metricTone(m.productivity_ratio)};font-weight:800">${ratioFmt(m.productivity_ratio)}</td>
              <td class="r"><a href="#edit/${row.id}" class="table-link">Open</a></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
});

registerChart('timeline_quarterly', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = filtered.filter(p => p.metrics && p.date_delivered);
  if (!done.length) {
    s.setOption({ title: { text: 'Not enough data', left: 'center', top: 'middle', textStyle: { color: '#9CA3AF' } } });
    return;
  }
  const minQ = schema.dashboard.thresholds.quarterly_bucket_min_quarters;
  const quarterKey = d => {
    const dt = new Date(d);
    return DASHBOARD.bucket.quarterLabel(dt.getFullYear(), Math.floor(dt.getMonth() / 3) + 1);
  };
  const byQuarter = {};
  for (const p of done) {
    const k = quarterKey(p.date_delivered);
    (byQuarter[k] = byQuarter[k] || []).push(p.metrics.productivity_ratio);
  }
  let labels = Object.keys(byQuarter).sort();
  let granularity = 'quarter';
  let bucket = byQuarter;
  if (labels.length < minQ) {
    const byMonth = {};
    for (const p of done) {
      const dt = new Date(p.date_delivered);
      const k = DASHBOARD.bucket.monthLabel(dt.getFullYear(), dt.getMonth() + 1);
      (byMonth[k] = byMonth[k] || []).push(p.metrics.productivity_ratio);
    }
    labels = Object.keys(byMonth).sort();
    bucket = byMonth;
    granularity = 'month';
  }
  const avgLine  = labels.map(k => round2(bucket[k].reduce((a, b) => a + (b || 0), 0) / bucket[k].length));
  const countBar = labels.map(k => bucket[k].length);
  const pal = DASHBOARD.palette;
  s.setOption({
    tooltip: { ...DASHBOARD.tooltip, trigger: 'axis' },
    legend: { ...DASHBOARD.legend, bottom: 5 },
    grid: { left: 50, right: 50, top: 42, bottom: 50 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: pal.gray500 } },
    yAxis: [
      { type: 'value', name: 'Avg Value Gain (×)', nameGap: 14, nameTextStyle: { color: pal.gray500, fontSize: 11 }, axisLabel: { color: pal.gray500 } },
      { type: 'value', name: 'Projects', position: 'right', nameGap: 14, nameTextStyle: { color: pal.gray500, fontSize: 11 }, axisLabel: { color: pal.gray500 } },
    ],
    series: [
      { name: 'Projects',       type: 'bar', yAxisIndex: 1, data: countBar, itemStyle: { color: pal.gray200 } },
      { name: 'Avg Value Gain', type: 'line', data: avgLine, smooth: true,
        lineStyle: { color: pal.indigo, width: 3 }, itemStyle: { color: pal.indigo } },
    ],
    title: granularity === 'month'
      ? { text: `Monthly buckets (< ${schema.dashboard.thresholds.quarterly_bucket_min_quarters} quarters in range)`, left: 'right', textStyle: { fontSize: 11, color: pal.gray400 } }
      : undefined,
  });
});
registerChart('timeline_cumulative', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = filtered.filter(p => p.metrics && p.date_delivered)
    .sort((a, b) => new Date(a.date_delivered) - new Date(b.date_delivered));
  if (!done.length) {
    s.setOption({ title: { text: 'Not enough data', left: 'center', top: 'middle', textStyle: { color: '#9CA3AF' } } });
    return;
  }
  const xs = done.map((_, i) => i + 1);
  const running = { speed: [], quality: [], gain: [] };
  const sums = { speed: 0, quality: 0, gain: 0 };
  done.forEach((p, i) => {
    sums.speed   += (p.metrics.delivery_speed      || 0);
    sums.quality += (p.metrics.output_quality      || 0);
    sums.gain    += (p.metrics.productivity_ratio  || 0);
    running.speed.push(round2(sums.speed   / (i + 1)));
    running.quality.push(round2(sums.quality / (i + 1)));
    running.gain.push(round2(sums.gain    / (i + 1)));
  });
  const pal = DASHBOARD.palette;
  s.setOption({
    tooltip: { ...DASHBOARD.tooltip, trigger: 'axis' },
    legend: { ...DASHBOARD.legend, bottom: 5 },
    grid: { left: 50, right: 40, top: 42, bottom: 50 },
    xAxis: { type: 'category', data: xs, name: 'nth project', nameTextStyle: { color: pal.gray500, fontSize: 11 }, axisLabel: { color: pal.gray500 } },
    yAxis: { type: 'value', name: '× vs legacy', nameGap: 14, nameTextStyle: { color: pal.gray500, fontSize: 11 }, axisLine: { lineStyle: { color: pal.gray200 } }, axisLabel: { color: pal.gray500 } },
    series: [
      { name: 'Speed',      type: 'line', data: running.speed,   smooth: true,
        lineStyle: { color: pal.blue,    width: 2.5 }, itemStyle: { color: pal.blue } },
      { name: 'Quality',    type: 'line', data: running.quality, smooth: true,
        lineStyle: { color: pal.success, width: 2.5 }, itemStyle: { color: pal.success } },
      { name: 'Value Gain', type: 'line', data: running.gain,    smooth: true,
        lineStyle: { color: pal.indigo,  width: 3 },   itemStyle: { color: pal.indigo } },
      { type: 'line', markLine: { symbol: 'none', lineStyle: { color: pal.gray, type: 'dashed' },
        data: [{ yAxis: 1.0, label: { formatter: 'Baseline 1×', position: 'end', color: pal.gray400, fontSize: 11 } }] } },
    ],
  });
});
registerChart('cohort_learning_curve', (cfg, filtered) => {
  const host = document.getElementById(cfg.id);
  if (!host) return;
  host.innerHTML = '';  // clear previous render

  const minN = schema.dashboard.thresholds.cohort_min_projects;
  const byPractice = {};
  for (const p of filtered.filter(x => x.metrics && x.date_delivered && x.practice_code)) {
    (byPractice[p.practice_code] = byPractice[p.practice_code] || []).push(p);
  }
  const eligible = Object.entries(byPractice)
    .filter(([, arr]) => arr.length >= minN)
    .map(([code, arr]) => [code, arr.sort((a, b) => new Date(a.date_delivered) - new Date(b.date_delivered))]);

  if (!eligible.length) {
    host.style.display = 'flex';
    host.style.alignItems = 'center';
    host.style.justifyContent = 'center';
    host.style.color = DASHBOARD.palette.gray400;
    host.style.fontSize = '13px';
    host.textContent = `No practice has ≥ ${minN} projects yet.`;
    return;
  }

  host.style.display = 'grid';
  host.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
  host.style.gap = '12px';
  host.style.overflow = 'auto';

  const pal = DASHBOARD.palette;
  for (const [code, arr] of eligible) {
    const cell = document.createElement('div');
    cell.style.height = DASHBOARD.minis.cellHeight + 'px';
    cell.innerHTML = `<div style="font-size:11px;color:${pal.gray500};margin-bottom:2px">${esc(code)} (n=${arr.length})</div>`
                   + `<div class="cohort-mini" style="width:100%;height:calc(100% - 18px)"></div>`;
    host.appendChild(cell);
    const miniEl = cell.querySelector('.cohort-mini');
    const mini = echarts.init(miniEl);
    chartInstances[`${cfg.id}_${code}`] = mini;
    mini.setOption({
      grid: { left: 30, right: 6, top: 6, bottom: 24 },
      tooltip: { ...DASHBOARD.tooltip, trigger: 'axis',
                 formatter: params => {
                   const p = params[0];
                   const project = arr[p.dataIndex];
                   return `${esc(project.project_name)}<br>Value Gain: <strong>${p.value}×</strong>`;
                 } },
      xAxis: { type: 'category', data: arr.map((_, i) => i + 1), axisLabel: { fontSize: 10, color: pal.gray400 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: pal.gray400 } },
      series: [{ type: 'line',
                 data: arr.map(p => round2(p.metrics.productivity_ratio || 0)),
                 smooth: true,
                 lineStyle: { color: pal.indigo, width: 2 },
                 itemStyle: { color: pal.indigo },
                 symbolSize: 6 }],
    });
  }
});
registerChart('heatmap_practice_quarter', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = filtered.filter(p => p.metrics && p.date_delivered && p.practice_code);
  if (!done.length) {
    s.setOption({ title: { text: 'Not enough data', left: 'center', top: 'middle', textStyle: { color: '#9CA3AF' } } });
    return;
  }
  const quarterOf = d => {
    const dt = new Date(d);
    return DASHBOARD.bucket.quarterLabel(dt.getFullYear(), Math.floor(dt.getMonth() / 3) + 1);
  };
  const quarters = [...new Set(done.map(p => quarterOf(p.date_delivered)))].sort();
  const practices = [...new Set(done.map(p => p.practice_code))].sort();
  const cell = {};
  for (const p of done) {
    const q = quarterOf(p.date_delivered);
    const key = `${p.practice_code}__${q}`;
    (cell[key] = cell[key] || []).push(p.metrics.productivity_ratio || 0);
  }
  const data = [];
  practices.forEach((pc, y) => quarters.forEach((q, x) => {
    const arr = cell[`${pc}__${q}`] || [];
    if (arr.length) data.push([x, y, round2(arr.reduce((a, b) => a + b, 0) / arr.length), arr.length]);
  }));
  const values = data.map(d => d[2]);
  const pal = DASHBOARD.palette;
  // Cap the visual scale so one outlier doesn't squash everything to the low colour.
  // Below baseline (1×) = red, above baseline = green gradient. Clip at radar_axis_cap for readability.
  const cap = schema.dashboard.thresholds.radar_axis_cap;
  const vmMin = 0;
  const vmMax = cap;
  s.setOption({
    tooltip: { ...DASHBOARD.tooltip,
               formatter: p => `${esc(practices[p.data[1]])} · ${esc(quarters[p.data[0]])}<br>Value Gain: <strong>${p.data[2]}×</strong>${p.data[2] > cap ? ` <em style="color:${pal.gray500}">(clipped at ${cap}×)</em>` : ''}<br>Projects: ${p.data[3]}` },
    grid: { left: 80, right: 30, top: 20, bottom: 72 },
    xAxis: { type: 'category', data: quarters, axisLabel: { color: pal.gray500 }, splitArea: { show: true } },
    yAxis: { type: 'category', data: practices, axisLabel: { color: pal.gray500 }, splitArea: { show: true } },
    visualMap: {
      min: vmMin, max: vmMax,
      calculable: true, orient: 'horizontal', bottom: 8, left: 'center',
      itemWidth: 14, itemHeight: 180,
      text: [`≥ ${vmMax}× (strong)`, `${vmMin}× (weak)`],
      textStyle: { color: pal.gray500, fontSize: 11 },
      inRange: { color: ['#fee2e2', '#fed7aa', '#fef3c7', '#d1fae5', '#86efac', '#10b981'] },
    },
    series: [{
      type: 'heatmap', data,
      // Plot clipped value for colour, real number for label.
      label: { show: true, formatter: p => p.data[2] + '×', fontSize: 12, fontWeight: 600, color: '#111827' },
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: pal.navy, borderWidth: 2 } },
    }],
    // ECharts colours heatmap by data[2] (the raw avg); clip it by feeding the capped value instead.
    // (Simpler: map the data array to clip — but keeping raw value in tooltip and label requires
    //  explicit clip via series.data remap below.)
  });
  // Feed clipped values for colour mapping while preserving raw values in label/tooltip via itemStyle.color
  // Simpler approach: overwrite the series data with clipped value stored in [x, y, min(v, cap), count, rawV]
  const clippedData = data.map(d => [d[0], d[1], Math.min(d[2], cap), d[3], d[2]]);
  s.setOption({
    series: [{ data: clippedData,
               label: { show: true, formatter: p => (p.data[4] ?? p.data[2]) + '×', fontSize: 12, fontWeight: 600, color: '#111827' } }],
    tooltip: { ...DASHBOARD.tooltip,
               formatter: p => `${esc(practices[p.data[1]])} · ${esc(quarters[p.data[0]])}<br>Value Gain: <strong>${p.data[4] ?? p.data[2]}×</strong>${(p.data[4] ?? p.data[2]) > cap ? ` <em style="color:${pal.gray500}">(colour clipped at ${cap}×)</em>` : ''}<br>Projects: ${p.data[3]}` },
  });
});
function _renderRankedList(cfg, filtered, ordering) {
  const host = document.getElementById(cfg.id);
  if (!host) return;
  host.innerHTML = '';
  const done = filtered.filter(p => p.metrics && p.metrics.productivity_ratio != null);
  if (!done.length) {
    host.innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;color:${DASHBOARD.palette.gray400};font-size:13px">Not enough data yet</div>`;
    return;
  }
  const sorted = [...done].sort((a, b) =>
    ordering === 'desc'
      ? (b.metrics.productivity_ratio - a.metrics.productivity_ratio)
      : (a.metrics.productivity_ratio - b.metrics.productivity_ratio)
  );
  const top = sorted.slice(0, 5);
  const pal = DASHBOARD.palette;
  host.innerHTML = `
    <ol class="ranked-list">
      ${top.map((p, i) => {
        const v = round2(p.metrics.productivity_ratio);
        const color = v > 1.5 ? pal.success : v >= 1 ? pal.blue : v >= 0.8 ? pal.warning : pal.danger;
        return `
          <li class="ranked-list-item">
            <span class="ranked-list-rank">${i + 1}</span>
            <a href="#edit/${p.id}" class="ranked-list-name" title="${esc(p.project_name)}">${esc(p.project_name)}</a>
            <span class="ranked-list-meta">${esc(p.practice_code || '—')}</span>
            <span class="ranked-list-value" style="color:${color}">${v}×</span>
          </li>`;
      }).join('')}
    </ol>`;
}

registerChart('ranked_list_top',    (cfg, filtered) => _renderRankedList(cfg, filtered, 'desc'));
registerChart('ranked_list_bottom', (cfg, filtered) => _renderRankedList(cfg, filtered, 'asc'));

registerChart('timeline_effort', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = filtered.filter(p => p.date_delivered && p.metrics && p.metrics.xcsg_person_days != null);
  if (!done.length) {
    s.setOption({ title: { text: 'Not enough data', left: 'center', top: 'middle', textStyle: { color: '#9CA3AF' } } });
    return;
  }
  const quarterOf = d => {
    const dt = new Date(d);
    return DASHBOARD.bucket.quarterLabel(dt.getFullYear(), Math.floor(dt.getMonth() / 3) + 1);
  };
  const byQ = {};
  for (const p of done) {
    const k = quarterOf(p.date_delivered);
    (byQ[k] = byQ[k] || []).push(p.metrics.xcsg_person_days);
  }
  const labels = Object.keys(byQ).sort();
  const xcsgAvg = labels.map(k => round2(byQ[k].reduce((a,b)=>a+b,0) / byQ[k].length));
  // Also include avg of legacy person-days per project per quarter if available
  const byQLegacy = {};
  for (const p of done) {
    if (p.metrics && p.metrics.legacy_person_days != null) {
      const k = quarterOf(p.date_delivered);
      (byQLegacy[k] = byQLegacy[k] || []).push(p.metrics.legacy_person_days);
    }
  }
  const legacyAvg = labels.map(k => (byQLegacy[k] && byQLegacy[k].length) ? round2(byQLegacy[k].reduce((a,b)=>a+b,0) / byQLegacy[k].length) : null);

  const pal = DASHBOARD.palette;
  s.setOption({
    tooltip: { ...DASHBOARD.tooltip, trigger: 'axis' },
    legend: { ...DASHBOARD.legend, bottom: 5 },
    grid: { left: 50, right: 30, top: 42, bottom: 50 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: pal.gray500 } },
    yAxis: { type: 'value', name: 'Person-days', nameGap: 14, nameTextStyle: { color: pal.gray500, fontSize: 11 }, axisLabel: { color: pal.gray500 } },
    series: [
      { name: 'xCSG',   type: 'line', data: xcsgAvg,   smooth: true,
        lineStyle: { color: pal.indigo, width: 3 }, itemStyle: { color: pal.indigo } },
      { name: 'Legacy', type: 'line', data: legacyAvg, smooth: true,
        lineStyle: { color: pal.gray, width: 2, type: 'dashed' }, itemStyle: { color: pal.gray } },
    ],
  });
});

registerChart('area_category_mix', (cfg, filtered) => {
  const s = ecInit(cfg.id);
  if (!s) return;
  const done = filtered.filter(p => p.date_delivered && p.category_name);
  if (!done.length) {
    s.setOption({ title: { text: 'Not enough data', left: 'center', top: 'middle', textStyle: { color: '#9CA3AF' } } });
    return;
  }
  const topN = schema.dashboard.thresholds.bar_top_n;
  const catCounts = {};
  for (const p of done) catCounts[p.category_name] = (catCounts[p.category_name] || 0) + 1;
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0]);
  const otherLabel = 'Other';
  const norm = name => topCats.includes(name) ? name : otherLabel;

  const byQuarter = {};
  for (const p of done) {
    const dt = new Date(p.date_delivered);
    const q = DASHBOARD.bucket.quarterLabel(dt.getFullYear(), Math.floor(dt.getMonth() / 3) + 1);
    byQuarter[q] = byQuarter[q] || {};
    const c = norm(p.category_name);
    byQuarter[q][c] = (byQuarter[q][c] || 0) + 1;
  }
  const quarters = Object.keys(byQuarter).sort();
  const cats = [
    ...topCats,
    ...(Object.values(byQuarter).some(q => q[otherLabel]) ? [otherLabel] : []),
  ];
  const pal = DASHBOARD.palette;
  const series = cats.map((c, i) => ({
    name: c,
    type: 'line',
    stack: 'mix',
    areaStyle: {},
    data: quarters.map(q => (byQuarter[q] || {})[c] || 0),
    lineStyle: { width: 0 },
    itemStyle: { color: pal.series[i % pal.series.length] },
    emphasis: { focus: 'series' },
    showSymbol: false,
  }));
  s.setOption({
    tooltip: { ...DASHBOARD.tooltip, trigger: 'axis' },
    legend: { ...DASHBOARD.legend, bottom: 0, type: 'scroll' },
    grid: { left: 50, right: 30, top: 42, bottom: 60 },
    xAxis: { type: 'category', data: quarters, boundaryGap: false, axisLabel: { color: pal.gray500 } },
    yAxis: { type: 'value', name: 'Projects', nameGap: 14, nameTextStyle: { color: pal.gray500, fontSize: 11 }, axisLabel: { color: pal.gray500 } },
    series,
  });
});


/* ═══════════════════════════════════════════════════════════════════════════
   EXPERT FORM — 27-field Accordion (standalone, no auth)
   ═══════════════════════════════════════════════════════════════════════════ */

function _expertLocalStorageKey(token, round) {
  return 'xcsg_expert_' + token + '_r' + (round || 1);
}

function _expertSaveToStorage(token, round, formData) {
  try { localStorage.setItem(_expertLocalStorageKey(token, round), JSON.stringify(formData)); } catch {}
}
function _expertLoadFromStorage(token, round) {
  try { const raw = localStorage.getItem(_expertLocalStorageKey(token, round)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function _expertClearStorage(token, round) {
  try { localStorage.removeItem(_expertLocalStorageKey(token, round)); } catch {}
}

// Section metadata for accordion
// EXPERT_SECTIONS removed — now served from /api/schema via getExpertSections()

// Sections that carry pioneer answers (A is project context, not survey answers).
const _PREV_SECTIONS_IN_ORDER = ['B', 'C', 'D', 'E', 'F', 'G', 'L'];

function _formatSubmittedDate(iso) {
  if (!iso) return '';
  // Accept "2026-04-22T14:08:00Z" or "2026-04-22 14:08:00" — first 10 chars are the date.
  const s = String(iso);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Render a <details> accordion grouping expert responses by schema section.
 * `responses` = array of response rows. Each row may contain: round_number,
 * submitted_at, pioneer_name (optional, cross-pioneer rendering), plus field keys.
 * Fields are looked up in `schema.fields` and grouped by `schema.fields[key].section`.
 * Rows without schema.fields entries (id, pioneer_id, project_id, created_at,
 * submitted_at, round_number, pioneer_name, ...) are skipped automatically.
 * Empty / null / undefined values are skipped.
 */
function renderResponseAccordion(heading, responses) {
  if (!responses || !responses.length) return '';
  const fieldDefs = (schema && schema.fields) ? schema.fields : {};
  const sectionDefs = (schema && schema.sections) ? schema.sections : {};

  let out = '<details class="previous-responses"><summary>' + esc(heading) + '</summary>';
  out += '<div class="prev-content">';

  for (const r of responses) {
    const roundNum = r.round_number != null ? r.round_number : '?';
    const dateStr = _formatSubmittedDate(r.submitted_at);
    const pioneerPrefix = r.pioneer_name ? esc(r.pioneer_name) + ' · ' : '';
    const headerBits = [];
    headerBits.push('Round ' + esc(String(roundNum)));
    if (dateStr) headerBits.push('submitted ' + esc(dateStr));

    out += '<div class="prev-round">';
    out += '<div class="prev-round-header">' + pioneerPrefix + headerBits.join(' · ') + '</div>';

    for (const secKey of _PREV_SECTIONS_IN_ORDER) {
      const secMeta = sectionDefs[secKey];
      if (!secMeta) continue;
      // Collect populated fields from r that belong to this section.
      const keys = Object.keys(r).filter(k => {
        const fd = fieldDefs[k];
        if (!fd || fd.section !== secKey) return false;
        const v = r[k];
        return v !== null && v !== undefined && v !== '';
      });
      if (!keys.length) continue;

      out += '<div class="prev-section">';
      out += '<div class="prev-section-title">'
        + (secMeta.icon ? esc(secMeta.icon) + ' ' : '')
        + esc(secKey) + ' — ' + esc(secMeta.title)
        + '</div>';
      out += '<dl class="prev-fields">';
      for (const k of keys) {
        const label = fieldDefs[k].label || k;
        out += '<dt>' + esc(label) + '</dt>';
        out += '<dd>' + esc(String(r[k])) + '</dd>';
      }
      out += '</dl>';
      out += '</div>';
    }

    out += '</div>';
  }

  out += '</div></details>';
  return out;
}

async function renderExpert(token) {
  const ec = document.getElementById('expertContent');
  ec.innerHTML = '<div class="loading">Loading assessment\u2026</div>';

  try {
    const [ctx, optionsResp] = await Promise.all([
      apiCall('GET', '/expert/' + token),
      apiCall('GET', '/expert/options'),
      loadSchema(),
    ]);

    if (ctx.already_completed) {
      ec.innerHTML = '<div class="expert-thankyou"><div class="thankyou-icon">&#10003;</div><h2>Already Submitted</h2><p>This assessment has already been submitted. Your responses have been recorded.</p></div>';
      return;
    }

    // Parse options into sections
    const sectionsMap = {};
    const sectionOrder = ['B', 'C', 'D', 'E', 'F', 'G', 'L'];
    let totalFields = 0;

    for (const secKey of sectionOrder) {
      sectionsMap[secKey] = [];
    }

    // Iterate all fields from API response
    for (const [key, fieldDef] of Object.entries(optionsResp)) {
      const sec = fieldDef.section;
      if (sec && sectionsMap[sec]) {
        sectionsMap[sec].push({
          key: key,
          label: fieldDef.label || key,
          options: fieldDef.options || [],
          type: fieldDef.type || 'categorical',
          section: sec,
        });
        totalFields++;
      }
    }

    // Restore from localStorage
    const currentRound = ctx.current_round || 1;
    const saved = _expertLoadFromStorage(token, currentRound);

    // Build HTML
    let html = '';

    // Section A — Context
    html += '<div class="expert-section-card">';
    html += '<div class="accordion-section-label" style="font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Section A \u2014 Context</div>';
    html += '<div class="context-title">' + esc(ctx.project_name) + '</div>';
    html += '<div class="context-subtitle">' + esc(ctx.category_name) + (ctx.client_name ? ' \u00b7 ' + esc(ctx.client_name) : '') + '</div>';
    if (ctx.description) html += '<p class="context-description">' + esc(ctx.description) + '</p>';
    html += '<div class="context-grid">';
    html += '<div class="context-item"><span class="label">A1 \u2014 Deliverable Type</span><span class="value">' + esc(ctx.category_name) + '</span></div>';
    html += '<div class="context-item"><span class="label">Practice</span><span class="value">' + esc(ctx.practice_code || '\u2014') + '</span></div>';
    html += '<div class="context-item"><span class="label">A2 \u2014 Engagement Stage</span><span class="value">' + esc(ctx.engagement_stage || '\u2014') + '</span></div>';
    html += '<div class="context-item"><span class="label">Pioneer</span><span class="value">' + esc(ctx.pioneer_name) + '</span></div>';
    html += '<div class="context-item"><span class="label">Timeline</span><span class="value">' + esc(ctx.date_started || '?') + ' \u2192 ' + esc(ctx.date_delivered || '?') + '</span></div>';
    html += '<div class="context-item"><span class="label">Team Size</span><span class="value">' + esc(ctx.xcsg_team_size) + '</span></div>';
    html += '<div class="context-item"><span class="label">Calendar Days</span><span class="value">' + esc(ctx.xcsg_calendar_days || '\u2014') + '</span></div>';
    html += '</div></div>';

    // Round info header (only show if multi-round)
    if (ctx.total_rounds > 1) {
      const remaining = Math.max(ctx.total_rounds - ctx.current_round, 0);
      html += '<div class="expert-round-info">'
        + '<strong>Round ' + ctx.current_round + ' of ' + ctx.total_rounds + '</strong>'
        + '<span style="color:var(--gray-500);margin-left:8px">(' + remaining + ' remaining after this)</span>'
        + '</div>';
    }

    // Previous responses (same pioneer, earlier rounds)
    if (ctx.show_previous && ctx.previous_responses && ctx.previous_responses.length) {
      const n = ctx.previous_responses.length;
      const heading = 'View Your Previous Responses (' + n + ' round' + (n === 1 ? '' : 's') + ')';
      html += renderResponseAccordion(heading, ctx.previous_responses);
    }

    // Other pioneers' submitted responses (cross-pioneer visibility)
    if (ctx.show_other_pioneers && ctx.other_pioneers_responses && ctx.other_pioneers_responses.length) {
      const n = ctx.other_pioneers_responses.length;
      const heading = "View Other Pioneers' Responses (" + n + ')';
      html += renderResponseAccordion(heading, ctx.other_pioneers_responses);
    }

    // Sticky progress bar
    html += '<div class="accordion-progress-bar"><div class="accordion-progress-inner">';
    html += '<div class="accordion-progress-track"><div class="accordion-progress-fill" id="expertProgressBar" style="width:0%"></div></div>';
    html += '<span id="expertProgressLabel" class="accordion-progress-label">0/' + totalFields + ' fields completed</span>';
    html += '</div></div>';

    // Accordion sections
    html += '<div id="expertAccordion">';
    for (let si = 0; si < sectionOrder.length; si++) {
      const secKey = sectionOrder[si];
      const secMeta = getExpertSections()[secKey];
      const secFields = sectionsMap[secKey];
      if (!secFields || secFields.length === 0) continue;

      html += '<div class="accordion-header" data-section="' + secKey + '" onclick="_expertToggleAccordion(\'' + secKey + '\')">';
      html += '<div class="accordion-header-left">';
      html += '<span class="accordion-chevron">\u25B6</span>';
      html += '<span class="accordion-section-icon" data-section="' + secKey + '">' + (secMeta.icon || '') + '</span>';
      html += '<div class="accordion-title-wrap">';
      html += '<span class="accordion-section-title">Section ' + esc(secKey) + ' \u2014 ' + esc(secMeta.title) + '</span>';
      html += '<span class="accordion-section-desc-inline">' + esc(secMeta.desc) + '</span>';
      html += '</div>';
      html += '<span class="accordion-count">0/' + secFields.length + '</span>';
      html += '</div></div>';

      html += '<div class="accordion-section" data-section="' + secKey + '">';

      // Helper text for Section L
      if (secKey === 'L') {
        html += '<div class="expert-section-note">For each question below, estimate what would have been typical if this deliverable had been done using traditional methods, without AI assistance, for this specific project.</div>';
      }

      for (let fi = 0; fi < secFields.length; fi++) {
        const f = secFields[fi];
        const savedVal = saved ? (saved[f.key] || '') : '';
        const isInteger = f.type === 'integer';

        html += '<div class="accordion-question">';
        html += '<div class="accordion-question-label">' + esc(f.label) + '</div>';

        if (isInteger) {
          // Integer input for L1
          html += '<input type="number" class="accordion-field expert-input" data-key="' + esc(f.key) + '" data-section="' + esc(secKey) + '" min="1" step="1" placeholder="Enter number of working days" value="' + esc(savedVal) + '" style="width:100%;padding:12px 14px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif;outline:none;transition:border-color 0.2s,box-shadow 0.2s;min-height:48px">';
        } else {
          // Dropdown
          html += '<select class="accordion-field expert-select" data-key="' + esc(f.key) + '" data-section="' + esc(secKey) + '" required style="width:100%;padding:12px 14px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif;cursor:pointer;outline:none;transition:border-color 0.2s,box-shadow 0.2s;min-height:48px">';
          html += '<option value="">\u2014 Select \u2014</option>';
          for (const opt of f.options) {
            const sel = savedVal === opt ? ' selected' : '';
            html += '<option value="' + esc(opt) + '"' + sel + '>' + esc(opt) + '</option>';
          }
          html += '</select>';
        }

        html += '</div>';
      }

      html += '</div>'; // close accordion-section
    }

    // Optional free-form notes (visible to admins/analysts, included in Excel export)
    const savedNotes = (saved && saved.__notes) ? saved.__notes : '';
    html += '<div class="expert-notes-section">'
      + '<label for="expertNotesField" class="expert-notes-label">Notes <span class="expert-notes-optional">(optional)</span></label>'
      + '<p class="expert-notes-help">Anything else the team should know about this engagement — client context, what worked, what didn\'t. Notes are visible to admins and analysts and included in exports.</p>'
      + '<textarea id="expertNotesField" class="expert-notes-textarea" rows="5" placeholder="Share any context, observations, or lessons…">' + esc(savedNotes) + '</textarea>'
      + '<div class="expert-notes-counter"><span id="expertNotesCount">' + savedNotes.length + '</span> characters</div>'
      + '</div>';

    // Submit area
    html += '<div class="accordion-submit-area">';
    html += '<span class="time-hint">Takes approximately 6\u20137 minutes</span>';
    html += '<button type="button" class="btn btn-primary" id="expertSubmitBtn" disabled>Submit Assessment (0/' + totalFields + ')</button>';
    html += '</div>';

    ec.innerHTML = html;

    // Wire field change handlers
    const allFields = document.querySelectorAll('.accordion-field');
    for (let i = 0; i < allFields.length; i++) {
      const el = allFields[i];
      el.addEventListener('change', function() {
        _expertSaveToStorage(token, currentRound, _expertGetFieldValues());
        _expertUpdateProgress(totalFields);
      });
      el.addEventListener('input', function() {
        _expertSaveToStorage(token, currentRound, _expertGetFieldValues());
        _expertUpdateProgress(totalFields);
      });
      el.addEventListener('focus', function() {
        this.style.borderColor = 'var(--blue)';
        this.style.boxShadow = '0 0 0 3px rgba(110,193,228,0.15)';
      });
      el.addEventListener('blur', function() {
        this.style.borderColor = 'var(--gray-300)';
        this.style.boxShadow = 'none';
      });
    }

    // Wire notes textarea: char counter + persist across reloads
    const notesField = document.getElementById('expertNotesField');
    const notesCount = document.getElementById('expertNotesCount');
    if (notesField && notesCount) {
      notesField.addEventListener('input', function() {
        notesCount.textContent = notesField.value.length;
        const vals = _expertGetFieldValues();
        vals.__notes = notesField.value;
        _expertSaveToStorage(token, currentRound, vals);
      });
    }

    // Submit
    document.getElementById('expertSubmitBtn').addEventListener('click', async function() {
      const btn = document.getElementById('expertSubmitBtn');
      const filled = _expertCountFilled();
      if (filled < totalFields) return;
      btn.disabled = true;
      btn.textContent = 'Submitting\u2026';

      // Build flat key-value payload
      const fieldValues = _expertGetFieldValues();
      const payload = {};
      for (const [key, val] of Object.entries(fieldValues)) {
        if (val === '' || val == null) continue;
        // L1 is integer
        if (key === 'l1_legacy_working_days') {
          payload[key] = parseInt(val);
        } else {
          payload[key] = val;
        }
      }
      // Optional free-form notes — empty string becomes null to avoid DB noise.
      const notesEl = document.getElementById('expertNotesField');
      payload.notes = (notesEl && notesEl.value.trim()) ? notesEl.value.trim() : null;

      try {
        const result = await apiCall('POST', '/expert/' + token, payload);
        _expertClearStorage(token, currentRound);
        if (result.already_completed) {
          ec.innerHTML = '<div class="expert-thankyou"><div class="thankyou-icon">&#10003;</div><h2>Already Submitted</h2><p>This round has already been recorded.</p></div>';
        } else {
          const m = result.metrics || {};
          const fmtX = v => v != null ? (Math.round(v * 100) / 100) + '\xd7' : '\u2014';
          const scoreColor = v => v == null ? '#9CA3AF' : v >= 2 ? '#10B981' : v >= 1 ? '#3B82F6' : v >= 0.5 ? '#F59E0B' : '#EF4444';
          const curR = result.current_round;
          const totR = result.total_rounds;
          const isMultiRound = curR && totR && totR > 1;
          const hasMoreRounds = isMultiRound && curR < totR;
          const heading = hasMoreRounds
            ? 'Round ' + curR + ' of ' + totR + ' Complete'
            : 'Thank You!';
          const intro = hasMoreRounds
            ? 'Your responses for this round have been recorded. Here is a summary of the three flywheel scores computed from your answers.'
            : 'Your assessment has been recorded. Here is a summary of the three flywheel scores computed from your responses.';

          let thankYou = '<div class="expert-thankyou">'
            + '<div class="thankyou-icon">&#10003;</div>'
            + '<h2>' + esc(heading) + '</h2>'
            + '<p>' + esc(intro) + '</p>'
            + '<div class="expert-results-section">'
            + '<h3 style="color:#121F6B;margin:24px 0 8px;font-size:16px">How these scores are calculated</h3>'
            + '<p style="color:#6B7280;font-size:13px;margin-bottom:20px">Each score compares your xCSG responses (Sections B\u2013D) against your legacy estimates (Section L). A value of 1\xd7 means parity; above 1\xd7 means xCSG outperformed legacy on that dimension.</p>'
            + '</div>'
            + '<div class="accordion-metrics-preview">'

            + '<div class="accordion-metric">'
            + '<div class="accordion-metric-value" style="color:' + scoreColor(m.machine_first_score) + '">' + fmtX(m.machine_first_score) + '</div>'
            + '<div class="accordion-metric-label">Machine-First Gain ' + infoIcon('machine_first_score') + '</div>'
            + '<div class="accordion-metric-explain">Breadth of knowledge synthesis: xCSG vs legacy. Compares your B2 answer (sources synthesized) against your L6 answer (what legacy would have used).</div>'
            + '</div>'

            + '<div class="accordion-metric">'
            + '<div class="accordion-metric-value" style="color:' + scoreColor(m.senior_led_score) + '">' + fmtX(m.senior_led_score) + '</div>'
            + '<div class="accordion-metric-label">Senior-Led Gain ' + infoIcon('senior_led_score') + '</div>'
            + '<div class="accordion-metric-explain">Average of three comparisons: specialization depth (C1 vs L7), directness of authorship (C2 vs L8), and expert judgment time (C3 vs L9).</div>'
            + '</div>'

            + '<div class="accordion-metric">'
            + '<div class="accordion-metric-value" style="color:' + scoreColor(m.proprietary_knowledge_score) + '">' + fmtX(m.proprietary_knowledge_score) + '</div>'
            + '<div class="accordion-metric-label">Knowledge Gain ' + infoIcon('proprietary_knowledge_score') + '</div>'
            + '<div class="accordion-metric-explain">Average of three comparisons: proprietary data use (D1 vs L10), knowledge reuse (D2 vs L11), and competitive moat (D3 vs L12).</div>'
            + '</div>'

            + '</div>';

          // Auto-advance: if the backend issued a next-round token, show a CTA
          // that takes the pioneer directly to Round N+1.
          if (result.next_round_token) {
            const nextRound = (curR || 1) + 1;
            const ofTotal = totR ? ' of ' + totR : '';
            thankYou += '<div class="expert-next-round-cta">'
              + '<a href="#assess/' + esc(result.next_round_token) + '" class="btn btn-primary expert-next-round-btn">'
              + 'Start Round ' + nextRound + ofTotal + ' \u2192'
              + '</a>'
              + '</div>';
          } else if (hasMoreRounds) {
            // Fallback: multi-round project where the next token was NOT auto-issued
            // (e.g. a defensive backend race). Preserve the original "check later" notice.
            thankYou += '<p style="margin-top:16px;color:var(--gray-600)">You will receive a new assessment link when the next round is scheduled by the PMO team.</p>';
          }

          thankYou += '</div>';
          ec.innerHTML = thankYou;
        }
      } catch (err) {
        if (err.status === 422 && err.detail && Array.isArray(err.detail.missing_fields)) {
          const missing = err.detail.missing_fields;
          showToast('Please answer all ' + missing.length + ' required question' + (missing.length === 1 ? '' : 's') + ' before submitting.', 'error');
          document.querySelectorAll('.accordion-field').forEach(el => el.classList.remove('field-missing'));
          missing.forEach(key => {
            const el = document.querySelector('.accordion-field[data-key="' + key + '"]');
            if (el) el.classList.add('field-missing');
          });
          const first = document.querySelector('.field-missing');
          if (first) {
            const sec = first.closest('.accordion-section');
            if (sec && !sec.classList.contains('open')) {
              _expertToggleAccordion(sec.dataset.section);
            }
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          showToast(err.message, 'error');
        }
        btn.disabled = false;
        _expertUpdateProgress(totalFields);
      }
    });

    // Initial progress
    _expertUpdateProgress(totalFields);

  } catch (err) {
    if (err.message.includes('404') || err.message.includes('invalid')) {
      ec.innerHTML = '<div class="expert-error"><h2>Invalid Link</h2><p>This expert assessment link is invalid or has expired. Please contact the PMO team for a new link.</p></div>';
    } else {
      ec.innerHTML = '<div class="expert-error"><h2>Connection Error</h2><p>Unable to load the assessment. Please check your connection and try again.</p><button class="btn btn-primary" onclick="renderExpert(\'' + esc(token) + '\')">Retry</button></div>';
    }
  }
}

function _expertGetFieldValues() {
  const values = {};
  document.querySelectorAll('.accordion-field').forEach(el => {
    values[el.dataset.key] = el.value;
  });
  return values;
}

function _expertCountFilled() {
  let count = 0;
  document.querySelectorAll('.accordion-field').forEach(el => {
    if (el.value !== '' && el.value != null) count++;
  });
  return count;
}

function _expertUpdateProgress(totalFields) {
  const filled = _expertCountFilled();
  const pct = Math.round((filled / totalFields) * 100);
  const bar = document.getElementById('expertProgressBar');
  const label = document.getElementById('expertProgressLabel');
  const btn = document.getElementById('expertSubmitBtn');
  if (bar) bar.style.width = pct + '%';
  if (bar) {
    bar.style.background = filled >= totalFields ? 'linear-gradient(90deg, var(--success), #34D399)' : 'linear-gradient(90deg, var(--navy), var(--navy-light))';
    bar.classList.toggle('complete', filled >= totalFields);
  }
  if (label) label.textContent = filled + '/' + totalFields + ' fields completed';
  if (btn) {
    btn.textContent = 'Submit Assessment (' + filled + '/' + totalFields + ')';
    btn.disabled = filled < totalFields;
  }
  document.querySelectorAll('.accordion-section').forEach(sec => {
    const secKey = sec.dataset.section;
    const fields = sec.querySelectorAll('.accordion-field');
    let secFilled = 0;
    fields.forEach(f => { if (f.value !== '' && f.value != null) secFilled++; });
    const header = document.querySelector('.accordion-header[data-section="' + secKey + '"]');
    if (header) {
      const countEl = header.querySelector('.accordion-count');
      if (countEl) {
        const total = fields.length;
        countEl.textContent = secFilled + '/' + total + (secFilled === total ? ' \u2713' : '');
        if (secFilled === total) countEl.classList.add('accordion-count-complete');
        else countEl.classList.remove('accordion-count-complete');
      }
    }
  });
}

function _expertToggleAccordion(sectionKey) {
  const wasOpen = document.querySelector('.accordion-section.open[data-section="' + sectionKey + '"]');
  document.querySelectorAll('.accordion-section.open').forEach(s => s.classList.remove('open'));
  document.querySelectorAll('.accordion-header.open').forEach(h => h.classList.remove('open'));
  if (!wasOpen) {
    const sec = document.querySelector('.accordion-section[data-section="' + sectionKey + '"]');
    const hdr = document.querySelector('.accordion-header[data-section="' + sectionKey + '"]');
    if (sec) sec.classList.add('open');
    if (hdr) hdr.classList.add('open');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MONITORING PAGE
   ═══════════════════════════════════════════════════════════════════════ */

async function renderMonitoring() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading monitoring data\u2026</div>';
  try {
    const data = await apiCall('GET', '/monitoring');
    const projects = data.projects || [];

    // KPI cards
    let html = '<div class="metrics-grid" style="margin-bottom:24px">';
    html += '<div class="metric-tile"><div class="metric-tile-icon">\ud83d\udccb</div><div class="metric-tile-value" style="color:var(--navy)">' + data.total_projects + '</div><div class="metric-tile-label">Total Projects</div></div>';
    html += '<div class="metric-tile"><div class="metric-tile-icon">\u23f3</div><div class="metric-tile-value" style="color:var(--warning)">' + data.total_pending_responses + '</div><div class="metric-tile-label">Pending Responses</div></div>';
    html += '<div class="metric-tile"><div class="metric-tile-icon">\u2705</div><div class="metric-tile-value" style="color:var(--success)">' + data.completion_rate + '%</div><div class="metric-tile-label">Completion Rate</div></div>';
    html += '</div>';

    // Filter
    html += '<div style="display:flex;gap:12px;margin-bottom:16px;align-items:center"><select id="monitoringStatusFilter" class="filter-select"><option value="">All Status</option><option value="pending">Expert Pending</option><option value="partial">Partial</option><option value="complete">Complete</option></select></div>';

    // Table
    html += '<div class="card"><table class="data-table" id="monitoringTable"><thead><tr><th>Project</th><th>Category</th><th>Pioneers</th><th>Responses</th><th>Status</th></tr></thead><tbody>';
    for (const p of projects) {
      let statusBadge;
      if (p.status === 'complete') {
        statusBadge = '<span class="badge badge-green">Complete</span>';
      } else if (p.responses_completed > 0) {
        statusBadge = '<span class="badge badge-warning">Partial</span>';
      } else {
        statusBadge = '<span class="badge badge-orange">Pending</span>';
      }
      const effectiveStatus = p.status === 'complete' ? 'complete' : (p.responses_completed > 0 ? 'partial' : 'pending');
      html += '<tr class="monitoring-row clickable" data-status="' + effectiveStatus + '" onclick="window.location.hash=\'#edit/' + p.id + '\'">'
        + '<td><strong>' + esc(p.project_name) + '</strong></td>'
        + '<td>' + esc(p.category_name || '\u2014') + '</td>'
        + '<td>' + p.pioneer_count + ' pioneer' + (p.pioneer_count !== 1 ? 's' : '') + '</td>'
        + '<td>' + p.responses_completed + ' of ' + p.responses_expected + '</td>'
        + '<td>' + statusBadge + '</td></tr>';
    }
    html += '</tbody></table></div>';
    mc.innerHTML = html;

    // Client-side filter
    document.getElementById('monitoringStatusFilter').addEventListener('change', function() {
      const v = this.value;
      document.querySelectorAll('#monitoringTable tbody tr').forEach(tr => {
        tr.style.display = (!v || tr.dataset.status === v) ? '' : 'none';
      });
    });
  } catch (err) {
    mc.innerHTML = '<div class="error-state">Failed to load monitoring data: ' + esc(err.message) + '</div>';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS (Categories + Legacy Norms tabs)
   ═══════════════════════════════════════════════════════════════════════ */

async function renderSettings() {
  const mc = document.getElementById('mainContent');
  const tabs = [
    { id: 'tabCategories', label: 'Categories', key: 'categories' },
    { id: 'tabPractices', label: 'Practices', key: 'practices' },
    { id: 'tabNorms', label: 'Legacy Norms', key: 'norms' },
    { id: 'tabPassword', label: 'Change Password', key: 'password' },
  ];
  if (isAdmin()) tabs.splice(3, 0, { id: 'tabUsers', label: 'Users', key: 'users' });
  if (isAdmin()) tabs.splice(3, 0, { id: 'tabAppSettings', label: 'App Settings', key: 'appsettings' });

  mc.innerHTML = `
    <div class="settings-tabs">
      ${tabs.map((t, i) => `<button class="settings-tab ${i === 0 ? 'active' : ''}" id="${t.id}" onclick="switchSettingsTab('${t.key}')">${t.label}</button>`).join('')}
    </div>
    <div id="settingsContent"><div class="loading">Loading\u2026</div></div>`;
  renderCategoriesTab();
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  const tabMap = { categories: 'tabCategories', practices: 'tabPractices', norms: 'tabNorms', users: 'tabUsers', password: 'tabPassword', appsettings: 'tabAppSettings' };
  const el = document.getElementById(tabMap[tab]);
  if (el) el.classList.add('active');
  if (tab === 'categories') renderCategoriesTab();
  else if (tab === 'practices') renderPracticesTab();
  else if (tab === 'users') renderUsersTab();
  else if (tab === 'password') renderPasswordTab();
  else if (tab === 'appsettings') renderAppSettingsTab();
  else renderNormsTab();
}

async function renderCategoriesTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading categories\u2026</div>';
  try {
    await loadPractices();
    const cats = await apiCall('GET', '/categories');
    state.categories = cats;
    const _isAdmin = isAdmin();

    let html = '<div class="card">';
    if (_isAdmin) {
      html += `<div style="padding:16px 24px;border-bottom:1px solid var(--gray-200);display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:13px;color:var(--gray-500)">Categories drive project classification. Each category is attributed one or more practices; projects inherit practice choice from the category.</div>
        <button class="btn btn-primary btn-sm" onclick="openAddCategoryModal()">+ Add Category</button>
      </div>`;
    }
    html += `<table class="data-table"><thead><tr><th>Name</th><th>Practices</th><th>Description</th><th>Projects</th>${_isAdmin ? '<th>Actions</th>' : ''}</tr></thead><tbody>`;
    for (const c of cats) {
      const count = c.project_count || 0;
      const deleteDisabled = count > 0;
      const pracBadges = (c.practices || []).map(p => `<span class="practice-badge">${esc(p.code)}</span>`).join(' ');
      html += `<tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${pracBadges || '<span style="color:var(--gray-400)">\u2014</span>'}</td>
        <td>${esc(c.description || '\u2014')}</td>
        <td>${count}</td>
        ${_isAdmin ? `<td class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="editCategory(${c.id},'${esc(c.name)}','${esc(c.description || '')}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon btn-danger-icon" title="${deleteDisabled ? 'Cannot delete' : 'Delete'}" ${deleteDisabled ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''} onclick="${deleteDisabled ? '' : "deleteCategory(" + c.id + ",'" + esc(c.name) + "')"}"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </td>` : ''}
      </tr>`;
    }
    html += `</tbody></table></div>`;
    sc.innerHTML = html;
  } catch (err) {
    sc.innerHTML = `<div class="error-state">Failed to load categories: ${esc(err.message)}</div>`;
  }
}

function openAddCategoryModal() {
  const practiceCheckboxes = state.practices.map(p => `
    <label style="display:inline-flex;align-items:center;gap:6px;margin:3px 10px 3px 0;padding:4px 10px;border:1px solid var(--gray-300);border-radius:16px;cursor:pointer;user-select:none">
      <input type="checkbox" class="new-cat-prac-cb" data-id="${p.id}"> <strong>${esc(p.code)}</strong>
    </label>`).join('');
  showModal(`
    <h3>New Category</h3>
    <div class="form-group" style="margin-bottom:16px"><label>Name *</label><input type="text" id="newCatName" placeholder="e.g. 510(k)" autofocus></div>
    <div class="form-group" style="margin-bottom:16px"><label>Description</label><input type="text" id="newCatDesc" placeholder="Optional"></div>
    <div class="form-group" style="margin-bottom:16px">
      <label>Allowed Practices <span class="field-hint" data-hint="Tick every practice that is allowed to use this category. At project creation time the Practice dropdown is filtered to this list.">&#9432;</span></label>
      <div style="margin-top:6px">${practiceCheckboxes}</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="addCategory()">Create</button>
      <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </div>
  `);
}

async function addCategory() {
  const name = document.getElementById('newCatName')?.value.trim();
  const desc = document.getElementById('newCatDesc')?.value.trim() || null;
  if (!name) { showToast('Category name is required', 'error'); return; }
  const practiceIds = Array.from(document.querySelectorAll('.new-cat-prac-cb:checked')).map(cb => parseInt(cb.dataset.id));
  if (practiceIds.length === 0) { showToast('Pick at least one practice', 'error'); return; }
  try {
    const cat = await apiCall('POST', '/categories', { name, description: desc });
    if (cat && cat.id) {
      await apiCall('PUT', `/categories/${cat.id}/practices`, { practice_ids: practiceIds });
    }
    hideModal();
    showToast('Category created');
    state.categories = [];
    renderCategoriesTab();
  } catch (err) { showToast(err.message, 'error'); }
}

function editCategory(id, name, desc) {
  const cat = state.categories.find(c => c.id == id);
  const currentIds = new Set((cat?.practices || []).map(p => p.id));
  const practiceCheckboxes = state.practices.map(p => `
    <label style="display:inline-flex;align-items:center;gap:6px;margin:3px 10px 3px 0;padding:4px 10px;border:1px solid var(--gray-300);border-radius:16px;cursor:pointer;user-select:none${currentIds.has(p.id) ? ';background:var(--brand-blue-50,#dbeafe);border-color:var(--brand-blue,#6EC1E4)' : ''}">
      <input type="checkbox" class="cat-practice-cb" data-id="${p.id}" ${currentIds.has(p.id) ? 'checked' : ''}> <strong>${esc(p.code)}</strong>
    </label>`).join('');
  showModal(`
    <h3>Edit Category</h3>
    <div class="form-group" style="margin-bottom:16px"><label>Name</label><input type="text" id="editCatName" value="${esc(name)}"></div>
    <div class="form-group" style="margin-bottom:16px"><label>Description</label><input type="text" id="editCatDesc" value="${esc(desc)}"></div>
    <div class="form-group" style="margin-bottom:16px">
      <label>Allowed Practices <span class="field-hint" data-hint="When creating a project with this category, the Practice dropdown is limited to the codes checked here. Pick at least one.">&#9432;</span></label>
      <div style="margin-top:6px">${practiceCheckboxes}</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveCategory(${id})">Save</button>
      <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </div>
  `);
}

async function saveCategory(id) {
  const name = document.getElementById('editCatName')?.value.trim();
  const desc = document.getElementById('editCatDesc')?.value.trim() || null;
  if (!name) { showToast('Name is required', 'error'); return; }
  const practiceIds = Array.from(document.querySelectorAll('.cat-practice-cb:checked')).map(cb => parseInt(cb.dataset.id));
  try {
    await apiCall('PUT', `/categories/${id}`, { name, description: desc });
    await apiCall('PUT', `/categories/${id}/practices`, { practice_ids: practiceIds });
    hideModal();
    showToast('Category updated');
    state.categories = [];
    renderCategoriesTab();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteCategory(id, name) {
  showModal(`
    <h3>Delete Category</h3>
    <p>Are you sure you want to delete <strong>${esc(name)}</strong>? This will fail if projects exist for this category.</p>
    <div class="form-actions">
      <button class="btn btn-danger" onclick="doDeleteCategory(${id})">Delete</button>
      <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </div>
  `);
}

async function doDeleteCategory(id) {
  hideModal();
  try {
    await apiCall('DELETE', `/categories/${id}`);
    showToast('Category deleted');
    state.categories = [];
    renderCategoriesTab();
  } catch (err) { showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════════════
   PRACTICES SETTINGS TAB  (mirror of Categories)
   ═══════════════════════════════════════════════════════════════════════ */

async function renderPracticesTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading practices…</div>';
  try {
    const practices = await apiCall('GET', '/practices');
    state.practices = practices;
    const _isAdmin = isAdmin();

    let html = '<div class="card">';
    if (_isAdmin) {
      html += `<div style="padding:16px 24px;border-bottom:1px solid var(--gray-200);display:flex;gap:12px;align-items:center">
        <input type="text" id="newPrCode" placeholder="Code (e.g. FOO)" style="flex:1;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif">
        <input type="text" id="newPrName" placeholder="Name (defaults to code)" style="flex:1;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif">
        <input type="text" id="newPrDesc" placeholder="Description (optional)" style="flex:2;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif">
        <button class="btn btn-primary btn-sm" onclick="addPractice()">Add</button>
      </div>`;
    }
    html += `<table class="data-table"><thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Projects</th>${_isAdmin ? '<th>Actions</th>' : ''}</tr></thead><tbody>`;
    for (const p of practices) {
      const count = p.project_count || 0;
      const deleteDisabled = count > 0;
      html += `<tr>
        <td><strong>${esc(p.code)}</strong></td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.description || '—')}</td>
        <td>${count}</td>
        ${_isAdmin ? `<td class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="editPractice(${p.id},'${esc(p.name)}','${esc(p.description || '')}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon btn-danger-icon" title="${deleteDisabled ? 'Cannot delete' : 'Delete'}" ${deleteDisabled ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''} onclick="${deleteDisabled ? '' : "deletePractice(" + p.id + ",'" + esc(p.code) + "')"}"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </td>` : ''}
      </tr>`;
    }
    html += `</tbody></table></div>`;
    sc.innerHTML = html;
  } catch (err) {
    sc.innerHTML = `<div class="error-state">Failed to load practices: ${esc(err.message)}</div>`;
  }
}

async function addPractice() {
  const code = document.getElementById('newPrCode')?.value.trim();
  const name = document.getElementById('newPrName')?.value.trim() || code;
  const desc = document.getElementById('newPrDesc')?.value.trim() || null;
  if (!code) { showToast('Practice code is required', 'error'); return; }
  try {
    await apiCall('POST', '/practices', { code, name, description: desc });
    showToast('Practice created');
    state.practices = [];
    renderPracticesTab();
  } catch (err) { showToast(err.message, 'error'); }
}

function buildRolesSectionHtml(existingRoles) {
  const currencyOpts = (schema?.currencies || ['EUR', 'USD'])
    .map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  let rowsHtml = '';
  existingRoles.forEach((r, idx) => {
    rowsHtml += renderRoleRow(idx, r);
  });
  if (existingRoles.length === 0) {
    rowsHtml = `<div class="role-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No roles defined yet.</div>`;
  }

  return `
    <div class="form-group" style="margin-bottom:16px">
      <label style="font-weight:600;display:block;margin-bottom:6px">Roles &amp; rates</label>
      <div id="rolesTableHeader" style="display:grid;grid-template-columns:24px 24px minmax(0, 1fr) 110px 90px 32px;gap:6px;font-size:11px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.5px;padding:0 4px">
        <span></span><span></span><span>Role</span><span>Day rate</span><span>Currency</span><span></span>
      </div>
      <div id="rolesTableBody">${rowsHtml}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="addRoleRowBtn" style="margin-top:8px">+ Add role</button>
    </div>`;
}

function renderRoleRow(idx, r) {
  const currentCurrency = r.currency || 'EUR';
  const optsWithSel = (schema?.currencies || ['EUR', 'USD'])
    .map(c => `<option value="${esc(c)}" ${c === currentCurrency ? 'selected' : ''}>${esc(c)}</option>`).join('');
  return `
    <div class="role-row" data-row-idx="${idx}" style="display:grid;grid-template-columns:24px 24px minmax(0, 1fr) 110px 90px 32px;gap:6px;align-items:center;padding:4px;border-bottom:1px solid var(--gray-100)">
      <button type="button" class="btn-icon role-up" title="Move up" style="background:none;border:0;cursor:pointer">▲</button>
      <button type="button" class="btn-icon role-down" title="Move down" style="background:none;border:0;cursor:pointer">▼</button>
      <input type="text" class="role-name" maxlength="80" value="${esc(r.role_name || '')}" placeholder="Role name">
      <input type="number" class="role-rate" min="0" step="0.01" value="${r.day_rate ?? ''}" placeholder="0">
      <select class="role-currency">${optsWithSel}</select>
      <button type="button" class="btn-icon role-remove" title="Remove" style="background:none;border:0;cursor:pointer;color:var(--danger)">×</button>
    </div>`;
}

function wireRoleRowsEvents() {
  const body = document.getElementById('rolesTableBody');
  const addBtn = document.getElementById('addRoleRowBtn');
  if (!body || !addBtn) return;

  addBtn.addEventListener('click', () => {
    const empty = body.querySelector('.role-empty');
    if (empty) empty.remove();
    const idx = body.querySelectorAll('.role-row').length;
    body.insertAdjacentHTML('beforeend', renderRoleRow(idx, {role_name: '', day_rate: '', currency: 'EUR'}));
  });

  body.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.classList.contains('role-remove')) {
      t.closest('.role-row').remove();
      if (body.querySelectorAll('.role-row').length === 0) {
        body.innerHTML = `<div class="role-empty" style="color:var(--gray-500);font-size:13px;padding:8px">No roles defined yet.</div>`;
      }
    } else if (t.classList.contains('role-up')) {
      const row = t.closest('.role-row');
      const prev = row.previousElementSibling;
      if (prev && prev.classList.contains('role-row')) {
        body.insertBefore(row, prev);
      }
    } else if (t.classList.contains('role-down')) {
      const row = t.closest('.role-row');
      const next = row.nextElementSibling;
      if (next && next.classList.contains('role-row')) {
        body.insertBefore(next, row);
      }
    }
  });
}

async function editPractice(id, name, desc) {
  const existingRoles = await loadPracticeRoles(id);
  showModal(`
    <h3>Edit Practice</h3>
    <div class="form-group" style="margin-bottom:16px"><label>Name</label><input type="text" id="editPrName" value="${esc(name)}"></div>
    <div class="form-group" style="margin-bottom:16px"><label>Description</label><input type="text" id="editPrDesc" value="${esc(desc)}"></div>
    ${buildRolesSectionHtml(existingRoles)}
    <div class="form-actions">
      <button class="btn btn-primary" onclick="savePractice(${id})">Save</button>
      <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </div>
  `);
  wireRoleRowsEvents();
}

async function savePractice(id) {
  const name = document.getElementById('editPrName')?.value.trim();
  const desc = document.getElementById('editPrDesc')?.value.trim() || null;
  if (!name) { showToast('Name is required', 'error'); return; }
  try {
    await apiCall('PUT', `/practices/${id}`, { name, description: desc });
  } catch (err) { showToast(err.message, 'error'); return; }

  const rows = Array.from(document.querySelectorAll('#rolesTableBody .role-row'));
  const roles = rows.map((row, idx) => ({
    role_name: row.querySelector('.role-name').value.trim(),
    day_rate: parseOptionalNumber(row.querySelector('.role-rate').value) ?? 0,
    currency: row.querySelector('.role-currency').value,
    display_order: idx,
  })).filter(r => r.role_name);

  try {
    await apiCall('PUT', `/practices/${id}/roles`, { roles });
  } catch (e) {
    showToast('Practice fields saved but roles failed: ' + (e?.message || e));
    return;
  }

  hideModal();
  showToast('Practice updated');
  state.practices = [];
  renderPracticesTab();
}

async function deletePractice(id, code) {
  showModal(`
    <h3>Delete Practice</h3>
    <p>Are you sure you want to delete <strong>${esc(code)}</strong>? This will fail if projects exist for this practice.</p>
    <div class="form-actions">
      <button class="btn btn-danger" onclick="doDeletePractice(${id})">Delete</button>
      <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </div>
  `);
}

async function doDeletePractice(id) {
  hideModal();
  try {
    await apiCall('DELETE', `/practices/${id}`);
    showToast('Practice deleted');
    state.practices = [];
    renderPracticesTab();
  } catch (err) { showToast(err.message, 'error'); }
}

async function renderAppSettingsTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading…</div>';

  const [settings, fx] = await Promise.all([
    apiCall('GET', '/settings'),
    apiCall('GET', '/fx-rates'),
  ]);
  const currencies = schema?.currencies || ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD'];

  const fxByCode = {};
  (fx?.rates || []).forEach(r => { fxByCode[r.currency_code] = r; });

  let html = `
    <div class="card">
      <div style="padding:16px 24px;border-bottom:1px solid var(--gray-200)">
        <h3 style="margin:0 0 4px;color:var(--navy)">App Settings</h3>
        <p style="margin:0;color:var(--gray-500);font-size:13px">Global defaults applied across the application.</p>
      </div>

      <div style="padding:8px 0">
        <div style="display:flex;gap:12px;align-items:center;padding:12px 24px;border-bottom:1px solid var(--gray-200)">
          <label for="settingDefaultCurrency" style="font-weight:600;min-width:200px">Default currency</label>
          <select id="settingDefaultCurrency">
            ${currencies.map(c =>
              `<option value="${esc(c)}"${c === settings.default_currency ? ' selected' : ''}>${esc(c)}</option>`
            ).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="saveDefaultCurrency()">Save</button>
          <span class="field-help" style="color:var(--gray-500);font-size:12px">Pre-fills the currency selector on new projects.</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px" data-testid="fx-rates-section">
      <div style="padding:16px 24px;border-bottom:1px solid var(--gray-200);display:flex;justify-content:space-between;align-items:center">
        <div>
          <h3 style="margin:0 0 4px;color:var(--navy)">FX Rates</h3>
          <p style="margin:0;color:var(--gray-500);font-size:13px">Multipliers from each currency to the base currency. Used for portfolio-level economic aggregates on the dashboard.</p>
        </div>
        <button class="btn btn-primary btn-sm" data-testid="fx-rates-save" onclick="saveFxRates()">Save</button>
      </div>

      <div style="padding:12px 24px;display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--gray-200)">
        <label for="settingBaseCurrency" style="font-weight:600;min-width:200px">Base currency</label>
        <select id="settingBaseCurrency" data-testid="base-currency-select">
          ${currencies.map(c =>
            `<option value="${esc(c)}"${c === fx.base_currency ? ' selected' : ''}>${esc(c)}</option>`
          ).join('')}
        </select>
        <span class="field-help" style="color:var(--gray-500);font-size:12px">Currency for the dashboard's portfolio rollup.</span>
      </div>

      <table class="data-table" style="width:100%">
        <thead><tr><th>Currency</th><th>Rate to base</th><th>Updated</th></tr></thead>
        <tbody>
          ${currencies.map(code => {
            const row = fxByCode[code] || { rate_to_base: 0, updated_at: null };
            const rate = row.rate_to_base != null ? row.rate_to_base : '';
            const updated = row.updated_at ? esc(row.updated_at.slice(0, 10)) : '—';
            return `<tr>
              <td><strong>${esc(code)}</strong></td>
              <td><input type="number" step="0.0001" min="0" data-testid="fx-rate-${esc(code)}" value="${esc(String(rate))}" style="width:120px"></td>
              <td>${updated}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  sc.innerHTML = html;
}

async function saveDefaultCurrency() {
  const v = document.getElementById('settingDefaultCurrency').value;
  try {
    await apiCall('PUT', '/settings', { default_currency: v });
    window._defaultCurrency = v;
    showToast('Default currency updated');
  } catch (e) {
    showToast('Failed to save: ' + (e?.message || e), 'error');
  }
}

async function saveFxRates() {
  const base = document.getElementById('settingBaseCurrency').value;
  const currencies = schema?.currencies || [];
  const rates = currencies.map(code => {
    const inp = document.querySelector(`[data-testid="fx-rate-${code}"]`);
    return { currency_code: code, rate_to_base: parseFloat(inp.value || '0') };
  });
  try {
    await apiCall('PUT', '/fx-rates', { base_currency: base, rates });
    showToast('FX rates saved');
    // Re-render to refresh the "Updated" column.
    renderAppSettingsTab();
  } catch (e) {
    showToast('Failed to save: ' + (e?.message || e), 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   NORMS PAGE
   ═══════════════════════════════════════════════════════════════════════ */

function buildNormsAggregatesTable(rows, cats) {
  const byCategoryId = {};
  (rows || []).forEach(row => {
    byCategoryId[row.category_id] = row;
    byCategoryId[row.category_name] = row;
  });

  let html = `
    <div class="card">
      <div style="padding:24px 24px 8px">
        <h1 style="font-size:20px;font-weight:700;color:var(--navy);margin:0 0 8px">Category Norms</h1>
        <p style="margin:0;color:var(--gray-500);font-size:14px">xCSG vs Legacy ratios by category \u2014 computed from completed expert surveys. Values >1\xd7 mean xCSG outperforms.</p>
      </div>
      <div style="padding:16px 24px 24px">
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th title="Average delivery speed ratio across completed projects. >1\xd7 means xCSG is faster.">Avg Speed ${infoIcon('delivery_speed')}</th>
              <th title="Average output quality ratio. >1\xd7 means xCSG output is higher quality.">Avg Quality ${infoIcon('output_quality')}</th>
              <th title="Quality per person-day: xCSG vs legacy. Higher = more value per unit of effort.">xCSG Value Gain ${infoIcon('productivity_ratio')}</th>
              <th title="Number of expert questionnaires submitted for this category.">Completed Surveys</th>
              <th title="All projects (including pending) in this category.">Total Projects</th>
            </tr>
          </thead>
          <tbody>`;

  const fmtRatio = (v, n) => (n && n > 0 && v != null) ? round2(v) + '\xd7' : '\u2014';
  const tone = (v) => {
    if (v == null) return 'var(--gray-400)';
    if (v > 2) return 'var(--success)';
    if (v >= 1) return 'var(--blue)';
    if (v >= 0.8) return 'var(--warning)';
    return 'var(--error)';
  };

  cats.forEach(cat => {
    const row = byCategoryId[cat.id] || byCategoryId[cat.name] || {};
    const n = row.completed_surveys || 0;
    html += `<tr>
      <td><strong>${esc(cat.name)}</strong></td>
      <td style="color:${tone(row.avg_effort_ratio)};font-weight:600">${fmtRatio(row.avg_effort_ratio, n)}</td>
      <td style="color:${tone(row.avg_quality_ratio)};font-weight:600">${fmtRatio(row.avg_quality_ratio, n)}</td>
      <td style="color:${tone(row.avg_productivity)};font-weight:600">${fmtRatio(row.avg_productivity, n)}</td>
      <td>${n}</td>
      <td>${row.total_projects || 0}</td>
    </tr>`;
  });

  html += `</tbody></table></div></div>`;
  return html;
}

async function renderNormsPage() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading norms\u2026</div>';
  try {
    const [rows, cats] = await Promise.all([apiCall('GET', '/norms/aggregates'), apiCall('GET', '/categories')]);
    mc.innerHTML = buildNormsAggregatesTable(rows, cats);
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load norms: ${esc(err.message)}</div>`;
  }
}

async function renderNormsTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading norms\u2026</div>';
  try {
    const [rows, cats] = await Promise.all([apiCall('GET', '/norms/aggregates'), apiCall('GET', '/categories')]);
    sc.innerHTML = buildNormsAggregatesTable(rows, cats);
  } catch (err) {
    sc.innerHTML = `<div class="error-state">Failed to load norms: ${esc(err.message)}</div>`;
  }
}

async function renderUsersTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading users\u2026</div>';
  try {
    const users = await apiCall('GET', '/users');
    let html = '<div class="card">';
    html += `<div style="padding:16px 24px;border-bottom:1px solid var(--gray-200)">
      <h3 style="margin:0 0 12px;font-size:16px;color:var(--navy)">Add User</h3>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="text" id="newUsername" placeholder="Username" style="padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;width:140px">
        <input type="email" id="newEmail" placeholder="Email" style="padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;width:200px">
        <input type="password" id="newPassword" placeholder="Password (min 8 chars)" style="padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;width:180px">
        <select id="newRole" style="padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px">
          <option value="viewer">Viewer</option>
          <option value="analyst">Analyst</option>
          <option value="admin">Admin</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="addUser()">Add</button>
      </div>
    </div>`;
    html += '<table class="data-table"><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
    const myId = state.user ? state.user.id : null;
    for (const u of users) {
      const isSelf = u.id === myId;
      html += '<tr>'
        + '<td><strong>' + esc(u.username) + '</strong>' + (isSelf ? ' <span class="badge badge-info" style="font-size:10px">you</span>' : '') + '</td>'
        + '<td>' + esc(u.email || '\u2014') + '</td>'
        + '<td><select class="role-select" data-uid="' + u.id + '" onchange="changeUserRole(' + u.id + ', this.value)"' + (isSelf ? ' disabled title="Cannot change your own role"' : '') + '>'
        + ['admin', 'analyst', 'viewer'].map(r => '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + r + '</option>').join('')
        + '</select></td>'
        + '<td>' + (u.created_at ? new Date(u.created_at).toLocaleDateString() : '\u2014') + '</td>'
        + '<td>'
        + '<button class="btn btn-sm btn-secondary" onclick="resetUserPassword(' + u.id + ', \'' + esc(u.username) + '\')">Reset Password</button> '
        + (isSelf ? '' : '<button class="btn btn-sm btn-danger" onclick="confirmDeleteUser(' + u.id + ', \'' + esc(u.username) + '\')">Delete</button>')
        + '</td></tr>';
    }
    html += '</tbody></table></div>';
    sc.innerHTML = html;
  } catch (err) {
    sc.innerHTML = '<div class="error-state">Failed to load users: ' + esc(err.message) + '</div>';
  }
}

async function addUser() {
  const username = document.getElementById('newUsername').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newRole').value;
  if (!username || !email || !password) { showToast('All fields required', 'error'); return; }
  if (password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
  try {
    await apiCall('POST', '/auth/register', { username, email, password, role });
    showToast('User created');
    renderUsersTab();
  } catch (err) { showToast(err.message, 'error'); }
}

async function changeUserRole(userId, newRole) {
  try {
    await apiCall('PUT', '/users/' + userId, { role: newRole });
    showToast('Role updated');
  } catch (err) { showToast(err.message, 'error'); renderUsersTab(); }
}

function confirmDeleteUser(userId, username) {
  showModal('<h3>Delete User</h3><p>Are you sure you want to delete <strong>' + esc(username) + '</strong>?</p>'
    + '<div class="form-actions"><button class="btn btn-danger" onclick="doDeleteUser(' + userId + ')">Delete</button>'
    + '<button class="btn btn-secondary" onclick="hideModal()">Cancel</button></div>');
}

async function doDeleteUser(userId) {
  hideModal();
  try {
    await apiCall('DELETE', '/users/' + userId);
    showToast('User deleted');
    renderUsersTab();
  } catch (err) { showToast(err.message, 'error'); }
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 14; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function resetUserPassword(userId, username) {
  const newPw = generatePassword();
  showModal('<h3>Reset Password</h3>'
    + '<p>Generate a new password for <strong>' + esc(username) + '</strong>?</p>'
    + '<div class="form-actions" style="margin-top:16px">'
    + '<button class="btn btn-primary" onclick="doResetPassword(' + userId + ',\'' + esc(newPw) + '\',\'' + esc(username) + '\')">Reset Now</button>'
    + '<button class="btn btn-secondary" onclick="hideModal()">Cancel</button></div>');
}

async function doResetPassword(userId, newPw, username) {
  hideModal();
  try {
    await apiCall('PUT', '/users/' + userId, { password: newPw });
    showModal('<h3>Password Reset</h3>'
      + '<p>New password for <strong>' + esc(username) + '</strong>:</p>'
      + '<input type="text" id="resetPwDisplay" value="' + esc(newPw) + '" readonly style="width:100%;padding:10px 14px;border:1px solid var(--gray-300);border-radius:var(--radius);font-family:monospace;font-size:15px;margin:12px 0;background:var(--gray-50)">'
      + '<p style="color:var(--warning);font-size:12px;margin:0 0 16px">\u26a0 Share this securely with the user. It will not be shown again.</p>'
      + '<div class="form-actions">'
      + '<button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById(\'resetPwDisplay\').value);showToast(\'Copied to clipboard\')">Copy Password</button>'
      + '<button class="btn btn-secondary" onclick="hideModal()">Done</button></div>');
  } catch (err) { showToast(err.message, 'error'); }
}

function renderPasswordTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="card" style="max-width:480px">'
    + '<div style="padding:24px"><h3 style="margin:0 0 16px;color:var(--navy)">Change Your Password</h3>'
    + '<div class="form-group"><label>Current Password</label><input type="password" id="pwCurrent" placeholder="Enter current password"></div>'
    + '<div class="form-group" style="margin-top:12px"><label>New Password</label><input type="password" id="pwNew" placeholder="Min 8 characters"></div>'
    + '<div class="form-group" style="margin-top:12px"><label>Confirm New Password</label><input type="password" id="pwConfirm" placeholder="Re-enter new password"></div>'
    + '<button class="btn btn-primary" style="margin-top:16px" onclick="doChangePassword()">Change Password</button>'
    + '</div></div>';
}

async function doChangePassword() {
  const current = document.getElementById('pwCurrent').value;
  const newPw = document.getElementById('pwNew').value;
  const confirm = document.getElementById('pwConfirm').value;
  if (!current || !newPw) { showToast('All fields required', 'error'); return; }
  if (newPw.length < 8) { showToast('New password must be at least 8 characters', 'error'); return; }
  if (newPw !== confirm) { showToast('Passwords do not match', 'error'); return; }
  try {
    await apiCall('PUT', '/auth/password', { current_password: current, new_password: newPw });
    showToast('Password changed successfully');
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
  } catch (err) { showToast(err.message, 'error'); }
}

/* ═══════════════════════════════════════════════════════════════════════
   ACTIVITY LOG
   ═══════════════════════════════════════════════════════════════════════ */

async function renderActivity() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading activity\u2026</div>';
  try {
    const data = await apiCall('GET', '/activity?limit=100');
    const items = data.items || [];
    if (items.length === 0) {
      mc.innerHTML = '<div class="empty-state"><h3>No activity yet</h3><p>Activity will appear here as you use the tracker.</p></div>';
      return;
    }
    const ACTIVITY_PAGE = 25;
    let html = '<div class="card"><table class="data-table"><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>';
    let lastDay = '';
    let rowIdx = 0;
    for (const a of items) {
      const day = a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : '';
      if (day && day !== lastDay) {
        html += `<tr class="activity-row${rowIdx >= ACTIVITY_PAGE ? ' activity-hidden' : ''}"><td colspan="3" class="activity-day-sep">${day}</td></tr>`;
        lastDay = day;
      }
      const actionBadge = a.action === 'login' ? 'badge-info'
        : a.action.includes('created') ? 'badge-green'
        : a.action.includes('deleted') ? 'badge-red'
        : a.action.includes('expert') ? 'badge-orange'
        : a.action.includes('updated') ? 'badge-navy'
        : 'badge-gray';
      html += `<tr class="activity-row${rowIdx >= ACTIVITY_PAGE ? ' activity-hidden' : ''}">
        <td>${formatDateTime(a.created_at)}</td>
        <td><span class="badge ${actionBadge}">${esc(a.action)}</span></td>
        <td>${esc(a.details || '\u2014')}</td>
      </tr>`;
      rowIdx++;
    }
    html += '</tbody></table>';
    if (items.length > ACTIVITY_PAGE) {
      html += `<div class="show-more-wrap"><button class="show-more-btn" id="activityShowMore">Show all ${items.length} entries</button></div>`;
    }
    html += '</div>';
    mc.innerHTML = html;

    if (items.length > ACTIVITY_PAGE) {
      document.getElementById('activityShowMore')?.addEventListener('click', function () {
        document.querySelectorAll('.activity-hidden').forEach(el => el.classList.remove('activity-hidden'));
        this.parentElement.remove();
      });
    }
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load activity: ${esc(err.message)}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   NOTES FEED (#notes)
   Voice of the expert — filterable + searchable qualitative feedback.
   ═══════════════════════════════════════════════════════════════════════ */

let _notesFilterState = {
  practice: '',
  category: '',
  pioneer: '',
  from: '',
  to: '',
  search: '',
};

let _notesSearchDebounce = null;

function _buildNotesQuery() {
  const p = new URLSearchParams();
  if (_notesFilterState.practice) p.set('practice_code', _notesFilterState.practice);
  if (_notesFilterState.category) p.set('category_id', _notesFilterState.category);
  if (_notesFilterState.pioneer)  p.set('pioneer_name', _notesFilterState.pioneer);
  if (_notesFilterState.from)     p.set('delivered_from', _notesFilterState.from);
  if (_notesFilterState.to)       p.set('delivered_to', _notesFilterState.to);
  if (_notesFilterState.search)   p.set('search', _notesFilterState.search);
  const qs = p.toString();
  return '/notes' + (qs ? '?' + qs : '');
}

async function renderNotes() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading notes…</div>';
  const myRoute = _routeCounter;
  try {
    const [notes, cats, practices] = await Promise.all([
      apiCall('GET', _buildNotesQuery()),
      apiCall('GET', '/categories'),
      apiCall('GET', '/practices'),
    ]);
    if (myRoute !== _routeCounter) return;
    mc.innerHTML = _notesPageHTML(notes || [], cats || [], practices || []);
    _wireNotesFilters();
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load notes: ${esc(err.message)}</div>`;
  }
}

function _notesPageHTML(notes, cats, practices) {
  const s = _notesFilterState;

  // Pioneer options: distinct names seen in the current result set.
  const pioneerNames = [...new Set(notes.map(n => n.pioneer_name).filter(Boolean))].sort();

  const catOpts = cats.map(c => {
    const sel = String(c.id) === String(s.category) ? ' selected' : '';
    return '<option value="' + esc(c.id) + '"' + sel + '>' + esc(c.name) + '</option>';
  }).join('');
  const practiceOpts = practices.map(p => {
    const code = p.code || p.practice_code || '';
    const name = p.name || p.practice_name || code;
    const sel = code === s.practice ? ' selected' : '';
    return '<option value="' + esc(code) + '"' + sel + '>' + esc(name) + '</option>';
  }).join('');
  const pioneerOpts = pioneerNames.map(n => {
    const sel = n === s.pioneer ? ' selected' : '';
    return '<option value="' + esc(n) + '"' + sel + '>' + esc(n) + '</option>';
  }).join('');

  let feed;
  if (!notes.length) {
    feed = '<div class="notes-empty">No notes match the current filters.</div>';
  } else {
    feed = '<div class="notes-feed">';
    for (const n of notes) {
      const when = n.submitted_at ? String(n.submitted_at).slice(0, 10) : '—';
      const meta = [
        n.practice_code || '—',
        n.category_name || '—',
        n.pioneer_name || '—',
        'Round ' + (n.round_number || '?'),
        when,
      ].map(esc).join(' · ');
      feed += '<div class="notes-card">'
        + '<div class="notes-card-header">'
        + '<a href="#edit/' + esc(n.project_id) + '" class="notes-card-project">' + esc(n.project_name || '—') + '</a>'
        + '<span class="notes-card-meta">' + meta + '</span>'
        + '</div>'
        + '<div class="notes-card-body">' + esc(n.notes || '').replace(/\n/g, '<br>') + '</div>'
        + '</div>';
    }
    feed += '</div>';
  }

  const anyFilter = !!(s.search || s.practice || s.category || s.pioneer || s.from || s.to);
  const countLabel = anyFilter ? `${notes.length} matching ${notes.length === 1 ? 'note' : 'notes'}` : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} total`;

  return ''
    + '<div class="notes-header">'
    + '<h1>Notes</h1>'
    + '<p class="notes-header-subtitle">Voice of the expert — qualitative feedback across every project.</p>'
    + '</div>'
    + '<div class="notes-filter-bar">'
    +   '<div class="notes-filter-row">'
    +     '<input type="text" id="notesSearch" placeholder="Search in notes…" value="' + esc(s.search) + '">'
    +     '<select id="notesPractice"><option value="">All practices</option>' + practiceOpts + '</select>'
    +     '<select id="notesCategory"><option value="">All categories</option>' + catOpts + '</select>'
    +     '<select id="notesPioneer"><option value="">All pioneers</option>' + pioneerOpts + '</select>'
    +   '</div>'
    +   '<div class="notes-filter-row">'
    +     '<label class="notes-filter-date"><span>Delivered from</span><input type="date" id="notesFrom" value="' + esc(s.from) + '"></label>'
    +     '<label class="notes-filter-date"><span>to</span><input type="date" id="notesTo" value="' + esc(s.to) + '"></label>'
    +     '<button class="btn btn-secondary" type="button" onclick="_clearNotesFilters()"' + (anyFilter ? '' : ' disabled') + '>' + (anyFilter ? 'Show all' : 'Show all') + '</button>'
    +     '<span class="notes-filter-count">' + esc(countLabel) + '</span>'
    +     '<button class="btn btn-primary" type="button" onclick="_exportNotesExcel()" style="margin-left:auto">Export (xlsx)</button>'
    +   '</div>'
    + '</div>'
    + feed;
}

function _wireNotesFilters() {
  const search = document.getElementById('notesSearch');
  if (search) {
    search.addEventListener('input', function() {
      if (_notesSearchDebounce) clearTimeout(_notesSearchDebounce);
      _notesSearchDebounce = setTimeout(() => {
        _notesFilterState.search = search.value.trim();
        renderNotes();
      }, 300);
    });
  }
  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      _notesFilterState[key] = el.value;
      renderNotes();
    });
  };
  bind('notesPractice', 'practice');
  bind('notesCategory', 'category');
  bind('notesPioneer', 'pioneer');
  bind('notesFrom', 'from');
  bind('notesTo', 'to');
}

function _clearNotesFilters() {
  _notesFilterState = { practice: '', category: '', pioneer: '', from: '', to: '', search: '' };
  renderNotes();
}

async function _exportNotesExcel() {
  try {
    const res = await fetch(API + '/export/excel', {
      headers: { 'Authorization': 'Bearer ' + state.token },
    });
    if (!res.ok) { showToast('Export failed', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xCSG_Value_Export.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Export downloaded');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   METHODOLOGY PAGE
   ═══════════════════════════════════════════════════════════════════════ */

function _metricAccordionHTML(key, detail, open) {
  const exRows = detail.example.rows.map(r => {
    const isSignal = detail.format === 'pct';
    if (isSignal) {
      return `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="r">${esc(r[2])}</td></tr>`;
    }
    return `<tr><td>${esc(r[0])}</td><td class="r">${esc(r[1])}</td><td class="r">${esc(r[2])}</td></tr>`;
  }).join('');

  const isSignal = detail.format === 'pct';
  const exHeader = isSignal
    ? '<tr><th>Source</th><th>Response</th><th class="r">Score</th></tr>'
    : '<tr><th></th><th class="r">xCSG</th><th class="r">Legacy</th></tr>';

  return `<div class="meth-accordion-item ${open ? 'meth-open' : ''}" data-metric="${esc(key)}">
    <div class="meth-accordion-header" onclick="toggleMethodAccordion(this)">
      <div class="meth-accordion-left">
        <span class="meth-icon">${detail.icon}</span>
        <span class="meth-label">${esc(detail.label)}</span>
        <span class="meth-format-badge">${detail.format === 'pct' ? '%' : 'N\u00D7'}</span>
      </div>
      <span class="meth-chevron">\u25BC</span>
    </div>
    <div class="meth-accordion-body">
      <div class="meth-detail-section">
        <div class="meth-detail-title">What it measures</div>
        <p>${esc(detail.what)}</p>
      </div>
      <div class="meth-detail-section">
        <div class="meth-detail-title">Formula</div>
        <div class="meth-formula-box">${esc(detail.formula)}</div>
        <p class="meth-formula-note">${esc(detail.formulaDetail)}</p>
      </div>
      <div class="meth-detail-section">
        <div class="meth-detail-title">Data sources</div>
        <ul class="meth-sources-list">
          <li><strong>xCSG:</strong> ${esc(detail.sources.xcsg)}</li>
          <li><strong>Legacy:</strong> ${esc(detail.sources.legacy)}</li>
        </ul>
        <p class="meth-sources-note">${esc(detail.sources.note)}</p>
      </div>
      <div class="meth-detail-section">
        <div class="meth-detail-title">Worked example</div>
        <table class="meth-example-table">
          <thead>${exHeader}</thead>
          <tbody>${exRows}</tbody>
          <tfoot><tr><td colspan="3" class="meth-example-result"><strong>${esc(detail.example.resultLabel)}:</strong> <span class="meth-result-value">${esc(detail.example.result)}</span></td></tr></tfoot>
        </table>
      </div>
      <div class="meth-detail-section meth-how-to-read">
        <div class="meth-detail-title">How to read</div>
        <p>${esc(detail.howToRead)}</p>
      </div>
    </div>
  </div>`;
}

function toggleMethodAccordion(header) {
  const item = header.closest('.meth-accordion-item');
  if (!item) return;
  item.classList.toggle('meth-open');
}

// ── Pioneer status constants (shared by index/table/detail renderers) ───────
// Fallback used when /api/schema hasn't populated pioneer_status_options yet.
const PIONEER_STATUS_FALLBACK = [
  { value: 'pending',          label: 'Pending' },
  { value: 'pending_overdue',  label: 'Overdue' },
  { value: 'completed',        label: 'Completed' },
  { value: 'never',            label: 'Never assigned' },
];
// CSS strings (background+color) keyed by status value. Used in the
// pioneers table row, the chip filter, and the detail-page activity strip.
const PIONEER_STATUS_BADGE_STYLES = {
  pending:         'background:#fef3c7;color:#92400e;',
  pending_overdue: 'background:#fee2e2;color:#991b1b;',
  completed:       'background:#d1fae5;color:#065f46;',
  never:           'background:#f3f4f6;color:#6b7280;',
};

async function renderPioneersIndex() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading pioneers…</div>';

  let pioneers;
  try {
    pioneers = await apiCall('GET', '/pioneers');
  } catch (e) {
    mc.innerHTML = '<p class="empty-state">Failed to load pioneers: ' + esc(e.message || String(e)) + '</p>';
    return;
  }
  window._pioneersCache = pioneers;
  if (!window._pioneersFilters) {
    // Default sort: last name ascending (consulting convention).
    window._pioneersFilters = { search: '', practice: [], role: [], status: [], sort_field: 'last_name', sort_dir: 'asc' };
  }

  mc.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h1 style="margin:0">Pioneers</h1>
      <div style="display:flex;gap:8px">
        ${canWrite() ? '<button class="btn btn-primary btn-sm" onclick="openAddPioneerModal()">+ Add Pioneer</button>' : ''}
        <button class="btn btn-secondary btn-sm" onclick="downloadPioneersCsv()">Download CSV ↓</button>
      </div>
    </div>
    <div id="pioneersFilterBar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <input type="search" id="pioneersSearch" placeholder="Search first/last name or email…" value="${esc(window._pioneersFilters.search)}"
        style="min-width:200px;padding:5px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:13px">
      <span id="pioneersPracticeFilter" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"></span>
      <span id="pioneersRoleFilter" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"></span>
      <span id="pioneersStatusFilter" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"></span>
    </div>
    <div id="pioneersTableContainer"></div>
  `;

  renderPioneersFilterChips();
  renderPioneersTable();

  let _searchTimer = null;
  const debounceMs = (schema && schema.dashboard && schema.dashboard.thresholds
    && Number.isFinite(schema.dashboard.thresholds.search_debounce_ms))
    ? schema.dashboard.thresholds.search_debounce_ms
    : 250;
  document.getElementById('pioneersSearch').addEventListener('input', function(e) {
    clearTimeout(_searchTimer);
    const val = e.target.value;
    _searchTimer = setTimeout(function() {
      window._pioneersFilters.search = val;
      renderPioneersTable();
    }, debounceMs);
  });
}

function renderPioneersFilterChips() {
  const allPractices = new Set();
  const allRoles = new Set();
  const allStatuses = new Set();
  (window._pioneersCache || []).forEach(function(p) {
    (p.practices || []).forEach(function(pr) { allPractices.add(pr.code); });
    (p.roles || []).forEach(function(r) { allRoles.add(r.role_name); });
    if (p.status) allStatuses.add(p.status);
  });

  // Build chips with the value carried in data-* attributes; a delegated
  // click handler reads them. This avoids string-interpolating the value
  // into an onclick="..." attribute, where characters like <, >, &, or "
  // would break the attribute or open an XSS hole.
  function chipBtn(key, value, label) {
    const isActive = (window._pioneersFilters[key] || []).includes(value);
    const activeStyle = isActive
      ? 'background:#121F6B;color:#fff;border-color:#121F6B;'
      : 'background:#f3f4f6;color:#374151;border-color:#d1d5db;';
    return '<button class="pioneers-filter-chip" data-filter-key="' + esc(key) + '" data-filter-value="' + esc(value) + '"'
      + ' style="' + activeStyle + 'border:1px solid;border-radius:20px;padding:3px 10px;font-size:12px;cursor:pointer">'
      + esc(label) + '</button>';
  }

  const practiceEl = document.getElementById('pioneersPracticeFilter');
  if (practiceEl) {
    const chips = Array.from(allPractices).sort().map(function(code) { return chipBtn('practice', code, code); });
    practiceEl.innerHTML = chips.length
      ? '<span style="font-size:12px;color:#6b7280;font-weight:600">Practice:</span> ' + chips.join('')
      : '';
  }

  const roleEl = document.getElementById('pioneersRoleFilter');
  if (roleEl) {
    const chips = Array.from(allRoles).sort().map(function(name) { return chipBtn('role', name, name); });
    roleEl.innerHTML = chips.length
      ? '<span style="font-size:12px;color:#6b7280;font-weight:600">Role:</span> ' + chips.join('')
      : '';
  }

  const statusEl = document.getElementById('pioneersStatusFilter');
  if (statusEl) {
    const statusOpts = (schema && schema.pioneer_status_options) ? schema.pioneer_status_options : PIONEER_STATUS_FALLBACK;
    const chips = statusOpts.map(function(opt) { return chipBtn('status', opt.value, opt.label); });
    statusEl.innerHTML = '<span style="font-size:12px;color:#6b7280;font-weight:600">Status:</span> ' + chips.join('');
  }

  // Wire delegated click handlers (idempotent — re-bind every render so the
  // handlers attach to the freshly-replaced DOM).
  ['pioneersPracticeFilter', 'pioneersRoleFilter', 'pioneersStatusFilter'].forEach(function(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll('button.pioneers-filter-chip').forEach(function(btn) {
      btn.addEventListener('click', function() {
        togglePioneersFilter(btn.dataset.filterKey, btn.dataset.filterValue);
      });
    });
  });
}

function togglePioneersFilter(key, value) {
  const arr = window._pioneersFilters[key];
  if (!Array.isArray(arr)) return;
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
  renderPioneersFilterChips();
  renderPioneersTable();
}

function sortPioneers(field) {
  const f = window._pioneersFilters;
  if (f.sort_field === field) {
    f.sort_dir = f.sort_dir === 'asc' ? 'desc' : 'asc';
  } else {
    f.sort_field = field;
    f.sort_dir = 'asc';
  }
  renderPioneersTable();
}

function renderPioneersTable() {
  const filters = window._pioneersFilters;
  const all = window._pioneersCache || [];

  let filtered = all.filter(function(p) {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const haystack = [
        p.first_name || '',
        p.last_name || '',
        p.display_name || '',
        p.email || '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    if (filters.practice && filters.practice.length > 0) {
      const codes = (p.practices || []).map(function(pr) { return pr.code; });
      if (!filters.practice.some(function(c) { return codes.includes(c); })) return false;
    }
    if (filters.role && filters.role.length > 0) {
      const names = (p.roles || []).map(function(r) { return r.role_name; });
      if (!filters.role.some(function(n) { return names.includes(n); })) return false;
    }
    if (filters.status && filters.status.length > 0 && !filters.status.includes(p.status)) return false;
    return true;
  });

  if (filters.sort_field) {
    const sf = filters.sort_field;
    const dir = filters.sort_dir === 'desc' ? -1 : 1;
    filtered = filtered.slice().sort(function(a, b) {
      const av = a[sf] == null ? '' : a[sf];
      const bv = b[sf] == null ? '' : b[sf];
      if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
  }

  const cont = document.getElementById('pioneersTableContainer');
  if (!cont) return;

  if (filtered.length === 0) {
    cont.innerHTML = '<p class="empty-state" style="color:#6b7280;padding:24px 0;text-align:center">No pioneers match the current filters.</p>';
    return;
  }

  const statusBadgeStyle = PIONEER_STATUS_BADGE_STYLES;

  const statusOpts = (schema && schema.pioneer_status_options) ? schema.pioneer_status_options : PIONEER_STATUS_FALLBACK;
  function statusLabel(val) {
    const opt = statusOpts.find(function(o) { return o.value === val; });
    return opt ? opt.label : (val || '—');
  }

  function fmt(v) { return v == null ? '—' : (typeof v === 'number' ? v.toFixed(2) + '×' : String(v)); }
  function fmtPct(v) { return v == null ? '—' : (v * 100).toFixed(0) + '%'; }
  function fmtDate(v) { return v ? v.split('T')[0] : '—'; }

  function thCell(label, field) {
    const isSorted = filters.sort_field === field;
    const arrow = isSorted ? (filters.sort_dir === 'asc' ? ' ▲' : ' ▼') : '';
    return '<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="sortPioneers(\'' + field + '\')">'
      + esc(label) + arrow + '</th>';
  }

  let html = '<div style="overflow-x:auto"><table class="data-table" style="min-width:960px;width:100%"><thead><tr>'
    + thCell('Last name', 'last_name')
    + thCell('First name', 'first_name')
    + thCell('Email', 'email')
    + thCell('# Projects', 'project_count')
    + '<th>Practices</th>'
    + '<th>Roles</th>'
    + thCell('Status', 'status')
    + thCell('Completion', 'completion_rate')
    + thCell('Last Activity', 'last_activity_at')
    + thCell('Avg Value Gain', 'avg_value_gain')
    + thCell('Machine-First', 'avg_machine_first')
    + thCell('Senior-Led', 'avg_senior_led')
    + thCell('Knowledge', 'avg_knowledge')
    + '</tr></thead><tbody>';

  for (let i = 0; i < filtered.length; i++) {
    const p = filtered[i];
    const practiceChips = (p.practices || []).map(function(pr) {
      return '<span style="display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:10px;padding:1px 7px;font-size:11px;margin:1px">'
        + esc(pr.code) + '&nbsp;(' + pr.count + ')</span>';
    }).join(' ');
    const roleChips = (p.roles || []).map(function(r) {
      return '<span style="display:inline-block;background:#f0fdf4;color:#166534;border-radius:10px;padding:1px 7px;font-size:11px;margin:1px">'
        + esc(r.role_name) + '&nbsp;×' + r.count + '</span>';
    }).join(' ');
    const badgeStyle = statusBadgeStyle[p.status] || statusBadgeStyle.never;

    html += '<tr style="cursor:pointer" onclick="window.location.hash=\'#pioneer/' + p.id + '\'">'
      + '<td><strong>' + esc(p.last_name || '') + '</strong></td>'
      + '<td>' + esc(p.first_name || '') + '</td>'
      + '<td style="color:#6b7280;font-size:13px">' + esc(p.email || '') + '</td>'
      + '<td style="text-align:center">' + (p.project_count || 0) + '</td>'
      + '<td>' + (practiceChips || '—') + '</td>'
      + '<td>' + (roleChips || '—') + '</td>'
      + '<td><span style="' + badgeStyle + 'border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600">'
        + esc(statusLabel(p.status)) + '</span></td>'
      + '<td style="text-align:center">' + fmtPct(p.completion_rate) + '</td>'
      + '<td style="font-size:12px;white-space:nowrap">' + fmtDate(p.last_activity_at) + '</td>'
      + '<td style="text-align:center">' + fmt(p.avg_value_gain) + '</td>'
      + '<td style="text-align:center">' + fmt(p.avg_machine_first) + '</td>'
      + '<td style="text-align:center">' + fmt(p.avg_senior_led) + '</td>'
      + '<td style="text-align:center">' + fmt(p.avg_knowledge) + '</td>'
      + '</tr>';
  }
  html += '</tbody></table></div>';
  cont.innerHTML = html;
}

function downloadPioneersCsv() {
  const filters = window._pioneersFilters || {};
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  (filters.practice || []).forEach(function(p) { params.append('practice', p); });
  (filters.role || []).forEach(function(r) { params.append('role', r); });
  (filters.status || []).forEach(function(s) { params.append('status', s); });
  const qs = params.toString();
  const url = '/api/export/pioneers.csv' + (qs ? '?' + qs : '');
  const headers = {};
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  fetch(url, { headers: headers })
    .then(function(r) { return r.blob(); })
    .then(function(blob) {
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = 'pioneers.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    })
    .catch(function(e) { showToast('Download failed: ' + (e && e.message ? e.message : String(e)), 'error'); });
}

function openAddPioneerModal() {
  showModal(`
    <div style="padding:8px">
      <h2 style="margin-top:0">Add Pioneer</h2>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div class="form-group" style="flex:1">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">First name *</label>
          <input type="text" id="addPioneerFirstName" data-testid="add-pioneer-first-name" maxlength="80" style="width:100%;box-sizing:border-box">
        </div>
        <div class="form-group" style="flex:1">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Last name *</label>
          <input type="text" id="addPioneerLastName" data-testid="add-pioneer-last-name" maxlength="80" style="width:100%;box-sizing:border-box">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Email</label>
        <input type="email" id="addPioneerEmail" maxlength="200" style="width:100%;box-sizing:border-box">
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Notes</label>
        <textarea id="addPioneerNotes" maxlength="2000" rows="3" style="width:100%;box-sizing:border-box"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-primary" data-testid="add-pioneer-save" onclick="submitAddPioneerToIndex()">Save</button>
        <button class="btn btn-secondary" data-testid="add-pioneer-cancel" onclick="hideModal()">Cancel</button>
      </div>
    </div>
  `);
  setTimeout(function() {
    const el = document.getElementById('addPioneerFirstName');
    if (el) el.focus();
  }, 50);
}

async function submitAddPioneerToIndex() {
  const firstEl = document.getElementById('addPioneerFirstName');
  const lastEl = document.getElementById('addPioneerLastName');
  const emailEl = document.getElementById('addPioneerEmail');
  const notesEl = document.getElementById('addPioneerNotes');
  if (!firstEl || !lastEl) return;
  const first_name = firstEl.value.trim();
  const last_name = lastEl.value.trim();
  if (!first_name && !last_name) {
    showToast('First or last name is required', 'error');
    firstEl.focus();
    return;
  }
  const email = emailEl ? emailEl.value.trim() : '';
  const notes = notesEl ? notesEl.value.trim() : '';
  try {
    const { status } = await apiCallWithStatus('POST', '/pioneers', { first_name, last_name, email: email || null, notes: notes || null });
    hideModal();
    // Reset filter state so the new/matched pioneer is visible.
    window._pioneersFilters = { search: '', practice: [], role: [], status: [], sort_field: 'last_name', sort_dir: 'asc' };
    await renderPioneersIndex();
    // 200 = find-or-create matched an existing pioneer; 201 = newly created.
    showToast(status === 200 ? 'Pioneer already existed — selected' : 'Pioneer added');
  } catch (e) {
    showToast('Failed to create pioneer: ' + (e && e.message ? e.message : String(e)), 'error');
  }
}

// ── Project Detail Page ───────────────────────────────────────────────────────

async function renderProjectDetail(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading project…</div>';

  let project;
  try {
    project = await apiCall('GET', '/projects/' + id);
  } catch (e) {
    mc.innerHTML = '<p class="empty-state">Failed to load project: ' + esc(e && e.message ? e.message : String(e)) + '</p>';
    return;
  }

  const metrics = project.metrics || {};
  const pioneers = project.pioneers || [];
  const legacyTeam = project.legacy_team || [];

  let html = `
    <div style="max-width:1100px" data-testid="project-detail">
      ${renderProjectHeader(project, metrics)}
      ${renderProjectActivityStrip(project, metrics, pioneers)}
      <div style="margin-bottom:20px">
        <h2 style="font-size:15px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 10px">Performance</h2>
        <div class="metric-chips-grid" style="display:flex;gap:8px;flex-wrap:wrap">
          ${renderProjectFlywheelChips(metrics)}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        ${renderProjectSpecCard(project)}
        ${renderProjectPioneersCard(pioneers)}
      </div>
      ${renderEconomicsCard(project, metrics)}
      <div style="margin-top:16px">
        ${renderProjectLegacyTeamCard(legacyTeam, project.currency)}
      </div>
      <div style="margin-top:20px">
        ${renderProjectExpertResponsesCard(project, pioneers)}
      </div>
      <div style="margin-top:20px">
        <h2 style="font-size:15px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 10px">Charts</h2>
        <div id="projectCharts"></div>
      </div>
    </div>
  `;
  mc.innerHTML = html;
  await renderProjectCharts(project, metrics);
}

function renderProjectHeader(project, metrics) {
  const isWriter = canWrite();
  const editBtn = isWriter ? `
    <button class="btn btn-secondary btn-sm" data-testid="project-detail-edit"
            onclick="window.location.hash='#edit/${project.id}'">Edit</button>
  ` : '';
  const practiceBadge = project.practice_code
    ? `<span class="practice-badge" style="background:var(--gray-100,#f3f4f6);color:var(--gray-700,#374151);padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${esc(project.practice_code)}</span>`
    : '';
  const categoryBadge = project.category_name
    ? `<span style="background:var(--gray-100,#f3f4f6);color:var(--gray-700,#374151);padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${esc(project.category_name)}</span>`
    : '';
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <a href="#" onclick="window.location.hash='#projects';return false;"
           style="font-size:13px;color:var(--brand-blue,#6EC1E4);text-decoration:none;display:inline-block;margin-bottom:6px">
          ← Projects
        </a>
        <h1 style="margin:0 0 4px">${esc(project.project_name)}</h1>
        ${project.client_name ? '<div style="color:#6b7280;font-size:14px;margin-bottom:6px">Client: ' + esc(project.client_name) + '</div>' : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${practiceBadge}
          ${categoryBadge}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        ${editBtn}
      </div>
    </div>
  `;
}
function renderProjectActivityStrip(project, metrics, pioneers) {
  // Status badge (matches the dashboard's badge classes).
  const status = project.status || 'pending';
  const statusBadgeMap = {
    'complete': '<span class="badge badge-green">Complete</span>',
    'partial':  '<span class="badge badge-warning">Partial</span>',
    'pending':  '<span class="badge badge-orange">Expert Pending</span>',
  };
  const statusBadge = statusBadgeMap[status] || `<span class="badge">${esc(status)}</span>`;

  // Pioneer + completion summary.
  const totalPioneers = pioneers.length;
  const completedPioneers = pioneers.filter(p => (p.response_count || 0) >= (p.total_rounds || 1)).length;
  const totalRounds = pioneers.reduce((sum, p) => sum + (p.total_rounds || 1), 0);
  const completedRounds = pioneers.reduce((sum, p) => sum + (p.response_count || 0), 0);
  const completionPct = totalRounds > 0 ? Math.round((completedRounds / totalRounds) * 100) + '%' : '—';
  const roundsText = totalRounds > 0 ? completedRounds + '/' + totalRounds + ' rounds' : '—';

  // Last activity = max submitted_at across pioneer rounds, fallback to date_delivered.
  let lastActivity = null;
  pioneers.forEach(p => {
    (p.rounds || []).forEach(r => {
      if (r.completed_at && (!lastActivity || r.completed_at > lastActivity)) lastActivity = r.completed_at;
    });
  });
  if (!lastActivity && project.date_delivered) lastActivity = project.date_delivered;
  const lastActivityText = lastActivity ? lastActivity.split('T')[0] : '—';

  return `
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--gray-50,#f9fafb);border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;margin-bottom:20px">
      <div>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Status</span>
        ${statusBadge}
      </div>
      <div>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Pioneers</span>
        <span style="font-size:14px;font-weight:600">${totalPioneers}</span>
        ${totalPioneers > 0 ? `<span style="font-size:12px;color:#6b7280;margin-left:4px">${completedPioneers} completed</span>` : ''}
      </div>
      <div>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Completion</span>
        <span style="font-size:14px;font-weight:600">${completionPct}</span>
        <span style="font-size:12px;color:#6b7280;margin-left:4px">${roundsText}</span>
      </div>
      <div>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Last Activity</span>
        <span style="font-size:14px">${esc(lastActivityText)}</span>
      </div>
    </div>
  `;
}
function renderProjectFlywheelChips(metrics) {
  // metrics is `project.metrics || {}` from renderProjectDetail — empty object means no responses yet.
  if (!metrics || metrics.productivity_ratio == null) {
    return '<p style="color:#9ca3af;font-size:13px;margin:0">No metrics yet — submit an expert response to populate scores.</p>';
  }
  return [
    pioneerChip('Machine-First', metrics.machine_first_score, 'ratio'),
    pioneerChip('Senior-Led', metrics.senior_led_score, 'ratio'),
    pioneerChip('Knowledge', metrics.proprietary_knowledge_score, 'ratio'),
    pioneerChip('Quality', metrics.quality_score, 'pct'),
    pioneerChip('Value Gain', metrics.productivity_ratio, 'ratio'),
  ].join('');
}
function renderProjectSpecCard(project) {
  const rows = [
    ['Category', project.category_name || '—'],
    ['Practice', project.practice_code || '—'],
    ['Pricing model', project.xcsg_pricing_model || '—'],
    ['Currency', project.currency || '—'],
    ['Started', project.date_started || '—'],
    ['Delivered', project.date_delivered || '—'],
    ['Working days', project.working_days != null ? String(project.working_days) : '—'],
    ['xCSG team size', project.xcsg_team_size || '—'],
    ['xCSG revision rounds', project.xcsg_revision_rounds != null ? String(project.xcsg_revision_rounds) : '—'],
  ];
  const rowHtml = rows.map(r => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100,#f3f4f6);font-size:13px">
      <span style="color:#6b7280">${esc(r[0])}</span>
      <span style="font-weight:600;color:var(--gray-700,#374151);text-align:right">${esc(r[1])}</span>
    </div>
  `).join('');
  return `
    <div style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff" data-testid="project-spec-card">
      <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 12px">Specialization</h2>
      ${rowHtml}
    </div>
  `;
}
function renderProjectPioneersCard(pioneers) {
  if (!pioneers || pioneers.length === 0) {
    return `
      <div style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff" data-testid="project-pioneers-card">
        <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 12px">Pioneers</h2>
        <p style="color:#9ca3af;font-size:13px;margin:0">No pioneers assigned.</p>
      </div>
    `;
  }
  const rows = pioneers.map(p => {
    const name = p.display_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || '—';
    const role = p.role_name || '—';
    const rate = p.day_rate != null ? p.day_rate.toLocaleString() : '—';
    const rounds = (p.response_count || 0) + '/' + (p.total_rounds || 1);
    const linkedName = p.pioneer_id
      ? `<a href="#pioneer/${p.pioneer_id}" style="color:var(--brand-blue,#6EC1E4);text-decoration:none">${esc(name)}</a>`
      : esc(name);
    return `<tr>
      <td>${linkedName}</td>
      <td>${esc(role)}</td>
      <td>${rate}</td>
      <td>${rounds}</td>
    </tr>`;
  }).join('');
  return `
    <div style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff" data-testid="project-pioneers-card">
      <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 12px">Pioneers (${pioneers.length})</h2>
      <table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Name</th><th>Role</th><th>Day rate</th><th>Rounds</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
function renderProjectLegacyTeamCard(legacyTeam, currency) {
  if (!Array.isArray(legacyTeam) || legacyTeam.length === 0) {
    return `
      <div class="card" data-testid="project-legacy-team-card" style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff">
        <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 8px">Legacy Team Mix</h2>
        <p style="color:#9ca3af;font-size:13px;margin:0">No legacy team configured. Add one on the project edit form to enable cost comparison.</p>
      </div>
    `;
  }
  const fc = (v) => fmtCurrency(v, currency || 'USD');
  let totalCount = 0;
  let totalDailyCost = 0;
  const rows = legacyTeam.map(r => {
    const count = parseInt(r.count, 10) || 0;
    const rate = parseFloat(r.day_rate) || 0;
    const dailyCost = count * rate;
    totalCount += count;
    totalDailyCost += dailyCost;
    return `<tr>
      <td><strong>${esc(r.role_name || '—')}</strong></td>
      <td>${count}</td>
      <td>${fc(rate)}</td>
      <td>${fc(dailyCost)}</td>
    </tr>`;
  }).join('');
  return `
    <div class="card" data-testid="project-legacy-team-card" style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff">
      <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 12px">Legacy Team Mix</h2>
      <table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Role</th><th>Count</th><th>Day rate</th><th>Daily cost</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--gray-300,#d1d5db);font-weight:600">
            <td>Total</td><td>${totalCount}</td><td>—</td><td>${fc(totalDailyCost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
function renderProjectExpertResponsesCard(project, pioneers) {
  // Flatten pioneer×round into a list of completed rounds.
  const rows = [];
  pioneers.forEach(p => {
    (p.rounds || []).forEach(r => {
      if (r.completed_at) {
        rows.push({
          pioneer_id: p.pioneer_id,
          pioneer_name: p.display_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim(),
          round_number: r.round_number,
          completed_at: r.completed_at,
          token: r.token,
        });
      }
    });
  });

  if (rows.length === 0) {
    return `
      <div class="card" data-testid="project-responses-card" style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff">
        <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 8px">Expert Responses</h2>
        <p style="color:#9ca3af;font-size:13px;margin:0">No expert responses submitted yet.</p>
      </div>
    `;
  }

  rows.sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''));
  const rowHtml = rows.map(r => `
    <tr>
      <td><strong>R${r.round_number || '?'}</strong></td>
      <td>${r.pioneer_id ? `<a href="#pioneer/${r.pioneer_id}" style="color:var(--brand-blue,#6EC1E4);text-decoration:none">${esc(r.pioneer_name)}</a>` : esc(r.pioneer_name)}</td>
      <td>${esc((r.completed_at || '').split('T')[0])}</td>
      <td>${r.token ? `<a href="#expert/${esc(r.token)}" style="color:var(--brand-blue,#6EC1E4);text-decoration:none">View answers →</a>` : ''}</td>
    </tr>
  `).join('');
  return `
    <div class="card" data-testid="project-responses-card" style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff">
      <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 12px">Expert Responses (${rows.length})</h2>
      <table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Round</th><th>Pioneer</th><th>Submitted</th><th></th></tr></thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
  `;
}
async function renderProjectCharts(project, metrics) {
  const cont = document.getElementById('projectCharts');
  if (!cont) return;

  // Decide which charts to show. Per-round timeline only makes sense with 2+ submitted rounds.
  const totalRoundsSubmitted = (project.pioneers || []).reduce((sum, p) => {
    return sum + ((p.rounds || []).filter(r => r.completed_at).length);
  }, 0);
  const showTimeline = totalRoundsSubmitted > 1;

  // No metrics → no charts.
  if (!metrics || metrics.productivity_ratio == null) {
    cont.innerHTML = `<p style="color:var(--gray-500,#6b7280);font-size:13px">Charts will appear once an expert response is submitted.</p>`;
    return;
  }

  // Build chart containers.
  const timelineCard = !showTimeline ? '' : `
    <div>
      <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Per-Round Timeline</h3>
      <div id="projectChartTimeline" data-testid="project-chart-timeline" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
    </div>`;
  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Gains Radar</h3>
        <div id="projectChartRadar" data-testid="project-chart-radar" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Disprove Matrix</h3>
        <div id="projectChartDisprove" data-testid="project-chart-disprove" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
      </div>
      ${timelineCard}
    </div>
  `;

  if (typeof echarts === 'undefined') {
    cont.innerHTML += '<p style="color:var(--gray-500,#6b7280);font-size:13px">Charts library not loaded.</p>';
    return;
  }

  // Need a single-element project list with `metrics` injected (the chart renderers
  // expect each project entry to carry its own metrics dict, mirroring how
  // _build_averaged_complete_projects shapes the dashboard list).
  const projForCharts = Object.assign({}, project, { ...metrics });
  const filtered = [projForCharts];
  const localMetrics = _computeLocalMetrics(filtered);

  function safeRender(rendererKey, divId) {
    const fn = CHART_RENDERERS[rendererKey];
    if (!fn) return;
    const cfg = { id: divId };
    try { fn(cfg, filtered, localMetrics, localMetrics); }
    catch (err) { console.error('Project chart render error [' + rendererKey + ']:', err); }
  }

  safeRender('radar_gains',          'projectChartRadar');
  safeRender('scatter_disprove',     'projectChartDisprove');
  if (showTimeline) safeRender('timeline_per_project', 'projectChartTimeline');

  // Per-pioneer xCSG cost donut — only meaningful with 2+ pioneers.
  const pioneers = project.pioneers || [];
  if (pioneers.length >= 2 && metrics.xcsg_cost != null) {
    const slice = pioneers.map(p => {
      const rate = parseFloat(p.day_rate) || 0;
      const rounds = parseInt(p.total_rounds, 10) || 1;
      const weight = rate * rounds;
      return {
        name: p.display_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || `Pioneer #${p.pioneer_id}`,
        weight,
      };
    });
    const totalWeight = slice.reduce((s, e) => s + e.weight, 0);
    if (totalWeight > 0) {
      const grid = cont.querySelector('div[style*="grid-template-columns"]');
      if (grid) {
        // Build a card div containing h3 + chart div, append to grid.
        const card = document.createElement('div');
        card.innerHTML = `
          <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Cost Composition by Pioneer</h3>
          <div id="projectChartCostByPioneer" data-testid="project-chart-cost-by-pioneer" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
        `;
        grid.appendChild(card);
        const donut = ecInit('projectChartCostByPioneer');
        if (donut) {
          const fc = (v) => fmtCurrency(v, project.currency || 'USD');
          const totalCost = metrics.xcsg_cost;
          donut.setOption({
            tooltip: {
              ...tip(),
              trigger: 'item',
              formatter: (p) => {
                const share = totalWeight > 0 ? p.value / totalWeight : 0;
                const dollars = totalCost * share;
                return `${p.marker}<b>${esc(p.name)}</b><br/>Share: ${(share * 100).toFixed(1)}%<br/>~${fc(dollars)}`;
              },
            },
            legend: { orient: 'vertical', right: 8, top: 'middle', textStyle: { color: '#6B7280', fontFamily: 'Inter, system-ui' } },
            series: [{
              type: 'pie', radius: ['45%', '70%'], center: ['38%', '50%'],
              itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
              label: { show: false }, labelLine: { show: false },
              data: slice.map(s => ({ name: s.name, value: s.weight })),
            }],
          });
        }
      }
    }
  }
}

// ── Pioneer Detail Page (Phase 3b Task 6) ─────────────────────────────────────

async function renderPioneerDetail(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading pioneer…</div>';

  let pioneer;
  try {
    pioneer = await apiCall('GET', '/pioneers/' + id);
  } catch (e) {
    mc.innerHTML = '<p class="empty-state">Failed to load pioneer: ' + esc(e.message || String(e)) + '</p>';
    return;
  }

  let pioneerEconomics = null;
  try {
    pioneerEconomics = await loadPioneerEconomics(id);
  } catch (e) {
    console.warn('Pioneer economics fetch failed:', e);
  }

  const statusBadgeStyle = PIONEER_STATUS_BADGE_STYLES;
  const statusOpts = (schema && schema.pioneer_status_options) ? schema.pioneer_status_options : PIONEER_STATUS_FALLBACK;
  function statusLabel(val) {
    const opt = statusOpts.find(function(o) { return o.value === val; });
    return opt ? opt.label : (val || 'Unknown');
  }

  const badgeStyle = statusBadgeStyle[pioneer.status] || statusBadgeStyle.never;
  const roundsText = pioneer.rounds_expected > 0
    ? pioneer.rounds_completed + '/' + pioneer.rounds_expected + ' rounds'
    : '—';
  const completionPct = pioneer.completion_rate != null
    ? Math.round(pioneer.completion_rate * 100) + '%'
    : '—';
  const lastActivity = pioneer.last_activity_at
    ? pioneer.last_activity_at.split('T')[0]
    : 'Never';

  const adminActions = isAdmin() ? `
    <button class="btn btn-secondary btn-sm" data-testid="pioneer-detail-edit" onclick="openEditPioneerModal(${id})">Edit</button>
    <button class="btn btn-secondary btn-sm" data-testid="pioneer-detail-delete" style="color:#dc2626;border-color:#dc2626" onclick="deletePioneer(${id})">Delete</button>
  ` : '';

  let html = `
    <div style="max-width:1100px">
      <!-- Header strip -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div>
          <a href="#" onclick="window.location.hash='#pioneers';return false;"
             style="font-size:13px;color:var(--brand-blue,#6EC1E4);text-decoration:none;display:inline-block;margin-bottom:6px">
            ← Pioneers
          </a>
          <h1 style="margin:0 0 4px">${esc(pioneer.display_name || ((pioneer.first_name || '') + ' ' + (pioneer.last_name || '')).trim())}</h1>
          ${pioneer.email ? '<div style="color:#6b7280;font-size:14px">' + esc(pioneer.email) + '</div>' : ''}
          ${pioneer.notes ? '<div style="color:#374151;font-size:13px;margin-top:6px;white-space:pre-wrap;max-width:600px">' + esc(pioneer.notes) + '</div>' : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
          ${adminActions}
          <button class="btn btn-secondary btn-sm" onclick="downloadPioneerXlsx(${id})">Download XLSX ↓</button>
        </div>
      </div>

      <!-- Activity strip -->
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--gray-50,#f9fafb);border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;margin-bottom:20px">
        <div>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Status</span>
          <span style="${badgeStyle}border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600">${esc(statusLabel(pioneer.status))}</span>
        </div>
        <div>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Projects</span>
          <span style="font-size:14px;font-weight:600">${pioneer.project_count || 0}</span>
        </div>
        <div>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Completion</span>
          <span style="font-size:14px;font-weight:600">${completionPct}</span>
          <span style="font-size:12px;color:#6b7280;margin-left:4px">${roundsText}</span>
        </div>
        <div>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:2px">Last Activity</span>
          <span style="font-size:14px">${esc(lastActivity)}</span>
        </div>
      </div>

      <!-- Flywheel chips -->
      <div style="margin-bottom:20px">
        <h2 style="font-size:15px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 10px">Performance</h2>
        <div class="metric-chips-grid" style="display:flex;gap:8px;flex-wrap:wrap">
          ${renderPioneerFlywheelChips(pioneer)}
        </div>
      </div>

      <!-- Specialization + Roles (side-by-side) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff">
          <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 12px">Specialization</h2>
          ${renderPioneerSpecialization(pioneer)}
        </div>
        <div style="padding:16px;border:1px solid var(--gray-200,#e5e7eb);border-radius:8px;background:#fff">
          <h2 style="font-size:14px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 12px">Roles Played</h2>
          ${renderPioneerRoles(pioneer)}
        </div>
      </div>

      <!-- Portfolio table -->
      <div style="margin-bottom:20px">
        <h2 style="font-size:15px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 10px">Portfolio</h2>
        ${renderPioneerPortfolio(pioneer)}
      </div>

      <!-- Economics (NEW) -->
      ${pioneerEconomics ? `
        <div style="margin-bottom:20px" data-testid="pioneer-economics-section">
          <h2 style="font-size:15px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 10px">Economics</h2>
          ${renderPioneerEconomicsTiles(pioneerEconomics.summary || {})}
        </div>
      ` : ''}

      <!-- Charts (placeholder for Task 7) -->
      <div style="margin-bottom:20px">
        <h2 style="font-size:15px;font-weight:700;color:var(--navy,#121F6B);margin:0 0 10px">Charts</h2>
        <div id="pioneerCharts"></div>
        <!-- Task 7 will call renderPioneerCharts(pioneer) to populate this div -->
      </div>
    </div>
  `;

  mc.innerHTML = html;

  // Task 7: populate pioneer-scoped charts now that the DOM is ready.
  await renderPioneerCharts(pioneer, pioneerEconomics);
}

async function renderPioneerCharts(pioneer, pioneerEconomics) {
  const cont = document.getElementById('pioneerCharts');
  if (!cont) return;

  const econ = pioneerEconomics || {};
  const breakdowns = econ.breakdowns || {};
  const trends = econ.trends || {};
  const hasPricing = Array.isArray(breakdowns.by_pricing_model) && breakdowns.by_pricing_model.length > 0;
  const hasQuarterlyEcon = Array.isArray(trends.quarterly) && trends.quarterly.length > 0;

  // Top row: 4 flywheel charts (Radar / Disprove / Timeline / Quarterly).
  // Bottom row: 2 economics charts (pricing donut + quarterly revenue line) — only when data is available.
  const economicsRow = (hasPricing || hasQuarterlyEcon) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px">
      ${hasPricing ? `
        <div>
          <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Pricing Model Mix</h3>
          <div id="pioneerEconChartPricing" data-testid="pioneer-econ-chart-pricing" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
        </div>
      ` : ''}
      ${hasQuarterlyEcon ? `
        <div>
          <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Quarterly Revenue</h3>
          <div id="pioneerEconChartQuarterly" data-testid="pioneer-econ-chart-quarterly" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
        </div>
      ` : ''}
    </div>
  ` : '';

  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:8px">
      <div>
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Gains Radar</h3>
        <div id="pioneerChartRadar" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Disprove Matrix</h3>
        <div id="pioneerChartDisprove" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Per-project Timeline</h3>
        <div id="pioneerChartTimeline" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:600;color:var(--gray-600,#6b7280);text-transform:uppercase;letter-spacing:.5px">Quarterly Trend</h3>
        <div id="pioneerChartQuarterly" style="height:300px;background:#fff;border:1px solid var(--gray-200,#e5e7eb);border-radius:6px"></div>
      </div>
    </div>
    ${economicsRow}
  `;

  if (typeof echarts === 'undefined') {
    cont.innerHTML += '<p style="color:var(--gray-500,#6b7280);font-size:13px">Charts library not loaded.</p>';
    return;
  }

  // Fetch or reuse the project list.  We need each project's metrics array
  // to feed the chart renderers.  Use the cached list if it covers all projects,
  // otherwise fetch directly.
  let allProjects;
  try {
    allProjects = _projectsCache && _projectsCache.length
      ? _projectsCache
      : await apiCall('GET', '/projects');
  } catch (e) {
    cont.innerHTML += '<p style="color:var(--gray-500,#6b7280);font-size:13px">Could not load project data: ' + esc(e && e.message ? e.message : String(e)) + '</p>';
    return;
  }

  // Filter to projects that include this pioneer.
  const pioneerId = pioneer.id;
  const filtered = allProjects.filter(function(p) {
    return (p.pioneers || []).some(function(pi) { return pi.pioneer_id === pioneerId; });
  });

  // Compute aggregated metrics from the filtered list (same logic as the dashboard).
  const localMetrics = _computeLocalMetrics(filtered);

  // The registered renderers take (cfg, filtered, localMetrics, dashboard).
  // cfg only needs an `id` field pointing to the container div.
  // The `dashboard` argument is only used by track_scaling_gates; pass localMetrics
  // as a safe fallback so the other four renderers (which ignore it) still work.
  function safeRender(rendererKey, divId) {
    const fn = CHART_RENDERERS[rendererKey];
    if (!fn) return;
    const cfg = { id: divId };
    try { fn(cfg, filtered, localMetrics, localMetrics); }
    catch (err) { console.error('Pioneer chart render error [' + rendererKey + ']:', err); }
  }

  safeRender('radar_gains',          'pioneerChartRadar');
  safeRender('scatter_disprove',     'pioneerChartDisprove');
  safeRender('timeline_per_project', 'pioneerChartTimeline');
  safeRender('timeline_quarterly',   'pioneerChartQuarterly');

  // ── Economics charts (only when pioneer has economic data) ──
  if (hasPricing) {
    const baseCurrency = (econ.summary && econ.summary.base_currency) || 'USD';
    const fc = (v) => fmtCurrency(v, baseCurrency);
    const donut = ecInit('pioneerEconChartPricing');
    if (donut) {
      const total = breakdowns.by_pricing_model.reduce((acc, e) => acc + (e.revenue || 0), 0) || 1;
      donut.setOption({
        tooltip: {
          ...tip(),
          trigger: 'item',
          formatter: (p) => `${p.marker}<b>${esc(p.name)}</b><br/>Revenue: ${fc(p.value)}<br/>Share: ${(p.value / total * 100).toFixed(1)}%`,
        },
        legend: { orient: 'vertical', right: 8, top: 'middle', textStyle: { color: '#6B7280', fontFamily: 'Inter, system-ui' } },
        series: [{
          type: 'pie', radius: ['45%', '70%'], center: ['38%', '50%'],
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false }, labelLine: { show: false },
          data: breakdowns.by_pricing_model.map(e => ({ name: e.model, value: e.revenue || 0 })),
        }],
      });
    }
  }

  if (hasQuarterlyEcon) {
    const baseCurrency = (econ.summary && econ.summary.base_currency) || 'USD';
    const fc = (v) => fmtCurrency(v, baseCurrency);
    const line = ecInit('pioneerEconChartQuarterly');
    if (line) {
      line.setOption({
        tooltip: {
          ...tip(),
          trigger: 'axis',
          formatter: (params) => {
            const p = params[0];
            return `<b>${esc(p.axisValueLabel)}</b><br/>Revenue: ${fc(p.value)}`;
          },
        },
        grid: { left: 70, right: 16, top: 16, bottom: 32 },
        xAxis: { type: 'category', data: trends.quarterly.map(q => q.quarter), axisLabel: axisLbl() },
        yAxis: { type: 'value', axisLabel: { ...axisLbl(), formatter: (v) => fc(v) } },
        series: [{
          type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
          data: trends.quarterly.map(q => q.revenue || 0),
          itemStyle: { color: '#6EC1E4' },
          lineStyle: { color: '#6EC1E4', width: 2 },
          areaStyle: { color: 'rgba(110,193,228,0.18)' },
        }],
      });
    }
  }

  // Show a gentle empty-state message when the pioneer has no assessed projects.
  const done = filtered.filter(function(p) { return p.metrics && (p.status === 'complete' || p.status === 'partial'); });
  if (!done.length) {
    const msgEl = document.createElement('p');
    msgEl.style.cssText = 'color:var(--gray-500,#6b7280);font-size:13px;margin-top:8px';
    msgEl.textContent = 'No assessed projects yet — charts will populate once expert surveys are submitted.';
    cont.appendChild(msgEl);
  }
}

function pioneerChip(label, value, kind) {
  // kind: 'ratio' | 'pct'
  const tone = kind === 'pct' ? pctTone(value) : ratioTone(value);
  const formatted = kind === 'pct' ? fmtPctMaybe(value) : fmtRatioMaybe(value);
  return `<div class="assessment-metric-chip ${tone}">
    <span class="chip-value">${formatted}</span>
    <span class="chip-label">${esc(label)}</span>
  </div>`;
}

function renderPioneerFlywheelChips(pioneer) {
  return [
    pioneerChip('Machine-First', pioneer.avg_machine_first, 'ratio'),
    pioneerChip('Senior-Led', pioneer.avg_senior_led, 'ratio'),
    pioneerChip('Knowledge', pioneer.avg_knowledge, 'ratio'),
    pioneerChip('Quality', pioneer.avg_quality_score, 'pct'),
    pioneerChip('Value Gain', pioneer.avg_value_gain, 'ratio'),
  ].join('');
}

function renderPioneerSpecialization(pioneer) {
  const practices = pioneer.practices || [];
  if (practices.length === 0) {
    return '<p style="color:#9ca3af;font-size:13px;margin:0">No projects yet.</p>';
  }
  const maxCount = Math.max.apply(null, practices.map(function(p) { return p.count || 0; }));
  let html = '';
  practices.forEach(function(pr) {
    const pct = maxCount > 0 ? Math.round((pr.count / maxCount) * 100) : 0;
    html += '<div style="margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
      + '<code style="font-size:12px;background:var(--gray-100,#f3f4f6);padding:1px 5px;border-radius:3px">'
      + esc(pr.code) + ' (' + pr.count + ' project' + (pr.count !== 1 ? 's' : '') + ')</code>'
      + '</div>'
      + '<div style="background:var(--gray-100,#f3f4f6);border-radius:3px;height:14px;position:relative">'
      + '<div style="background:var(--brand-blue,#6EC1E4);width:' + pct + '%;height:100%;border-radius:3px"></div>'
      + '</div>'
      + '</div>';
  });
  return html;
}

function renderPioneerRoles(pioneer) {
  const roles = pioneer.roles || [];
  if (roles.length === 0) {
    return '<p style="color:#9ca3af;font-size:13px;margin:0">No roles assigned yet.</p>';
  }
  let html = '<div style="display:flex;flex-direction:column;gap:6px">';
  roles.forEach(function(r) {
    html += '<div style="display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:13px;color:#374151">' + esc(r.role_name) + '</span>'
      + '<span style="font-size:11px;color:#9ca3af;background:var(--gray-100,#f3f4f6);border-radius:10px;padding:1px 7px">'
      + '×' + r.count + '</span>'
      + '</div>';
  });
  html += '</div>';
  return html;
}

function renderPioneerPortfolio(pioneer) {
  const portfolio = pioneer.portfolio || [];
  if (portfolio.length === 0) {
    return '<p style="color:#9ca3af;font-size:13px">No projects in portfolio yet.</p>';
  }

  const statusBadgeStyle = {
    draft: 'background:#f3f4f6;color:#374151;',
    active: 'background:#dbeafe;color:#1e40af;',
    complete: 'background:#d1fae5;color:#065f46;',
    archived: 'background:#f3f4f6;color:#6b7280;',
  };

  let html = '<div style="overflow-x:auto"><table class="data-table" style="min-width:700px;width:100%"><thead><tr>'
    + '<th>ID</th><th>Project</th><th>Practice</th><th>Role</th>'
    + '<th>Day Rate</th><th>Rounds</th><th>Status</th><th>Last Activity</th>'
    + '</tr></thead><tbody>';

  portfolio.forEach(function(row) {
    const rounds = row.rounds_expected > 0
      ? (row.rounds_completed || 0) + '/' + row.rounds_expected
      : (row.rounds_completed || 0) + '/—';
    const dayRate = row.day_rate != null ? row.day_rate.toLocaleString() : '—';
    const lastAct = row.last_activity_at ? row.last_activity_at.split('T')[0] : '—';
    const badgeSt = statusBadgeStyle[row.status] || 'background:#f3f4f6;color:#6b7280;';
    html += '<tr style="cursor:pointer" onclick="window.location.hash=\'#project/' + row.project_id + '\'">'
      + '<td style="font-size:12px;color:#6b7280">' + row.project_id + '</td>'
      + '<td><strong>' + esc(row.project_name || '') + '</strong></td>'
      + '<td>' + esc(row.practice_code || '—') + '</td>'
      + '<td>' + esc(row.role_name || '—') + '</td>'
      + '<td style="text-align:right">' + dayRate + '</td>'
      + '<td style="text-align:center">' + rounds + '</td>'
      + '<td><span style="' + badgeSt + 'border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">'
        + esc(row.status || '—') + '</span></td>'
      + '<td style="font-size:12px;white-space:nowrap">' + lastAct + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

async function openEditPioneerModal(id) {
  let pioneer;
  try {
    pioneer = await apiCall('GET', '/pioneers/' + id);
  } catch (e) {
    showToast('Failed to load pioneer: ' + (e && e.message ? e.message : String(e)), 'error');
    return;
  }

  showModal(`
    <div style="padding:8px">
      <h2 style="margin-top:0">Edit Pioneer</h2>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div class="form-group" style="flex:1">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">First name *</label>
          <input type="text" id="editPioneerFirstName" data-testid="edit-pioneer-first-name" maxlength="80" value="${esc(pioneer.first_name || '')}" style="width:100%;box-sizing:border-box">
        </div>
        <div class="form-group" style="flex:1">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Last name *</label>
          <input type="text" id="editPioneerLastName" data-testid="edit-pioneer-last-name" maxlength="80" value="${esc(pioneer.last_name || '')}" style="width:100%;box-sizing:border-box">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Email</label>
        <input type="email" id="editPioneerEmail" maxlength="200" value="${esc(pioneer.email || '')}" style="width:100%;box-sizing:border-box">
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Notes</label>
        <textarea id="editPioneerNotes" maxlength="2000" rows="3" style="width:100%;box-sizing:border-box">${esc(pioneer.notes || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-primary" data-testid="edit-pioneer-save" onclick="submitEditPioneer(${id})">Save</button>
        <button class="btn btn-secondary" data-testid="edit-pioneer-cancel" onclick="hideModal()">Cancel</button>
      </div>
    </div>
  `);
  setTimeout(function() {
    const el = document.getElementById('editPioneerFirstName');
    if (el) el.focus();
  }, 50);
}

async function submitEditPioneer(id) {
  const firstEl = document.getElementById('editPioneerFirstName');
  const lastEl = document.getElementById('editPioneerLastName');
  const emailEl = document.getElementById('editPioneerEmail');
  const notesEl = document.getElementById('editPioneerNotes');
  if (!firstEl || !lastEl) return;
  const first_name = firstEl.value.trim();
  const last_name = lastEl.value.trim();
  if (!first_name && !last_name) {
    showToast('First or last name is required', 'error');
    firstEl.focus();
    return;
  }
  const email = emailEl ? emailEl.value.trim() : '';
  const notes = notesEl ? notesEl.value.trim() : '';
  try {
    await apiCall('PUT', '/pioneers/' + id, { first_name, last_name, email: email || null, notes: notes || null });
    hideModal();
    showToast('Pioneer updated');
    await renderPioneerDetail(id);
  } catch (e) {
    showToast('Failed to update pioneer: ' + (e && e.message ? e.message : String(e)), 'error');
  }
}

async function deletePioneer(id) {
  if (!confirm('Delete this pioneer? This cannot be undone.')) return;
  try {
    await apiCall('DELETE', '/pioneers/' + id);
    showToast('Pioneer deleted');
    window.location.hash = '#pioneers';
  } catch (e) {
    if (e && e.status === 409) {
      // Pioneer is still assigned to projects — show helpful detail message.
      const detail = (e.detail && typeof e.detail === 'object') ? e.detail.message : (e.message || 'Pioneer is assigned to projects.');
      alert('Cannot delete: ' + detail);
    } else {
      showToast('Failed to delete pioneer: ' + (e && e.message ? e.message : String(e)), 'error');
    }
  }
}

function downloadPioneerXlsx(id) {
  const headers = {};
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  fetch('/api/export/pioneer/' + id + '.xlsx', { headers })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    })
    .then(function(blob) {
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = 'pioneer-' + id + '.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    })
    .catch(function(e) { showToast('Download failed: ' + (e && e.message ? e.message : String(e)), 'error'); });
}

function renderMethodology() {
  const mc = document.getElementById('mainContent');

  let html = '<div class="methodology-page">';

  // Overview
  html += `<div class="meth-section">
    <div class="meth-section-header">
      <div class="meth-section-icon">\uD83D\uDCD6</div>
      <div><h2 class="meth-section-title">Overview</h2></div>
    </div>
    <p class="meth-intro">The tracker compares xCSG (AI-augmented) delivery against traditional (legacy) methods across multiple dimensions. All ratios >1\u00D7 mean xCSG outperforms. Signal metrics are shown as percentages. Scaling gates are binary pass/fail milestones that validate readiness to scale.</p>
  </div>`;

  // Core Metrics
  const coreKeys = ['delivery_speed', 'output_quality', 'productivity_ratio', 'rework_efficiency'];
  html += `<div class="meth-section">
    <div class="meth-section-header">
      <div class="meth-section-icon">\uD83C\uDFAF</div>
      <div><h2 class="meth-section-title">Core Metrics</h2><p class="meth-section-subtitle">Speed, quality, value gain, and rework efficiency</p></div>
    </div>`;
  for (const key of coreKeys) html += _metricAccordionHTML(key, METRIC_DETAILS[key], false);
  html += '</div>';

  // Flywheel Metrics
  const flywheelKeys = ['machine_first_score', 'senior_led_score', 'proprietary_knowledge_score', 'client_impact', 'data_independence'];
  html += `<div class="meth-section">
    <div class="meth-section-header">
      <div class="meth-section-icon">\uD83D\uDD04</div>
      <div><h2 class="meth-section-title">Flywheel Metrics</h2><p class="meth-section-subtitle">Machine-first, senior-led, knowledge, client impact, data independence</p></div>
    </div>`;
  for (const key of flywheelKeys) html += _metricAccordionHTML(key, METRIC_DETAILS[key], false);
  html += '</div>';

  // Signal Metrics
  const signalKeys = ['reuse_intent_avg', 'ai_survival_avg', 'client_pulse_avg'];
  html += `<div class="meth-section">
    <div class="meth-section-header">
      <div class="meth-section-icon">\uD83D\uDCE1</div>
      <div><h2 class="meth-section-title">Signal Metrics</h2><p class="meth-section-subtitle">Forward-looking indicators displayed as percentages</p></div>
    </div>`;
  for (const key of signalKeys) html += _metricAccordionHTML(key, METRIC_DETAILS[key], false);
  html += '</div>';

  // Scaling Gates
  html += `<div class="meth-section">
    <div class="meth-section-header">
      <div class="meth-section-icon">\uD83D\uDE80</div>
      <div><h2 class="meth-section-title">Scaling Gates</h2><p class="meth-section-subtitle">7 binary milestones that validate readiness to scale</p></div>
    </div>
    <div class="meth-gates-list">`;
  for (let i = 0; i < SCALING_GATE_DETAILS.length; i++) {
    const g = SCALING_GATE_DETAILS[i];
    html += `<div class="meth-gate-item">
      <div class="meth-gate-number">${i + 1}</div>
      <div class="meth-gate-content">
        <div class="meth-gate-name">${esc(g.name)}</div>
        <div class="meth-gate-threshold">${esc(g.threshold)}</div>
        <div class="meth-gate-desc">${esc(g.description)}</div>
      </div>
    </div>`;
  }
  html += '</div></div>';

  // How Scores Are Computed
  html += `<div class="meth-section">
    <div class="meth-section-header">
      <div class="meth-section-icon">\u2699\uFE0F</div>
      <div><h2 class="meth-section-title">How Scores Are Computed</h2><p class="meth-section-subtitle">From survey responses to ratios</p></div>
    </div>
    <div class="meth-scoring-explainer">
      <div class="meth-scoring-step">
        <div class="meth-step-num">1</div>
        <div><strong>Expert responds</strong> \u2014 Each expert picks an option for each survey question (e.g., "Exceptional", "Strong", "Adequate", "Superficial").</div>
      </div>
      <div class="meth-scoring-step">
        <div class="meth-step-num">2</div>
        <div><strong>Option \u2192 Score</strong> \u2014 Each option maps to a numeric score between 0.0 and 1.0 (defined in the schema). Higher = better.</div>
      </div>
      <div class="meth-scoring-step">
        <div class="meth-step-num">3</div>
        <div><strong>Scores averaged</strong> \u2014 Where a metric uses multiple fields (e.g., Output Quality uses C6 + C7 + C8), scores are averaged within each side (xCSG, legacy).</div>
      </div>
      <div class="meth-scoring-step">
        <div class="meth-step-num">4</div>
        <div><strong>Ratio computed</strong> \u2014 The xCSG score is divided by the legacy score. A result of 2\u00D7 means xCSG scored twice as high. Ratios are capped at 10\u00D7 when the legacy score is zero but xCSG is nonzero.</div>
      </div>
      <div class="meth-scoring-step">
        <div class="meth-step-num">5</div>
        <div><strong>Portfolio aggregation</strong> \u2014 Dashboard KPIs show the average ratio across all completed projects. Signal metrics are averaged as percentages.</div>
      </div>
    </div>
  </div>`;

  html += '</div>';
  mc.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════════════════
   METRIC SIDE PANEL
   ═══════════════════════════════════════════════════════════════════════ */

function _metricPanelContentHTML(key) {
  const detail = METRIC_DETAILS[key];
  if (!detail) return '<p>Metric details not available.</p>';

  const isSignal = detail.format === 'pct';
  const exHeader = isSignal
    ? '<tr><th>Source</th><th>Response</th><th class="r">Score</th></tr>'
    : '<tr><th></th><th class="r">xCSG</th><th class="r">Legacy</th></tr>';
  const exRows = detail.example.rows.map(r => {
    if (isSignal) {
      return `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="r">${esc(r[2])}</td></tr>`;
    }
    return `<tr><td>${esc(r[0])}</td><td class="r">${esc(r[1])}</td><td class="r">${esc(r[2])}</td></tr>`;
  }).join('');

  return `
    <div class="panel-metric-header">
      <span class="panel-metric-icon">${detail.icon}</span>
      <span class="panel-metric-label">${esc(detail.label)}</span>
      <span class="meth-format-badge">${detail.format === 'pct' ? '%' : 'N\u00D7'}</span>
    </div>
    <div class="meth-detail-section">
      <div class="meth-detail-title">What it measures</div>
      <p>${esc(detail.what)}</p>
    </div>
    <div class="meth-detail-section">
      <div class="meth-detail-title">Formula</div>
      <div class="meth-formula-box">${esc(detail.formula)}</div>
      <p class="meth-formula-note">${esc(detail.formulaDetail)}</p>
    </div>
    <div class="meth-detail-section">
      <div class="meth-detail-title">Data sources</div>
      <ul class="meth-sources-list">
        <li><strong>xCSG:</strong> ${esc(detail.sources.xcsg)}</li>
        <li><strong>Legacy:</strong> ${esc(detail.sources.legacy)}</li>
      </ul>
      <p class="meth-sources-note">${esc(detail.sources.note)}</p>
    </div>
    <div class="meth-detail-section">
      <div class="meth-detail-title">Worked example</div>
      <table class="meth-example-table">
        <thead>${exHeader}</thead>
        <tbody>${exRows}</tbody>
        <tfoot><tr><td colspan="3" class="meth-example-result"><strong>${esc(detail.example.resultLabel)}:</strong> <span class="meth-result-value">${esc(detail.example.result)}</span></td></tr></tfoot>
      </table>
    </div>
    <div class="meth-detail-section meth-how-to-read">
      <div class="meth-detail-title">How to read</div>
      <p>${esc(detail.howToRead)}</p>
    </div>
    <a href="#methodology" class="panel-view-all" onclick="closeMetricPanel()">View all metrics \u2192</a>
  `;
}

function openMetricPanel(metricKey) {
  let panel = document.getElementById('metricSidePanel');
  let backdrop = document.getElementById('metricPanelBackdrop');
  if (!panel) {
    // Create panel and backdrop
    backdrop = document.createElement('div');
    backdrop.id = 'metricPanelBackdrop';
    backdrop.className = 'metric-panel-backdrop';
    backdrop.addEventListener('click', closeMetricPanel);
    document.body.appendChild(backdrop);

    panel = document.createElement('div');
    panel.id = 'metricSidePanel';
    panel.className = 'metric-side-panel';
    panel.innerHTML = '<button class="panel-close-btn" onclick="closeMetricPanel()">\u00D7</button><div class="panel-content" id="panelContent"></div>';
    document.body.appendChild(panel);
  }

  const content = document.getElementById('panelContent');
  if (content) content.innerHTML = _metricPanelContentHTML(metricKey);

  requestAnimationFrame(() => {
    backdrop.classList.add('active');
    panel.classList.add('active');
  });
}

function closeMetricPanel() {
  const panel = document.getElementById('metricSidePanel');
  const backdrop = document.getElementById('metricPanelBackdrop');
  if (panel) panel.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

// Map KPI labels to metric keys for info icons
const LABEL_TO_METRIC_KEY = {
  'Delivery Speed': 'delivery_speed',
  'Output Quality': 'output_quality',
  'xCSG Value Gain': 'productivity_ratio',
  'Rework Efficiency': 'rework_efficiency',
  'Machine-First Gain': 'machine_first_score',
  'Senior-Led Gain': 'senior_led_score',
  'Knowledge Gain': 'proprietary_knowledge_score',
  'Client Impact': 'client_impact',
  'Data Independence': 'data_independence',
  'Reuse Intent': 'reuse_intent_avg',
  'AI Survival': 'ai_survival_avg',
  'Client Pulse': 'client_pulse_avg',
};

function infoIcon(metricKey) {
  return `<span class="metric-info-btn" data-metric="${esc(metricKey)}" onclick="event.stopPropagation();openMetricPanel('${esc(metricKey)}')" title="How this metric works">\u2139</span>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════════════ */

async function exportExcel() {
  try {
    const res = await fetch(API + '/export/excel', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xCSG_Value_Export.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════ */

document.getElementById('globalModal')?.addEventListener('click', function (e) {
  if (e.target === this) hideModal();
});

// Close metric panel on Escape
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeMetricPanel();
});

document.querySelectorAll('.nav-item[data-route]').forEach(el => {
  el.addEventListener('click', () => {
    window.location.hash = '#' + el.dataset.route;
  });
});

on('logoutBtn', 'click', handleLogout);

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

window.addEventListener('hashchange', route);

function restoreUserFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    state.user = {
      id: parseInt(payload.sub),
      username: payload.username,
      name: (payload.username || '').charAt(0).toUpperCase() + (payload.username || '').slice(1),
      role: payload.role,
    };
    const nameEl = document.getElementById('topbarUsername');
    const avatarEl = document.getElementById('topbarAvatar');
    if (nameEl) nameEl.textContent = state.user.name;
    if (avatarEl) avatarEl.textContent = state.user.name[0].toUpperCase();
  } catch { /* invalid token */ }
}

document.addEventListener('DOMContentLoaded', () => {
  if (state.token) {
    restoreUserFromToken(state.token);
    showScreen('app');
    route();
  } else {
    route();
  }
});
