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

const METRIC_DETAILS = {
  delivery_speed: {
    label: 'Delivery Speed', icon: '\u26A1', format: 'ratio', section: 'core',
    what: 'How much faster xCSG delivers compared to legacy methods. Measures total effort in person-days.',
    formula: 'Legacy person-days \u00F7 xCSG person-days',
    formulaDetail: 'Person-days = working days \u00D7 team size',
    sources: {
      xcsg: 'Working days \u00D7 Team size (project configuration)',
      legacy: 'L1 (legacy working days) \u00D7 L2 (legacy team size) from expert survey',
      note: 'Expert survey data takes precedence over project configuration.'
    },
    example: {
      rows: [
        ['Working days', '5', '15'],
        ['Team size', '2', '3'],
        ['Person-days', '10', '45'],
      ],
      result: '4.5\u00D7',
      resultLabel: 'Delivery Speed'
    },
    howToRead: '4.5\u00D7 means xCSG delivered in less than a quarter of the effort. Values above 1\u00D7 indicate xCSG advantage.'
  },
  output_quality: {
    label: 'Output Quality', icon: '\u2B50', format: 'ratio', section: 'core',
    what: 'xCSG output quality relative to legacy, based on expert self-assessment, analytical depth, and decision readiness.',
    formula: 'xCSG quality score \u00F7 Legacy quality score',
    formulaDetail: 'Quality = average of scored quality dimensions. Exceptional=1.0, Strong=0.75, Adequate=0.4, Superficial=0.1',
    sources: {
      xcsg: 'Average of C6 (self-assessment), C7 (analytical depth), C8 (decision readiness)',
      legacy: 'Average of L13 (legacy analytical depth), L14 (legacy decision readiness)',
      note: 'Each option maps to a 0\u20131 score; the ratio compares the two averages.'
    },
    example: {
      rows: [
        ['Quality components', 'C6=1.0, C7=0.75, C8=1.0', 'L13=0.4, L14=0.2'],
        ['Average quality', '0.92', '0.30'],
      ],
      result: '3.07\u00D7',
      resultLabel: 'Output Quality'
    },
    howToRead: '3.07\u00D7 means xCSG output quality is roughly three times higher. Values above 1\u00D7 indicate better quality.'
  },
  productivity_ratio: {
    label: 'xCSG Value Gain', icon: '\uD83C\uDFAF', format: 'ratio', section: 'core',
    what: 'The primary metric. Compares quality per unit of effort between xCSG and legacy delivery.',
    formula: '(xCSG quality \u00F7 xCSG person-days) \u00F7 (Legacy quality \u00F7 Legacy person-days)',
    formulaDetail: 'Quality per person-day ratio \u2014 how much value is produced per unit of effort.',
    sources: {
      xcsg: 'Quality score (avg of C6, C7, C8) \u00F7 person-days (working days \u00D7 team size)',
      legacy: 'Quality score (avg of L13, L14) \u00F7 person-days (L1 \u00D7 L2)',
      note: 'This is the ratio of ratios: combines speed and quality into one number.'
    },
    example: {
      rows: [
        ['Quality score', '0.92', '0.30'],
        ['Person-days', '10', '45'],
        ['Quality / person-day', '0.092', '0.0067'],
      ],
      result: '13.8\u00D7',
      resultLabel: 'xCSG Value Gain'
    },
    howToRead: '13.8\u00D7 means xCSG produces nearly 14 times more quality per unit of effort. This is the single most important metric.'
  },
  rework_efficiency: {
    label: 'Rework Efficiency', icon: '\uD83D\uDD27', format: 'ratio', section: 'core',
    what: 'How smoothly xCSG delivers compared to legacy. Combines revision depth, scope expansion, and client reaction.',
    formula: 'xCSG smoothness \u00F7 Legacy smoothness',
    formulaDetail: 'Smoothness = average of revision depth score, scope expansion score, and client pulse score.',
    sources: {
      xcsg: 'Revision depth, scope expansion, client pulse (project fields)',
      legacy: 'L3 (legacy revision depth), L4 (legacy scope expansion), L5 (legacy client reaction)',
      note: 'Higher smoothness scores mean fewer revisions and better client reception.'
    },
    example: {
      rows: [
        ['Revision depth', '1.0 (none)', '0.55 (moderate)'],
        ['Scope expansion', '0.0 (no)', '0.0 (no)'],
        ['Client pulse', '0.6 (met)', '0.6 (met)'],
        ['Average smoothness', '0.53', '0.38'],
      ],
      result: '1.39\u00D7',
      resultLabel: 'Rework Efficiency'
    },
    howToRead: '1.39\u00D7 means xCSG delivery was smoother with less rework. Above 1\u00D7 = xCSG advantage.'
  },
  machine_first_score: {
    label: 'Machine-First Gain', icon: '\uD83E\uDD16', format: 'ratio', section: 'flywheel',
    what: 'Breadth of knowledge synthesis in xCSG vs legacy. Measures how many sources were synthesized.',
    formula: 'B2 score \u00F7 L6 score',
    formulaDetail: 'B2: "How many knowledge sources synthesized?" Scoring: Single source=0.25, Few (2\u20134)=0.5, Multiple (5\u201310)=0.75, Broad (10+)=1.0',
    sources: {
      xcsg: 'B2 \u2014 Knowledge sources synthesized (xCSG approach)',
      legacy: 'L6 \u2014 Same question for legacy approach',
      note: 'Directly compares the breadth of AI-augmented research vs traditional.'
    },
    example: {
      rows: [
        ['Sources synthesized', 'Broad (10+) = 1.0', 'Few (2\u20134) = 0.5'],
      ],
      result: '2.0\u00D7',
      resultLabel: 'Machine-First Gain'
    },
    howToRead: '2.0\u00D7 means xCSG synthesized twice as many knowledge sources. Higher = more automation leverage.'
  },
  senior_led_score: {
    label: 'Senior-Led Gain', icon: '\uD83D\uDC54', format: 'ratio', section: 'flywheel',
    what: 'Average of three ratios measuring senior expert involvement depth in xCSG vs legacy.',
    formula: 'Average of 3 ratios: C1/L7, C2/L8, C3/L9',
    formulaDetail: 'C1: Specialization (Deep=1.0, Adjacent=0.5, Generalist=0.0). C2: Directness (Authored=1.0, Co-authored=0.5, Reviewed=0.0). C3: Judgment % (>75%=1.0, 50\u201375%=0.75, 25\u201350%=0.5, <25%=0.25). When legacy=0 but xCSG>0, ratio caps at 10\u00D7.',
    sources: {
      xcsg: 'C1 (specialization), C2 (directness), C3 (judgment %)',
      legacy: 'L7 (legacy specialization), L8 (legacy directness), L9 (legacy judgment %)',
      note: 'Each pair is compared as a ratio, then the three ratios are averaged.'
    },
    example: {
      rows: [
        ['Specialization (C1/L7)', 'Deep = 1.0', 'Generalist = 0.0 \u2192 10\u00D7 cap'],
        ['Directness (C2/L8)', 'Authored = 1.0', 'Co-authored = 0.5 \u2192 2\u00D7'],
        ['Judgment (C3/L9)', '>75% = 1.0', '<25% = 0.25 \u2192 4\u00D7'],
      ],
      result: '5.33\u00D7',
      resultLabel: 'Senior-Led Gain (avg of 10, 2, 4)'
    },
    howToRead: '5.33\u00D7 means senior experts were far more deeply involved in xCSG. Higher = more expert-driven work.'
  },
  proprietary_knowledge_score: {
    label: 'Knowledge Gain', icon: '\uD83C\uDFF0', format: 'ratio', section: 'flywheel',
    what: 'Proprietary knowledge advantage. Averages three ratios: proprietary data use, knowledge reuse, and competitive moat.',
    formula: 'Average of 3 ratios: D1/L10, D2/L11, D3/L12',
    formulaDetail: 'D1: Proprietary data (Yes=1.0, No=0.0). D2: Knowledge reuse (Reused & extended=1.0, Useful context=0.5, From scratch=0.0). D3: Moat test (Proprietary decisive=1.0, Partially=0.5, All public=0.0). Same 10\u00D7 cap when legacy=0.',
    sources: {
      xcsg: 'D1 (proprietary data), D2 (knowledge reuse), D3 (moat test)',
      legacy: 'L10 (legacy proprietary data), L11 (legacy reuse), L12 (legacy moat)',
      note: 'Measures how hard the deliverable would be to replicate without xCSG.'
    },
    example: {
      rows: [
        ['Proprietary data (D1/L10)', 'Yes = 1.0', 'No = 0.0 \u2192 10\u00D7 cap'],
        ['Knowledge reuse (D2/L11)', 'Extended = 1.0', 'Scratch = 0.0 \u2192 10\u00D7 cap'],
        ['Moat test (D3/L12)', 'Decisive = 1.0', 'Public = 0.0 \u2192 10\u00D7 cap'],
      ],
      result: '10.0\u00D7',
      resultLabel: 'Knowledge Gain (avg of 10, 10, 10)'
    },
    howToRead: '10.0\u00D7 means xCSG had a massive proprietary knowledge advantage. Higher = harder to replicate.'
  },
  client_impact: {
    label: 'Client Impact', icon: '\uD83D\uDCA5', format: 'ratio', section: 'flywheel',
    what: 'Did xCSG work drive client decisions more effectively than legacy would have?',
    formula: 'E1 score \u00F7 L15 score (capped at 10\u00D7)',
    formulaDetail: 'E1: Informed decision=1.0, Referenced=0.6, Too early=null (excluded), No=0.1.',
    sources: {
      xcsg: 'E1 \u2014 Did the deliverable inform a client decision?',
      legacy: 'L15 \u2014 Would the traditional version have driven the same decision?',
      note: 'Ratio is capped at 10\u00D7. "Too early to tell" responses are excluded.'
    },
    example: {
      rows: [
        ['Decision influence', 'Informed decision = 1.0', 'No = 0.1'],
      ],
      result: '10.0\u00D7',
      resultLabel: 'Client Impact (capped)'
    },
    howToRead: '10.0\u00D7 (capped) means xCSG drove significantly more client action. Higher = stronger decision influence.'
  },
  data_independence: {
    label: 'Data Independence', icon: '\uD83D\uDCCA', format: 'ratio', section: 'flywheel',
    what: 'How efficiently xCSG uses data compared to legacy. Less time on sourcing, more on analysis and insight.',
    formula: 'B6 score \u00F7 L16 score',
    formulaDetail: 'B6: <25% on data=1.0, 25\u201350%=0.75, 50\u201375%=0.4, >75% on data=0.1.',
    sources: {
      xcsg: 'B6 \u2014 What % of effort went to data sourcing vs analysis?',
      legacy: 'L16 \u2014 What % of time would traditional delivery spend on data sourcing?',
      note: 'Higher = more time on insight generation rather than data collection.'
    },
    example: {
      rows: [
        ['Data sourcing effort', '<25% = 1.0', '>75% = 0.1'],
      ],
      result: '10.0\u00D7',
      resultLabel: 'Data Independence'
    },
    howToRead: '10.0\u00D7 means xCSG spent far less time on data collection. Higher = more insight per data effort.'
  },
  reuse_intent_avg: {
    label: 'Reuse Intent', icon: '\uD83D\uDD04', format: 'pct', section: 'signal',
    what: 'Expert loyalty signal. Would they choose the xCSG approach again for this type of deliverable?',
    formula: 'Average of G1 scores across all experts',
    formulaDetail: '"Yes without hesitation" = 100%, "Yes with reservations" = 50%, "No" = 0%.',
    sources: {
      xcsg: 'G1 \u2014 Would you choose the xCSG approach again?',
      legacy: 'N/A (this is a forward-looking signal metric)',
      note: 'Aggregated across all expert responses for the portfolio.'
    },
    example: {
      rows: [
        ['Expert 1', 'Yes without hesitation', '100%'],
        ['Expert 2', 'Yes with reservations', '50%'],
        ['Expert 3', 'Yes without hesitation', '100%'],
      ],
      result: '83%',
      resultLabel: 'Reuse Intent (average)'
    },
    howToRead: '83% means most experts would enthusiastically reuse xCSG. Target: 70%+ for the adoption confidence scaling gate.'
  },
  ai_survival_avg: {
    label: 'AI Survival', icon: '\uD83C\uDF0D', format: 'pct', section: 'signal',
    what: 'How much of the initial AI-generated draft survived into the final deliverable unchanged.',
    formula: 'Average of B5 scores across all experts',
    formulaDetail: '">75%" = 100%, "50\u201375%" = 75%, "25\u201350%" = 50%, "<25%" = 25%.',
    sources: {
      xcsg: 'B5 \u2014 What % of the AI draft survived into the final deliverable?',
      legacy: 'N/A (legacy does not use AI drafts)',
      note: 'Higher = AI produced better starting material that required less rework.'
    },
    example: {
      rows: [
        ['Expert 1', '>75%', '100%'],
        ['Expert 2', '50\u201375%', '75%'],
      ],
      result: '88%',
      resultLabel: 'AI Survival (average)'
    },
    howToRead: '88% means most AI-generated content survived review. Higher = better AI starting quality.'
  },
  client_pulse_avg: {
    label: 'Client Pulse', icon: '\u2764', format: 'pct', section: 'signal',
    what: 'How clients rated the deliverable. An aggregate satisfaction signal.',
    formula: 'Average of client pulse scores across all projects',
    formulaDetail: '"Exceeded expectations" = 100%, "Met expectations" = 60%, "Below expectations" = 10%.',
    sources: {
      xcsg: 'Client Pulse field on each project',
      legacy: 'N/A (this is the actual client reaction to xCSG delivery)',
      note: 'Set by the PMO team based on client feedback, not by expert survey.'
    },
    example: {
      rows: [
        ['Project Alpha', 'Exceeded expectations', '100%'],
        ['Project Beta', 'Met expectations', '60%'],
      ],
      result: '80%',
      resultLabel: 'Client Pulse (average)'
    },
    howToRead: '80% means clients are generally very satisfied. Target: consistent "exceeded" or "met" ratings.'
  },
};

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

/* ═══════════════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════════════ */

function handleLogout() {
  state.token = null;
  state.user = null;
  state.categories = [];
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

  if (hash.startsWith('#expert/') || hash.startsWith('#assess/')) {
    const token = hash.slice(hash.indexOf('/') + 1);
    showScreen('expert');
    renderExpert(token);
    return;
  }

  if (!state.token) { showScreen('login'); return; }
  showScreen('app');

  await Promise.all([loadCategories(), loadSchema()]);
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
    projects: 'Projects', settings: 'Settings', norms: 'Norms', activity: 'Activity Log',
    monitoring: 'Monitoring', methodology: 'How Scores Work'
  };
  document.getElementById('topbarTitle').textContent = titles[routeName] || 'Portfolio';

  const mc = document.getElementById('mainContent');
  if (mc) { mc.classList.remove('view-fade-in'); void mc.offsetWidth; mc.classList.add('view-fade-in'); }

  if (hash === '#portfolio') renderPortfolio();
  else if (hash === '#new') { if (canWrite()) renderNewProject(); else { document.getElementById('mainContent').innerHTML = '<div class="error-state">You do not have permission to create projects.</div>'; } }
  else if (hash.startsWith('#edit/')) renderEditProject(hash.split('/')[1]);
  else if (hash === '#projects') renderProjects();
  else if (hash === '#monitoring') renderMonitoring();
  else if (hash === '#settings') renderSettings();
  else if (hash === '#norms') renderNormsPage();
  else if (hash === '#activity') renderActivity();
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

function _avg(arr) {
  const vals = arr.filter(v => v != null);
  return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function _computeLocalMetrics(projects) {
  const completed = projects.filter(p => p.status === 'complete' && p.metrics);
  const m = completed.map(p => p.metrics);
  return {
    total_projects: projects.length,
    complete_projects: completed.length,
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

async function renderPortfolio() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading portfolio\u2026</div>';
  const myRoute = _routeCounter;

  try {
    const [dashboard, allProjects] = await Promise.all([
      apiCall('GET', '/dashboard/metrics'),
      apiCall('GET', '/projects'),
    ]);
    if (myRoute !== _routeCounter) return; // stale — user navigated away

    _dashboardCache = dashboard;
    _projectsCache = allProjects;

    if (!allProjects.length) {
      mc.innerHTML = `<div class="empty-state"><h2>Welcome to the xCSG Value Tracker</h2><p>Start by creating your first project to begin measuring xCSG performance.</p>${canWrite() ? '<a href="#new" class="btn btn-primary" style="margin-top:16px">Create First Project</a>' : ''}</div>`;
      return;
    }

    _renderDashboardView(allProjects, dashboard);
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load portfolio: ${esc(err.message)}</div>`;
  }
}


function _renderDashboardView(allProjects, dashboard, filterCategory) {
  const mc = document.getElementById('mainContent');

  const filtered = filterCategory
    ? allProjects.filter(p => (p.category_name || '') === filterCategory)
    : allProjects;
  const localMetrics = filterCategory ? _computeLocalMetrics(filtered) : dashboard;

  const fmtRatio = value => value == null ? '\u2014' : `${round2(value)}\xd7`;
  const fmtPct = value => value == null ? '\u2014' : `${Math.round(value * 100)}%`;
  const metricTone = value => value == null ? 'var(--gray-400)' : value > 1.5 ? 'var(--success)' : value >= 1.0 ? 'var(--blue)' : value >= 0.8 ? 'var(--warning)' : 'var(--danger)';

  const categories = [...new Set(allProjects.map(p => p.category_name).filter(Boolean))].sort();

  let html = '';

  // ── HERO SECTION ──
  const advantage = localMetrics.average_advantage || localMetrics.average_outcome_rate_ratio;
  html += `<div class="hero-section">
    <div class="hero-left">
      <div class="hero-label">Portfolio Overview</div>
      <div class="hero-title">${filterCategory ? esc(filterCategory) : 'All Categories'}</div>
      <div class="hero-meta">${localMetrics.complete_projects || 0} completed of ${allProjects.length} total</div>
    </div>
    <div class="hero-right">
      <div class="hero-big-number" style="color:${metricTone(advantage)}">${fmtRatio(advantage)}</div>
      <div class="hero-big-label">xCSG Value Gain</div>
      <div class="hero-explain">Quality per person-day: xCSG vs legacy. &gt;1\xd7 = more value per effort.</div>
    </div>
  </div>`;

  // ── SLICER BAR ──
  html += `<div class="slicer-bar">
    <span class="slicer-label">\u{1F50D} Filter:</span>
    <button class="filter-chip ${!filterCategory ? 'filter-chip-active' : ''}" onclick="_sliceDashboard(null)">All</button>`;
  for (const cat of categories) {
    const count = allProjects.filter(p => p.category_name === cat).length;
    const short = cat.length > 26 ? cat.slice(0, 23) + '\u2026' : cat;
    html += `<button class="filter-chip ${filterCategory === cat ? 'filter-chip-active' : ''}" onclick="_sliceDashboard('${esc(cat)}')">${esc(short)} <span class="chip-count">${count}</span></button>`;
  }
  html += `</div>`;

  // ── KPI GRID ──
  const kpis = [
    { label: 'Delivery Speed', key: 'delivery_speed', value: localMetrics.average_effort_ratio, fmt: fmtRatio, icon: '\u26a1', tip: 'How much faster xCSG delivers vs legacy. Calculated as legacy person-days \xf7 xCSG person-days. 2\xd7 = xCSG took half the effort.' },
    { label: 'Output Quality', key: 'output_quality', value: localMetrics.average_quality_ratio, fmt: fmtRatio, icon: '\u2b50', tip: 'xCSG output quality \xf7 legacy quality. Based on analytical depth, decision readiness, and self-assessment. 1.5\xd7 = 50% better quality.' },
    { label: 'Rework Efficiency', key: 'rework_efficiency', value: localMetrics.rework_efficiency_avg, fmt: fmtRatio, icon: '\ud83d\udd27', tip: 'xCSG revision/rework burden vs legacy. Combines revision depth, scope changes, and client reaction. Higher = smoother delivery.' },
    { label: 'Machine-First Gain', key: 'machine_first_score', value: localMetrics.machine_first_avg, fmt: fmtRatio, icon: '\ud83e\udd16', tip: 'xCSG knowledge synthesis breadth vs legacy. From single-source to broad systematic synthesis. Higher = more automation leverage.' },
    { label: 'Senior-Led Gain', key: 'senior_led_score', value: localMetrics.senior_led_avg, fmt: fmtRatio, icon: '\ud83d\udc54', tip: 'Senior expert involvement in xCSG vs legacy. Averages specialization depth, directness of authorship, and judgment time. Higher = more expert-driven.' },
    { label: 'Knowledge Gain', key: 'proprietary_knowledge_score', value: localMetrics.proprietary_knowledge_avg, fmt: fmtRatio, icon: '\ud83c\udff0', tip: 'Proprietary knowledge advantage. Averages proprietary data use, knowledge reuse, and competitive moat vs legacy. Higher = harder to replicate.' },
    { label: 'Client Impact', key: 'client_impact', value: localMetrics.client_impact_avg, fmt: fmtRatio, icon: '\ud83d\udca5', tip: 'Did xCSG work drive client decisions more than legacy would have? Ratio of decision influence scores, capped at 10\xd7.' },
    { label: 'Data Independence', key: 'data_independence', value: localMetrics.data_independence_avg, fmt: fmtRatio, icon: '\ud83d\udcca', tip: 'How efficiently xCSG uses data vs legacy. Less time on sourcing, more on analysis. Higher = more insight per data effort.' },
  ];
  const signals = [
    { label: 'Reuse Intent', key: 'reuse_intent_avg', value: localMetrics.reuse_intent_avg, fmt: fmtPct, icon: '\ud83d\udd04', tip: 'Expert loyalty signal. Would they choose xCSG again? 100% = all said "yes without hesitation", 50% = mixed, 0% = all said no.' },
    { label: 'AI Survival', key: 'ai_survival_avg', value: localMetrics.ai_survival_avg, fmt: fmtPct, icon: '\ud83c\udf0d', tip: 'How much of the initial AI-generated draft made it into the final deliverable unchanged. Higher = AI produced better starting material.' },
    { label: 'Client Pulse', key: 'client_pulse_avg', value: localMetrics.client_pulse_avg, fmt: fmtPct, icon: '\u2764', tip: 'How clients rated the deliverable. 100% = all exceeded expectations, 60% = met expectations, 10% = below.' },
  ];

  html += `<div class="metrics-grid">`;
  for (const k of kpis) {
    html += `<div class="metric-tile" title="${k.tip}">
      <div class="metric-tile-icon">${k.icon}</div>
      <div class="metric-tile-value" style="color:${metricTone(k.value)}">${k.fmt(k.value)}</div>
      <div class="metric-tile-label">${k.label} ${infoIcon(k.key)}</div>
    </div>`;
  }
  for (const s of signals) {
    html += `<div class="metric-tile metric-tile-signal" title="${s.tip}">
      <div class="metric-tile-icon">${s.icon}</div>
      <div class="metric-tile-value" style="color:${metricTone(s.value)}">${s.fmt(s.value)}</div>
      <div class="metric-tile-label">${s.label} ${infoIcon(s.key)}</div>
    </div>`;
  }

  // On-Time Delivery tile — proportion primary, avg delta secondary.
  // Computed from the currently filtered project list so it reacts to category slicer.
  const schedTracked = filtered.filter(p => scheduleDelta(p.date_expected_delivered, p.date_delivered) !== null);
  const schedDeltas = schedTracked.map(p => scheduleDelta(p.date_expected_delivered, p.date_delivered));
  const onTimeCount = schedDeltas.filter(d => d <= 0).length;
  const onTimePct = schedTracked.length ? Math.round((onTimeCount / schedTracked.length) * 100) : null;
  const avgDelta = schedTracked.length ? (schedDeltas.reduce((a, b) => a + b, 0) / schedTracked.length) : null;
  const onTimeColor = onTimePct == null ? 'var(--gray-400)' : onTimePct >= 80 ? 'var(--success)' : onTimePct >= 60 ? 'var(--blue)' : onTimePct >= 40 ? 'var(--warning)' : 'var(--danger)';
  const onTimeTip = schedTracked.length
    ? `${onTimeCount}/${schedTracked.length} delivered on or before expected date`
    : 'No projects with both expected and actual delivery dates yet.';
  const avgDeltaLabel = avgDelta == null ? '' : (avgDelta === 0 ? 'avg on time' : (avgDelta > 0 ? `avg +${round2(avgDelta)}d late` : `avg ${round2(Math.abs(avgDelta))}d early`));
  html += `<div class="metric-tile metric-tile-schedule" title="${esc(onTimeTip)}">
    <div class="metric-tile-icon">\u23f1</div>
    <div class="metric-tile-value" style="color:${onTimeColor}">${onTimePct == null ? '\u2014' : onTimePct + '%'}</div>
    <div class="metric-tile-label">On-Time Delivery</div>
    <div class="metric-tile-sub" style="font-size:11px;color:var(--gray-500);margin-top:4px">${esc(avgDeltaLabel)}</div>
  </div>`;
  html += `</div>`;

  // ── CHART SECTIONS ──
  html += `<div class="dashboard-section">
    <div class="section-header">
      <div class="section-icon">\ud83c\udf0d</div>
      <div><h2 class="section-title">Thesis Validation</h2><p class="section-subtitle">Disprove matrix and multi-dimensional gains</p></div>
    </div>
    <div class="chart-row">
      <div class="chart-card"><div class="chart-card-title">Disprove Matrix</div><div class="chart-card-explain">Each dot is a project. Top-right = faster AND better quality. Bottom-left = model failing.</div><div class="chart-body" style="height:380px"><div id="chartDisprove" style="width:100%;height:100%"></div></div></div>
      <div class="chart-card"><div class="chart-card-title">Gains Radar</div><div class="chart-card-explain">Average scores across the six flywheel dimensions. The dashed line is baseline (1\xd7). Larger area = stronger advantage.</div><div class="chart-body" style="height:380px"><div id="chartRadar" style="width:100%;height:100%"></div></div></div>
    </div>
  </div>`;

  html += `<div class="dashboard-section">
    <div class="section-header">
      <div class="section-icon">\ud83d\udcc8</div>
      <div><h2 class="section-title">Performance Trends</h2><p class="section-subtitle">How xCSG advantage evolves over time</p></div>
    </div>
    <div class="chart-row">
      <div class="chart-card"><div class="chart-card-title">xCSG Value Gain Over Time</div><div class="chart-card-explain">Quality per person-day (xCSG vs legacy) per project, ordered by delivery date. Rising = improving efficiency.</div><div class="chart-body" style="height:320px"><div id="chartAdvantageTrend" style="width:100%;height:100%"></div></div></div>
      <div class="chart-card"><div class="chart-card-title">Speed, Quality &amp; Value Gain</div><div class="chart-card-explain">All three ratios over time. Value Gain (dashed) = quality per person-day vs legacy. All above 1\xd7 = xCSG outperforms.</div><div class="chart-body" style="height:320px"><div id="chartSpeedQuality" style="width:100%;height:100%"></div></div></div>
    </div>
  </div>`;

  html += `<div class="dashboard-section">
    <div class="section-header">
      <div class="section-icon">\u23f1</div>
      <div><h2 class="section-title">Delivery Discipline</h2><p class="section-subtitle">Schedule variance by project</p></div>
    </div>
    <div class="chart-row">
      <div class="chart-card"><div class="chart-card-title">Schedule Variance</div><div class="chart-card-explain">Each dot is a project. Y = days between actual and expected delivery. Below 0 = early, above 0 = late. Only projects with both dates appear.</div><div class="chart-body" style="height:320px"><div id="chartSchedule" style="width:100%;height:100%"></div></div></div>
    </div>
  </div>`;

  html += `<div class="dashboard-section">
    <div class="section-header">
      <div class="section-icon">\ud83d\udcca</div>
      <div><h2 class="section-title">Breakdowns</h2><p class="section-subtitle">Performance by category, pioneer, and signal</p></div>
    </div>
    <div class="chart-row">
      <div class="chart-card"><div class="chart-card-title">By Category</div><div class="chart-card-explain">Average xCSG advantage by deliverable type. Longer bars = stronger performance in that category.</div><div class="chart-body" style="height:260px"><div id="chartCategory" style="width:100%;height:100%"></div></div></div>
      <div class="chart-card"><div class="chart-card-title">By Pioneer</div><div class="chart-card-explain">Average xCSG advantage by pioneer lead. Shows which team members drive the most value.</div><div class="chart-body" style="height:260px"><div id="chartPioneer" style="width:100%;height:100%"></div></div></div>
    </div>
    <div class="chart-row" style="margin-top:20px">
      <div class="chart-card"><div class="chart-card-title">Client Pulse</div><div class="chart-card-explain">How clients rated the deliverable: exceeded, met, or below expectations.</div><div class="chart-body" style="height:320px"><div id="chartPulse" style="width:100%;height:100%"></div></div></div>
      <div class="chart-card"><div class="chart-card-title">Reuse Intent</div><div class="chart-card-explain">Would experts choose xCSG again? Enthusiastic = yes without hesitation.</div><div class="chart-body" style="height:320px"><div id="chartReuse" style="width:100%;height:100%"></div></div></div>
    </div>
  </div>`;

  // ── SCALING GATES ──
  if (!filterCategory && dashboard.scaling_gates && dashboard.scaling_gates.length) {
    const passed = dashboard.scaling_gates.filter(g => g.status === 'pass').length;
    const total = dashboard.scaling_gates.length;
    html += `<div class="dashboard-section">
      <div class="section-header">
        <div class="section-icon">\ud83d\ude80</div>
        <div><h2 class="section-title">Scaling Gates</h2><p class="section-subtitle">${passed}/${total} passed</p></div>
        <div class="gates-progress-ring">${passed}/${total}</div>
      </div>
      <div class="gates-track">`;
    for (const g of dashboard.scaling_gates) {
      const ok = g.status === 'pass';
      html += `<div class="gate-card ${ok ? 'gate-pass' : 'gate-pending'}">
        <div class="gate-status">${ok ? '\u2713' : '\u2715'}</div>
        <div class="gate-info">
          <div class="gate-name">${esc(g.name)}</div>
          <div class="gate-threshold">${esc(g.description || '')}</div>
          <div class="gate-detail">${esc(g.detail)}</div>
        </div>
      </div>`;
    }
    html += `</div>
      <div class="gates-legend">
        <span class="gates-legend-item"><span class="gate-legend-icon gate-legend-pass">\u2713</span> Passed</span>
        <span class="gates-legend-item"><span class="gate-legend-icon gate-legend-fail">\u2715</span> Not yet met</span>
      </div>
    </div>`;
  }

  // ── PORTFOLIO TABLE ──
  html += `<div class="dashboard-section">
    <div class="section-header">
      <div class="section-icon">\ud83d\udccb</div>
      <div><h2 class="section-title">Portfolio</h2><p class="section-subtitle">${filtered.length} engagement${filtered.length !== 1 ? 's' : ''}</p></div>
    </div>
    <div class="table-wrapper">
    <table class="data-table portfolio-table">
      <thead><tr><th>Project</th><th>Category</th><th>Pioneers</th><th title="Actual delivery vs. expected delivery.">Schedule</th><th class="r" title="Legacy person-days \xf7 xCSG person-days. >1\xd7 = xCSG faster.">Speed ${infoIcon('delivery_speed')}</th><th class="r" title="xCSG quality \xf7 legacy quality. >1\xd7 = xCSG higher quality.">Quality ${infoIcon('output_quality')}</th><th class="r" title="Quality per person-day: xCSG vs legacy. Higher = more value per unit of effort.">xCSG Value Gain ${infoIcon('productivity_ratio')}</th><th class="r">Actions</th></tr></thead><tbody>`;
  for (const row of filtered) {
    const m = row.metrics || {};
    const rowPioneers = row.pioneers || [];
    const rowPioneerNames = rowPioneers.map(pi => pi.name || pi.pioneer_name || '').filter(Boolean);
    const pioneerDisplay = rowPioneerNames.length > 0 ? rowPioneerNames.length + ' pioneer' + (rowPioneerNames.length !== 1 ? 's' : '') : esc(row.pioneer_name || '\u2014');
    const pioneerTooltip = rowPioneerNames.join(', ') || row.pioneer_name || '';
    const schedDelta = scheduleDelta(row.date_expected_delivered, row.date_delivered);
    const schedCell = schedDelta == null
      ? '<span style="color:var(--gray-400)">\u2014</span>'
      : `<span class="badge ${scheduleDeltaBadgeClass(schedDelta)}" title="Expected: ${esc(row.date_expected_delivered)} \xb7 Delivered: ${esc(row.date_delivered)}">${formatScheduleDelta(schedDelta)}</span>`;
    html += `<tr>
      <td><strong>${esc(row.project_name)}</strong></td>
      <td>${esc(row.category_name)}</td>
      <td title="${esc(pioneerTooltip)}">${pioneerDisplay}</td>
      <td>${schedCell}</td>
      <td class="r" style="color:${metricTone(m.delivery_speed)};font-weight:700">${fmtRatio(m.delivery_speed)}</td>
      <td class="r" style="color:${metricTone(m.output_quality)};font-weight:700">${fmtRatio(m.output_quality)}</td>
      <td class="r" style="color:${metricTone(m.productivity_ratio)};font-weight:800">${fmtRatio(m.productivity_ratio)}</td>
      <td class="r"><a href="#edit/${row.id}" class="table-link">Open</a></td>
    </tr>`;
  }
  html += `</tbody></table></div></div>`;

  mc.innerHTML = html;
  requestAnimationFrame(() => renderDashboardCharts(localMetrics, filtered));
}

function _sliceDashboard(category) {
  if (!_projectsCache || !_dashboardCache) return;
  _renderDashboardView(_projectsCache, _dashboardCache, category);
}

function barHTML(score, label) {
  const pct = Math.round(score * 100);
  const color = scoreColor(score);
  return `<div class="assessment-bar">
    <div class="assessment-bar-track"><div class="assessment-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="assessment-bar-label" style="color:${color}">${label || pct + '%'}</span>
  </div>`;
}

function renderExpertAssessment(er, metrics) {
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
        { key: 'l2_legacy_team_size', label: 'Legacy Team Size' },
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

async function renderNewProject(existing) {
  await loadCategories();
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
        <div class="form-row">
          <div class="form-group">
            <label>Calendar Days</label>
            <input type="number" id="fLDays" min="1" max="365" step="1" value="${esc(p.legacy_calendar_days || '')}" placeholder="e.g. 10">
            <span class="field-warn" id="warnLDays"></span>
          </div>
          <div class="form-group">
            <label>Team Size</label>
            <input type="number" id="fLTeam" min="1" max="50" step="1" value="${esc(p.legacy_team_size || '')}" placeholder="e.g. 3">
            <span class="field-warn" id="warnLTeam"></span>
          </div>
        </div>
        <div class="form-group">
          <label>Revision Rounds</label>
          <input type="number" id="fLRevisions" min="0" max="20" step="1" value="${esc(p.legacy_revision_rounds || '')}" placeholder="e.g. 3">
          <span class="field-warn" id="warnLRevisions"></span>
        </div>
      </fieldset>

      <div style="display:flex;gap:12px;margin-top:24px;align-items:center">
        ${canWrite() ? `<button type="submit" class="btn btn-primary" id="fSubmit">${isEdit ? 'Save Changes' : 'Create Project'}</button>` : ''}
        ${isEdit ? '<button type="button" class="btn btn-secondary" onclick="window.location.hash=\'#projects\'">Back to Projects</button>' : ''}
        ${isEdit && isAdmin() ? `<button type="button" class="btn btn-danger" onclick="confirmDelete(${p.id}, '${esc(p.project_name)}')">Delete</button>` : ''}
      </div>
    </form>`;

  // Pioneer row management
  let pioneerIndex = 0;
  function addPioneerRow(name, email, rounds) {
    const container = document.getElementById('pioneersContainer');
    const idx = pioneerIndex++;
    const row = document.createElement('div');
    row.className = 'pioneer-row';
    row.dataset.idx = idx;
    row.innerHTML = `<div class="form-group"><label>Name *</label><input type="text" class="pioneer-name" value="${esc(name || '')}" required placeholder="Pioneer name"></div>`
      + `<div class="form-group"><label>Email</label><input type="email" class="pioneer-email" value="${esc(email || '')}" placeholder="Email (optional)"></div>`
      + `<div class="form-group" style="flex:0 0 120px"><label>Rounds <span class="field-hint" data-hint="Override the project default for this pioneer. Leave blank to use the Default Rounds setting.">&#9432;</span></label><input type="number" class="pioneer-rounds" min="1" max="10" value="${rounds || ''}" placeholder="Default" style="width:110px"></div>`
      + `<button type="button" class="btn btn-sm btn-danger pioneer-remove-btn" style="align-self:flex-end;margin-bottom:2px" title="Remove pioneer">&times;</button>`;
    container.appendChild(row);
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
      addPioneerRow(pi.name || pi.pioneer_name, pi.email || pi.pioneer_email, pi.total_rounds);
    }
  } else if (!isEdit) {
    addPioneerRow('', '', '');
  } else {
    // Edit mode fallback: use legacy pioneer_name if no pioneers array
    addPioneerRow(p.pioneer_name || '', p.pioneer_email || '', '');
  }

  document.getElementById('addPioneerBtn').addEventListener('click', function() {
    addPioneerRow('', '', '');
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
  validateNumField('fLTeam', 'warnLTeam', { min: 1, max: 50, intOnly: true, label: 'Team size' });
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
      const name = row.querySelector('.pioneer-name').value.trim();
      const email = row.querySelector('.pioneer-email').value.trim() || null;
      const roundsVal = row.querySelector('.pioneer-rounds').value;
      const total_rounds = roundsVal ? parseInt(roundsVal) : null;
      if (name) pioneers.push({ name, email, total_rounds });
    }
    if (pioneers.length === 0) {
      showToast('At least one pioneer is required', 'error');
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Project';
      return;
    }

    const payload = {
      project_name: document.getElementById('fName').value,
      category_id: parseInt(document.getElementById('fCategory').value),
      pioneer_name: pioneers[0].name,
      pioneer_email: pioneers[0].email,
      pioneers: pioneers,
      default_rounds: parseInt(document.getElementById('fDefaultRounds').value) || 1,
      show_previous_answers: document.getElementById('fShowPrevious').value === '1',
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
      legacy_team_size: document.getElementById('fLTeam').value || null,
      legacy_revision_rounds: document.getElementById('fLRevisions').value || null,
    };
    try {
      if (isEdit) {
        await apiCall('PUT', `/projects/${p.id}`, payload);
        showToast('Project updated');
        window.location.hash = '#projects';
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
    html += '<div style="font-weight:600;margin-bottom:4px">' + esc(pi.name || pi.pioneer_name || 'Pioneer') + (pi.email ? ' <span style="color:var(--gray-500);font-weight:400">' + esc(pi.email) + '</span>' : '') + '</div>';
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
        const tip = 'Completed ' + formatDateTime(existing.completed_at);
        chip = '<span class="round-chip round-chip-done" title="' + esc(tip) + '">R' + r + ' \u2713</span>';
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
      ? '<button type="button" class="btn btn-sm btn-danger" onclick="event.stopPropagation();removePioneer(' + p.id + ',' + pi.id + ',\'' + esc(pi.name || pi.pioneer_name) + '\')">Remove</button>'
      : '';

    html += '<tr><td><strong>' + esc(pi.pioneer_name || pi.name || '') + '</strong></td>'
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
    + '<div class="form-group"><label>Name *</label><input type="text" id="addPioneerName" placeholder="Pioneer name"></div>'
    + '<div class="form-group" style="margin-top:12px"><label>Email</label><input type="email" id="addPioneerEmail" placeholder="Email (optional)"></div>'
    + '<div class="form-group" style="margin-top:12px"><label>Total Rounds</label><input type="number" id="addPioneerRounds" min="1" max="10" placeholder="Uses project default"></div>'
    + '<div class="form-actions" style="margin-top:16px">'
    + '<button class="btn btn-primary" onclick="submitAddPioneer(' + projectId + ')">Add</button>'
    + '<button class="btn btn-secondary" onclick="hideModal()">Cancel</button></div>');
}

async function submitAddPioneer(projectId) {
  const name = document.getElementById('addPioneerName').value.trim();
  const email = document.getElementById('addPioneerEmail').value.trim() || null;
  const roundsVal = document.getElementById('addPioneerRounds').value;
  const total_rounds = roundsVal ? parseInt(roundsVal) : null;
  if (!name) { showToast('Pioneer name is required', 'error'); return; }
  hideModal();
  try {
    await apiCall('POST', '/projects/' + projectId + '/pioneers', { name, email, total_rounds });
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
      card.innerHTML = renderExpertAssessment(er, m);
      mc.appendChild(card);
    }
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load project: ${esc(err.message)}</div>`;
  }
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
        ${canWrite() ? '<a href="#new" class="btn btn-primary" style="margin-left:auto">+ New Project</a>' : ''}
      </div>
      <div class="card"><table class="data-table" id="projectTable"><thead><tr>
        <th>Project</th><th>Category</th><th>Pioneers</th><th>Responses</th><th title="Actual delivery vs. expected delivery.">Schedule</th><th>Quality Score</th><th>G2 Client Pulse</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>`;

    for (const p of rows) {
      // Compute pioneer info
      const pioneers = p.pioneers || [];
      const pioneerCount = pioneers.length;
      const pioneerNames = pioneers.map(pi => pi.name || pi.pioneer_name || '').filter(Boolean);
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
      html += `<tr class="clickable-row" data-status="${effectiveStatus}" data-cat="${esc(p.category_name)}" onclick="window.location.hash='#edit/${p.id}'">
        <td>${esc(p.project_name)}</td>
        <td>${esc(p.category_name || '\u2014')}</td>
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
      document.querySelectorAll('#projectTable tbody tr').forEach(tr => {
        const show =
          (!sf || tr.dataset.status === sf) &&
          (!cf || tr.dataset.cat === cf);
        tr.style.display = show ? '' : 'none';
      });
    }
    document.getElementById('statusFilter')?.addEventListener('change', applyProjectFilters);
    document.getElementById('catFilter')?.addEventListener('change', applyProjectFilters);

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



const C = {
  navy: '#121F6B', blue: '#3B82F6', teal: '#14B8A6', green: '#10B981',
  orange: '#F59E0B', red: '#EF4444', gray: '#9CA3AF', gray200: '#E5E7EB',
  gray50: '#F9FAFB', gray100: '#F3F4F6', purple: '#8B5CF6', indigo: '#6366F1',
};
const ec = {};
function ecInit(id) {
  if (ec[id]) ec[id].dispose();
  const dom = document.getElementById(id);
  if (!dom) return null;
  const c = echarts.init(dom, null, { renderer: 'canvas' });
  ec[id] = c;
  const ro = new ResizeObserver(() => c.resize());
  ro.observe(dom);
  return c;
}
function tone(v) { return v == null ? C.gray : v > 1.5 ? C.green : v >= 1 ? C.blue : v >= 0.8 ? C.orange : C.red; }
function barColor(v) { return tone(v); }
function tip() {
  return { backgroundColor: 'rgba(18,31,107,0.94)', borderColor: 'none', borderRadius: 10, padding: [12, 16],
    textStyle: { color: '#fff', fontSize: 13, fontFamily: 'Inter, system-ui' },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.2);' };
}
function axisLbl() { return { color: '#6B7280', fontSize: 12, fontFamily: 'Inter, system-ui' }; }

function renderDashboardCharts(dashboard, allProjects) {
  if (typeof echarts === 'undefined') return;
  Object.keys(ec).forEach(k => { ec[k].dispose(); delete ec[k]; });
  echarts.registerTheme;
  const done = allProjects.filter(p => p.status === 'complete' && p.metrics);

  // 1. SCATTER
  const s1 = ecInit('chartDisprove');
  if (s1 && done.length) {
    const pts = done.map(p => {
      const m = p.metrics;
      if (m.delivery_speed == null || m.output_quality == null) return null;
      const q = (m.delivery_speed >= 1 && m.output_quality >= 1);
      return { value: [m.delivery_speed, m.output_quality], name: p.project_name, pioneer: p.pioneer_name, client: p.client_name, cat: p.category_name, good: q };
    }).filter(Boolean);
    if (pts.length) {
      const maxX = Math.max(...pts.map(p => p.value[0])) * 1.15;
      const maxY = Math.max(...pts.map(p => p.value[1])) * 1.15;
      s1.setOption({
        tooltip: { ...tip(), trigger: 'item',
          formatter: p => { const d = pts[p.dataIndex]; return `<b style="font-size:14px">${d.name}</b><br><span style="opacity:.6">${d.pioneer} · ${d.client}</span><br><br>Speed: <b>${d.value[0]}×</b> &nbsp; Quality: <b>${d.value[1]}×</b>`; } },
        grid: { left: 55, right: 30, top: 30, bottom: 45 },
        xAxis: { type: 'value', max: maxX, name: 'Delivery Speed', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
          axisLine: { lineStyle: { color: C.gray200 } }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: C.gray100, type: 'dashed' } } },
        yAxis: { type: 'value', max: maxY, name: 'Output Quality', nameLocation: 'middle', nameGap: 35, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
          axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: C.gray100, type: 'dashed' } } },
        series: [{ type: 'scatter', data: pts.map(d => ({
          value: d.value,
          symbolSize: 28,
          itemStyle: { color: d.good ? C.green : C.orange, borderColor: '#fff', borderWidth: 2, shadowBlur: 8, shadowColor: d.good ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)' },
        })), emphasis: { scale: 1.5, itemStyle: { shadowBlur: 16 } },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: '#D1D5DB', type: 'dashed', width: 1.5 },
            data: [{ xAxis: 1 }, { yAxis: 1 }] } }],
        graphic: [
          { type: 'text', right: 30, top: 15, style: { text: '\u2713 Thesis Validated', fill: 'rgba(16,185,129,0.5)', fontSize: 13, fontWeight: 600 } },
          { type: 'text', left: 30, bottom: 55, style: { text: '\u2717 Model Failing', fill: 'rgba(239,68,68,0.4)', fontSize: 13, fontWeight: 600 } },
        ],
      });
    }
  }

  // 2. RADAR
  const s2 = ecInit('chartRadar');
  if (s2) {
    const labels = ['Machine-First', 'Senior-Led', 'Knowledge', 'Rework Eff.', 'Client Impact', 'Data Ind.'];
    const vals = [dashboard.machine_first_avg, dashboard.senior_led_avg, dashboard.proprietary_knowledge_avg,
      dashboard.rework_efficiency_avg, dashboard.client_impact_avg, dashboard.data_independence_avg];
    const vp = labels.map((l, i) => ({ l, v: vals[i] })).filter(p => p.v != null);
    if (vp.length) {
      const maxVal = Math.max(...vp.map(p => p.v), 2) * 1.15;
      s2.setOption({
        tooltip: { ...tip(), trigger: 'item' },
        legend: { bottom: 5, textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 16, itemHeight: 8, itemGap: 24 },
        radar: { shape: 'circle', indicator: vp.map(p => ({ name: p.l, max: maxVal })),
          axisName: { color: '#374151', fontSize: 12, fontWeight: 500 },
          splitArea: { areaStyle: { color: ['rgba(243,244,246,0.6)', 'rgba(255,255,255,0.6)'] } },
          splitLine: { lineStyle: { color: C.gray200 } }, axisLine: { lineStyle: { color: C.gray200 } } },
        series: [{ type: 'radar', data: [
          { value: vp.map(p => p.v), name: 'xCSG Average', areaStyle: { color: 'rgba(99,102,241,0.2)' },
            lineStyle: { color: C.indigo, width: 3 }, itemStyle: { color: C.indigo, borderWidth: 2, borderColor: '#fff' }, symbol: 'circle', symbolSize: 8 },
          { value: vp.map(() => 1.0), name: 'Baseline', lineStyle: { color: C.gray, type: 'dashed', width: 1.5 },
            itemStyle: { color: 'transparent' }, areaStyle: { color: 'transparent' }, symbol: 'none' },
        ] }],
      });
    }
  }

  // 3. ADVANTAGE TREND
  const s3 = ecInit('chartAdvantageTrend');
  if (s3 && done.length) {
    const sorted = [...done].sort((a, b) => new Date(a.date_delivered || a.date_started || 0) - new Date(b.date_delivered || b.date_started || 0));
    const td = sorted.map(p => ({ d: p.date_delivered || p.date_started, v: p.metrics.productivity_ratio, n: p.project_name })).filter(d => d.v != null);
    if (td.length) {
      s3.setOption({
        tooltip: { ...tip(), trigger: 'axis', formatter: ps => { const d = td[ps[0].dataIndex]; return `<b>${d.n}</b><br>xCSG Value Gain: <b>${d.v}\xd7</b>`; } },
        grid: { left: 55, right: 20, top: 15, bottom: 35 },
        xAxis: { type: 'category', data: td.map(d => new Date(d.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
          axisLine: { lineStyle: { color: C.gray200 } }, axisTick: { show: false }, axisLabel: axisLbl() },
        yAxis: { type: 'value', name: 'xCSG Value Gain', nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 }, min: 0,
          axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: C.gray100, type: 'dashed' } } },
        series: [{ type: 'line', data: td.map(d => d.v), smooth: 0.4, symbol: 'circle', symbolSize: 10, showSymbol: true,
          lineStyle: { color: C.navy, width: 3.5 },
          itemStyle: { color: C.navy, borderWidth: 3, borderColor: '#fff' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(18,31,107,0.15)' }, { offset: 1, color: 'rgba(18,31,107,0.01)' }] } },
          emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(18,31,107,0.3)' } },
          markLine: { silent: true, symbol: 'none', data: [{ yAxis: 1 }], lineStyle: { color: '#D1D5DB', type: 'dashed' }, label: { show: false } } }],
      });
    }
  }

  // 4. SPEED vs QUALITY
  const s4 = ecInit('chartSpeedQuality');
  if (s4 && done.length) {
    const sorted = [...done].sort((a, b) => new Date(a.date_delivered || a.date_started || 0) - new Date(b.date_delivered || b.date_started || 0));
    const lbl = sorted.map(p => new Date(p.date_delivered || p.date_started).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    s4.setOption({
      tooltip: { ...tip(), trigger: 'axis' },
      legend: { bottom: 5, textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 18, itemHeight: 3, itemGap: 24 },
      grid: { left: 55, right: 20, top: 15, bottom: 40 },
      xAxis: { type: 'category', data: lbl, axisLine: { lineStyle: { color: C.gray200 } }, axisTick: { show: false }, axisLabel: axisLbl() },
      yAxis: { type: 'value', name: 'Ratio', nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 }, min: 0,
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: C.gray100, type: 'dashed' } } },
      series: [
        { type: 'line', name: 'Speed', data: sorted.map(p => p.metrics.delivery_speed), smooth: 0.4, symbol: 'circle', symbolSize: 8, showSymbol: true,
          lineStyle: { color: C.blue, width: 3 }, itemStyle: { color: C.blue, borderWidth: 2, borderColor: '#fff' } },
        { type: 'line', name: 'Quality', data: sorted.map(p => p.metrics.output_quality), smooth: 0.4, symbol: 'circle', symbolSize: 8, showSymbol: true,
          lineStyle: { color: C.navy, width: 3 }, itemStyle: { color: C.navy, borderWidth: 2, borderColor: '#fff' } },
        { type: 'line', name: 'Value Gain', data: sorted.map(p => p.metrics.productivity_ratio), smooth: 0.4, symbol: 'diamond', symbolSize: 9, showSymbol: true,
          lineStyle: { color: C.green, width: 3, type: 'dashed' }, itemStyle: { color: C.green, borderWidth: 2, borderColor: '#fff' } },
      ],
    });
  }

  // 4b. SCHEDULE VARIANCE — one dot per project, Y = actual - expected (days)
  const sSched = ecInit('chartSchedule');
  if (sSched) {
    const pts = allProjects
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
      sSched.setOption({
        tooltip: { ...tip(), trigger: 'item',
          formatter: p => { const d = pts[p.dataIndex]; return `<b style="font-size:14px">${esc(d.name)}</b><br><span style="opacity:.7">${esc(d.cat || '')}</span><br><br>Expected: <b>${d.expected}</b><br>Delivered: <b>${d.actual}</b><br>Delta: <b>${formatScheduleDelta(d.delta)}</b>`; } },
        grid: { left: 60, right: 30, top: 30, bottom: 50 },
        xAxis: { type: 'category', data: pts.map((_, i) => i + 1), name: 'Project (chronological)', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
          axisLine: { lineStyle: { color: C.gray200 } }, axisTick: { show: false }, axisLabel: { ...axisLbl(), fontSize: 10 } },
        yAxis: { type: 'value', name: 'Days (actual \u2212 expected)', nameLocation: 'middle', nameGap: 45, nameTextStyle: { color: '#374151', fontWeight: 600, fontSize: 12 },
          min: -ySpan, max: ySpan,
          axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(),
          splitLine: { lineStyle: { color: C.gray100, type: 'dashed' } } },
        series: [{
          type: 'scatter',
          data: pts.map((d, i) => ({
            value: [i, d.delta],
            symbolSize: 22,
            itemStyle: {
              color: d.delta <= 0 ? C.green : (d.delta <= 3 ? C.orange : '#EF4444'),
              borderColor: '#fff', borderWidth: 2,
              shadowBlur: 6, shadowColor: d.delta <= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.3)',
            },
          })),
          markLine: { silent: true, symbol: 'none', lineStyle: { color: '#9CA3AF', width: 1.5 }, data: [{ yAxis: 0 }], label: { show: false } },
          emphasis: { scale: 1.4 },
        }],
        graphic: [
          { type: 'text', right: 30, top: 10, style: { text: 'Late \u25b2', fill: 'rgba(239,68,68,0.55)', fontSize: 12, fontWeight: 600 } },
          { type: 'text', right: 30, bottom: 60, style: { text: 'Early \u25bc', fill: 'rgba(16,185,129,0.55)', fontSize: 12, fontWeight: 600 } },
        ],
      });
    } else {
      sSched.setOption({
        graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'No projects with both expected and actual delivery dates yet.', fill: '#9CA3AF', fontSize: 13 } }],
      });
    }
  }

  // 5. CATEGORY BAR (show all with 1+ projects)
  const s5 = ecInit('chartCategory');
  if (s5 && done.length) {
    const byCat = {};
    done.forEach(p => { const c = p.category_name || 'Other'; const v = p.metrics.productivity_ratio; if (v != null) { if (!byCat[c]) byCat[c] = []; byCat[c].push(v); } });
    let catE = Object.entries(byCat).map(([n, vs]) => ({ n, a: vs.reduce((a, b) => a + b, 0) / vs.length, c: vs.length })).sort((a, b) => b.a - a.a);
    const catMore = catE.length > 8 ? catE.slice(8) : [];
    catE = catE.slice(0, 8);
    // Auto-resize chart body height based on item count
    const catH = Math.max(260, catE.length * 38 + 40);
    document.getElementById('chartCategory')?.parentElement?.parentElement?.querySelector('.chart-body')?.style.setProperty('height', catH + 'px');
    if (catE.length) {
      s5.setOption({
        tooltip: { ...tip(), trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: ps => { const d = catE[ps[0].dataIndex]; return `<b>${d.n}</b><br>Avg: <b>${round2(d.a)}×</b> · ${d.c} project${d.c > 1 ? 's' : ''}`; } },
        grid: { left: 180, right: 50, top: 5, bottom: catMore.length ? 25 : 10 },
        xAxis: { type: 'value', min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: C.gray100, type: 'dashed' } } },
        yAxis: { type: 'category', data: catE.map(e => e.n.length > 30 ? e.n.slice(0, 27) + '\u2026' : e.n), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisLbl(), fontSize: 12 } },
        series: [{ type: 'bar', data: catE.map(e => ({ value: round2(e.a), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: barColor(e.a) }, { offset: 1, color: barColor(e.a) + 'AA' }]), borderRadius: [0, 5, 5, 0] } })),
          barWidth: 18, label: { show: true, position: 'right', fontSize: 11, fontWeight: 600, color: '#374151', formatter: '{c}×' },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.1)' } } }],
        graphic: catMore.length ? [{ type: 'text', right: 10, bottom: 5, style: { text: `+${catMore.length} more`, fontSize: 11, fill: C.gray, fontStyle: 'italic' } }] : [],
      });
    }
  }

  // 6. PIONEER BAR (show all with 1+ projects)
  const s6 = ecInit('chartPioneer');
  if (s6 && done.length) {
    const byP = {};
    done.forEach(p => { const pn = p.pioneer_name || 'Unknown'; const v = p.metrics.productivity_ratio; if (v != null) { if (!byP[pn]) byP[pn] = []; byP[pn].push(v); } });
    let pE = Object.entries(byP).map(([n, vs]) => ({ n, a: vs.reduce((a, b) => a + b, 0) / vs.length, c: vs.length })).sort((a, b) => b.a - a.a);
    const pMore = pE.length > 8 ? pE.slice(8) : [];
    pE = pE.slice(0, 8);
    const pH = Math.max(260, pE.length * 38 + 40);
    document.getElementById('chartPioneer')?.parentElement?.parentElement?.querySelector('.chart-body')?.style.setProperty('height', pH + 'px');
    if (pE.length) {
      s6.setOption({
        tooltip: { ...tip(), trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: ps => { const d = pE[ps[0].dataIndex]; return `<b>${d.n}</b><br>Avg: <b>${round2(d.a)}×</b> · ${d.c} project${d.c > 1 ? 's' : ''}`; } },
        grid: { left: 140, right: 50, top: 5, bottom: pMore.length ? 25 : 10 },
        xAxis: { type: 'value', min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl(), splitLine: { lineStyle: { color: C.gray100, type: 'dashed' } } },
        yAxis: { type: 'category', data: pE.map(e => e.n), axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLbl() },
        series: [{ type: 'bar', data: pE.map(e => ({ value: round2(e.a), itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: barColor(e.a) }, { offset: 1, color: barColor(e.a) + 'AA' }]), borderRadius: [0, 5, 5, 0] } })),
          barWidth: 18, label: { show: true, position: 'right', fontSize: 11, fontWeight: 600, color: '#374151', formatter: '{c}×' },
          emphasis: { itemStyle: { shadowBlur: 8 } } }],
        graphic: pMore.length ? [{ type: 'text', right: 10, bottom: 5, style: { text: `+${pMore.length} more`, fontSize: 11, fill: C.gray, fontStyle: 'italic' } }] : [],
      });
    }
  }

  // 7. DOUGHNUT — Client Pulse
  const s7 = ecInit('chartPulse');
  if (s7 && done.length) {
    const pc = { 'Exceeded expectations': 0, 'Met expectations': 0, 'Below expectations': 0, 'Not yet received': 0 };
    done.forEach(p => { const v = p.client_pulse; if (pc[v] !== undefined) pc[v]++; });
    const responded = pc['Exceeded expectations'] + pc['Met expectations'] + pc['Below expectations'];
    const totalPulse = responded + pc['Not yet received'];
    if (totalPulse > 0) {
      const data = [
        { value: pc['Exceeded expectations'], name: 'Exceeded', itemStyle: { color: C.green } },
        { value: pc['Met expectations'], name: 'Met', itemStyle: { color: C.blue } },
        { value: pc['Below expectations'], name: 'Below', itemStyle: { color: C.red } },
      ];
      if (pc['Not yet received'] > 0) data.push({ value: pc['Not yet received'], name: 'Pending', itemStyle: { color: C.gray200 } });
      s7.setOption({
        tooltip: { ...tip(), trigger: 'item',
          formatter: p => `<b>${p.name}</b><br>${p.value} project${p.value !== 1 ? "s" : ""} (${Math.round(p.percent)}%)` },
        legend: { bottom: 10, textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 14, itemHeight: 14, itemGap: 20 },
        series: [
          { type: 'pie', radius: ['50%', '75%'], center: ['50%', '45%'],
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', color: C.navy },
              itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)' } },
            data },
          { type: 'pie', radius: [0, 0], center: ['50%', '45%'], silent: true,
            label: { show: true, position: 'center', formatter: `{big|${responded}/${totalPulse}}\n{sub|responded}`,
              rich: { big: { fontSize: 26, fontWeight: 800, color: C.navy, fontFamily: 'Inter', lineHeight: 32 },
                      sub: { fontSize: 11, color: C.gray, fontFamily: 'Inter', lineHeight: 18 } } },
            data: [{ value: 1, itemStyle: { color: 'transparent' } }] },
        ],
      });
    }
  }

  // 8. DOUGHNUT — Reuse Intent (from metrics score: 1.0=enthusiastic, 0.5=reserved, 0.0=no)
  const s8 = ecInit('chartReuse');
  if (s8 && done.length) {
    let enthusiastic = 0, reserved = 0, noReuse = 0, pending = 0;
    done.forEach(p => {
      const s = p.metrics && p.metrics.reuse_intent_score;
      if (s === 1.0) enthusiastic++;
      else if (s === 0.5) reserved++;
      else if (s != null && s === 0) noReuse++;
      else pending++;
    });
    const responded = enthusiastic + reserved + noReuse;
    const totalReuse = responded + pending;
    if (totalReuse > 0) {
      const data = [
        { value: enthusiastic, name: 'Enthusiastic', itemStyle: { color: C.green } },
        { value: reserved, name: 'Reserved', itemStyle: { color: C.orange } },
        { value: noReuse, name: 'No', itemStyle: { color: C.red } },
      ];
      if (pending > 0) data.push({ value: pending, name: 'Pending', itemStyle: { color: C.gray200 } });
      s8.setOption({
        tooltip: { ...tip(), trigger: 'item',
          formatter: p => `<b>${p.name}</b><br>${p.value} project${p.value !== 1 ? "s" : ""} (${Math.round(p.percent)}%)` },
        legend: { bottom: 10, textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 14, itemHeight: 14, itemGap: 20 },
        series: [
          { type: 'pie', radius: ['50%', '75%'], center: ['50%', '45%'],
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', color: C.navy },
              itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)' } },
            data },
          { type: 'pie', radius: [0, 0], center: ['50%', '45%'], silent: true,
            label: { show: true, position: 'center', formatter: `{big|${responded}/${totalReuse}}\n{sub|responded}`,
              rich: { big: { fontSize: 26, fontWeight: 800, color: C.navy, fontFamily: 'Inter', lineHeight: 32 },
                      sub: { fontSize: 11, color: C.gray, fontFamily: 'Inter', lineHeight: 18 } } },
            data: [{ value: 1, itemStyle: { color: 'transparent' } }] },
        ],
      });
    }
  }
}


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

    // Previous responses (if enabled and available)
    if (ctx.show_previous && ctx.previous_responses && ctx.previous_responses.length) {
      html += '<details class="previous-responses"><summary>View Your Previous Responses (' + ctx.previous_responses.length + ' round' + (ctx.previous_responses.length > 1 ? 's' : '') + ')</summary>';
      html += '<div class="prev-content">';
      for (let ri = 0; ri < ctx.previous_responses.length; ri++) {
        const prev = ctx.previous_responses[ri];
        html += '<div style="margin-bottom:16px"><strong style="color:var(--navy)">Round ' + (ri + 1) + '</strong></div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:12px">';
        const fieldDefs = schema ? schema.fields : {};
        for (const [key, val] of Object.entries(prev)) {
          if (key === 'id' || key === 'pioneer_id' || key === 'project_id' || key === 'round_number' || key === 'created_at' || val == null || val === '') continue;
          const fd = fieldDefs[key];
          const label = fd ? fd.label : key;
          html += '<div><span style="font-size:12px;color:var(--gray-500)">' + esc(label) + '</span><br><span style="font-size:13px">' + esc(String(val)) + '</span></div>';
        }
        html += '</div>';
        if (ri < ctx.previous_responses.length - 1) html += '<hr style="border:none;border-top:1px solid var(--gray-200);margin:8px 0">';
      }
      html += '</div></details>';
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

      try {
        const result = await apiCall('POST', '/expert/' + token, payload);
        _expertClearStorage(token, currentRound);
        if (result.already_completed) {
          ec.innerHTML = '<div class="expert-thankyou"><div class="thankyou-icon">&#10003;</div><h2>Already Submitted</h2><p>This round has already been recorded.</p></div>';
        } else if (result.current_round && result.total_rounds && result.current_round < result.total_rounds) {
          // More rounds remain, but the pioneer is done for this session.
          // A fresh link will be sent by the PMO team when the next round opens.
          ec.innerHTML = '<div class="expert-thankyou">'
            + '<div class="thankyou-icon">&#10003;</div>'
            + '<h2>Round ' + result.current_round + ' of ' + result.total_rounds + ' Complete</h2>'
            + '<p>Your responses for this round have been recorded. Thank you!</p>'
            + '<p style="margin-top:12px;color:var(--gray-600)">You will receive a new assessment link when the next round is scheduled by the PMO team.</p>'
            + '</div>';
        } else {
          const m = result.metrics || {};
          const fmtX = v => v != null ? (Math.round(v * 100) / 100) + '\xd7' : '\u2014';
          const scoreColor = v => v == null ? '#9CA3AF' : v >= 2 ? '#10B981' : v >= 1 ? '#3B82F6' : v >= 0.5 ? '#F59E0B' : '#EF4444';
          ec.innerHTML = '<div class="expert-thankyou">'
            + '<div class="thankyou-icon">&#10003;</div>'
            + '<h2>Thank You!</h2>'
            + '<p>Your assessment has been recorded. Here is a summary of the three flywheel scores computed from your responses.</p>'
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

            + '</div></div>';
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
    { id: 'tabNorms', label: 'Legacy Norms', key: 'norms' },
    { id: 'tabPassword', label: 'Change Password', key: 'password' },
  ];
  if (isAdmin()) tabs.splice(2, 0, { id: 'tabUsers', label: 'Users', key: 'users' });

  mc.innerHTML = `
    <div class="settings-tabs">
      ${tabs.map((t, i) => `<button class="settings-tab ${i === 0 ? 'active' : ''}" id="${t.id}" onclick="switchSettingsTab('${t.key}')">${t.label}</button>`).join('')}
    </div>
    <div id="settingsContent"><div class="loading">Loading\u2026</div></div>`;
  renderCategoriesTab();
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  const tabMap = { categories: 'tabCategories', norms: 'tabNorms', users: 'tabUsers', password: 'tabPassword' };
  const el = document.getElementById(tabMap[tab]);
  if (el) el.classList.add('active');
  if (tab === 'categories') renderCategoriesTab();
  else if (tab === 'users') renderUsersTab();
  else if (tab === 'password') renderPasswordTab();
  else renderNormsTab();
}

async function renderCategoriesTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading categories\u2026</div>';
  try {
    const cats = await apiCall('GET', '/categories');
    state.categories = cats;
    const _isAdmin = isAdmin();

    let html = '<div class="card">';
    if (_isAdmin) {
      html += `<div style="padding:16px 24px;border-bottom:1px solid var(--gray-200);display:flex;gap:12px;align-items:center">
        <input type="text" id="newCatName" placeholder="Category name" style="flex:1;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif">
        <input type="text" id="newCatDesc" placeholder="Description (optional)" style="flex:2;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif">
        <button class="btn btn-primary btn-sm" onclick="addCategory()">Add</button>
      </div>`;
    }
    html += `<table class="data-table"><thead><tr><th>Name</th><th>Description</th><th>Projects</th>${_isAdmin ? '<th>Actions</th>' : ''}</tr></thead><tbody>`;
    for (const c of cats) {
      const count = c.project_count || 0;
      const deleteDisabled = count > 0;
      html += `<tr>
        <td><strong>${esc(c.name)}</strong></td>
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

async function addCategory() {
  const name = document.getElementById('newCatName')?.value.trim();
  const desc = document.getElementById('newCatDesc')?.value.trim() || null;
  if (!name) { showToast('Category name is required', 'error'); return; }
  try {
    await apiCall('POST', '/categories', { name, description: desc });
    showToast('Category created');
    state.categories = [];
    renderCategoriesTab();
  } catch (err) { showToast(err.message, 'error'); }
}

function editCategory(id, name, desc) {
  showModal(`
    <h3>Edit Category</h3>
    <div class="form-group" style="margin-bottom:16px"><label>Name</label><input type="text" id="editCatName" value="${esc(name)}"></div>
    <div class="form-group" style="margin-bottom:16px"><label>Description</label><input type="text" id="editCatDesc" value="${esc(desc)}"></div>
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
  try {
    await apiCall('PUT', `/categories/${id}`, { name, description: desc });
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
