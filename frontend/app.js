/**
 * app.js — xCSG Value Measurement Tracker SPA
 * Alira Health · Confidential
 *
 * Vanilla JS, no frameworks. Chart.js 4.4.0 loaded via CDN (defer).
 * String values for D3 moat test use em dashes (—).
 */

/* ═══════════════════════════════════════════════════════════════════════
   STATE & CONFIG
   ═══════════════════════════════════════════════════════════════════════ */

const API = '/api';
const state = {
  user: null,
  token: sessionStorage.getItem('xcsg_token') || null,
};

const charts = {};          // track Chart.js instances for cleanup

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
  if (!res.ok) throw new Error(json.detail || json.message || `Error ${res.status}`);
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
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function round2(n) { return Math.round(n * 100) / 100; }

/* ═══════════════════════════════════════════════════════════════════════
   DROPDOWN VALUES (must match backend/metrics.py EXACTLY)
   ═══════════════════════════════════════════════════════════════════════ */

const DELIVERABLE_TYPES = [
  'CDD', 'Competitive landscape', 'Financial model', 'Market access',
  'Proposal', 'Call prep brief', 'Presentation', 'KOL mapping'
];
const ENGAGEMENT_STAGES = [
  'New business (pre-mandate)', 'Active engagement', 'Post-engagement (follow-on)'
];
const CALENDAR_DAYS = ['1', '2-3', '4-5', '6-10', '11-20', '20+'];
const TEAM_SIZES = ['1', '2', '3', '4+'];
const REVISION_ROUNDS = ['0', '1', '2', '3+'];
const SCOPE_OPTIONS = [
  'Yes, expanded scope', 'Yes, new engagement', 'No', 'Not yet delivered'
];

// Tier 2 — Expert
const B1_OPTIONS = ['From AI draft', 'Mixed (AI structure, manual content)', 'From blank page'];
const B2_OPTIONS = ['1-3', '4-7', '8-12', '13+'];
const B3_OPTIONS = ['>75% AI', '50-75%', '25-50%', '<25%'];
const B4_OPTIONS = ['Hypothesis-first (tested a specific thesis)', 'Hybrid (hypothesis emerged during work)', 'Discovery-first (open-ended research)'];
const C1_OPTIONS = ['Deep specialist in this TA/methodology', 'Adjacent expertise', 'Generalist'];
const C2_OPTIONS = ['Expert authored (with AI assist)', 'Expert co-authored (shared with team)', 'Expert reviewed only'];
const C3_OPTIONS = ['>75% judgment', '50-75%', '25-50%', '<25%'];
const D1_OPTIONS = ['Yes', 'No'];
const D2_OPTIONS = ['Yes, directly reused and extended', 'Yes, provided useful starting context', 'No, built from scratch'];
// NOTE: em dashes (—) below must match backend exactly
const D3_OPTIONS = [
  'No \u2014 proprietary inputs decisive',
  'Partially \u2014 they would miss key insights',
  'Yes \u2014 all inputs publicly available'
];
const F1_OPTIONS = [
  'Not feasible \u2014 scope or timeline was only possible with AI',
  'Feasible but at 2x+ the cost and time',
  'Feasible at similar cost \u2014 xCSG provided marginal benefit',
  'Legacy would have been more effective'
];
const F2_OPTIONS = ['Yes, largely as-is', 'Yes, with moderate customization', 'No, fully bespoke'];

function optionsHTML(arr, selected) {
  return '<option value="">— Select —</option>' +
    arr.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

/* ═══════════════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════════════ */

function handleLogout() {
  state.token = null;
  state.user = null;
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
  btn.textContent = 'Signing in…';
  try {
    const data = await apiCall('POST', '/auth/login', { username, password });
    state.token = data.access_token;
    state.user = data.user;
    sessionStorage.setItem('xcsg_token', data.access_token);
    document.getElementById('topbarUsername').textContent = data.user.name || data.user.username;
    document.getElementById('topbarAvatar').textContent = (data.user.name || data.user.username)[0].toUpperCase();
    showScreen('app');
    window.location.hash = '#dashboard';
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

function route() {
  const hash = window.location.hash || '#dashboard';

  // Expert route — no auth
  if (hash.startsWith('#expert/')) {
    const token = hash.slice(8);
    showScreen('expert');
    renderExpert(token);
    return;
  }

  // Auth required for everything else
  if (!state.token) { showScreen('login'); return; }
  showScreen('app');

  // Highlight nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const routeName = hash.slice(1).split('/')[0];
  const navEl = document.querySelector(`.nav-item[data-route="${routeName}"]`);
  if (navEl) navEl.classList.add('active');

  // Title
  const titles = { dashboard: 'Dashboard', new: 'New Deliverable', edit: 'Edit Deliverable', deliverables: 'Deliverables', norms: 'Legacy Norms', activity: 'Activity Log' };
  document.getElementById('topbarTitle').textContent = titles[routeName] || 'Dashboard';

  // Fade-in transition
  const mc = document.getElementById('mainContent');
  if (mc) { mc.classList.remove('view-fade-in'); void mc.offsetWidth; mc.classList.add('view-fade-in'); }

  // Render
  if (hash === '#dashboard') renderDashboard();
  else if (hash === '#new') renderNewDeliverable();
  else if (hash.startsWith('#edit/')) renderEditDeliverable(hash.split('/')[1]);
  else if (hash === '#deliverables') renderDeliverables();
  else if (hash === '#norms') renderNorms();
  else if (hash === '#activity') renderActivity();
  else renderDashboard();
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */

async function renderDashboard() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading dashboard…</div>';

  try {
    const [summary, deliverables, gates] = await Promise.all([
      apiCall('GET', '/metrics/summary'),
      apiCall('GET', '/metrics/deliverables'),
      apiCall('GET', '/metrics/scaling-gates'),
    ]);

    const complete = summary.complete_deliverables || summary.complete_count || 0;
    const total = summary.total_deliverables || summary.total_count || 0;
    const checkpoint = summary.checkpoint || 1;
    const nextThreshold = checkpoint === 1 ? 3 : checkpoint === 2 ? 8 : checkpoint === 3 ? 20 : null;

    if (total === 0) {
      mc.innerHTML = `
        <div class="empty-state">
          <h2>Welcome to the xCSG Value Tracker</h2>
          <p>Start by creating your first deliverable to begin measuring xCSG performance.</p>
          <a href="#new" class="btn btn-primary" style="margin-top:16px">Create First Deliverable</a>
        </div>`;
      return;
    }

    let html = '';

    // Dashboard header with export
    html += `<div class="dashboard-header"><div></div><button class="btn-export" onclick="exportExcel()">📥 Export to Excel</button></div>`;

    // Checkpoint progress — step dots
    const cpNames = ['Baseline', 'Patterns', 'Trends', 'Scale'];
    html += `<div class="checkpoint-bar">`;
    for (let i = 1; i <= 4; i++) {
      const cls = i < checkpoint ? 'completed' : i === checkpoint ? 'active' : '';
      html += `<div class="checkpoint-step ${cls}"><div class="checkpoint-dot">${i < checkpoint ? '✓' : i}</div><span>${cpNames[i-1]}</span></div>`;
      if (i < 4) html += `<div class="checkpoint-line${i < checkpoint ? ' done' : ''}"></div>`;
    }
    html += `<div class="checkpoint-meta"><strong>${complete}</strong> / ${nextThreshold || complete} deliverables</div></div>`;

    // KPI cards
    const vm = summary.average_value_multiplier || 0;
    const er = summary.average_effort_ratio || 0;
    const fh = summary.flywheel_health || 0;
    html += `<div class="kpi-grid">
      <div class="kpi-card accent-navy"><div class="kpi-value">${total}</div><div class="kpi-label">Total Deliverables</div><div class="kpi-sub">${complete} complete · ${total - complete} pending</div></div>
      <div class="kpi-card accent-blue"><div class="kpi-value">${round2(vm)}x</div><div class="kpi-label">Avg Value Multiplier</div></div>
      <div class="kpi-card accent-orange"><div class="kpi-value">${round2(er)}x</div><div class="kpi-label">Avg Effort Ratio</div></div>
      <div class="kpi-card accent-green"><div class="kpi-value">${Math.round(fh * 100)}%</div><div class="kpi-label">Flywheel Health</div></div>
    </div>`;

    // Checkpoint 1: Scorecard
    if (deliverables.length > 0) {
      html += `<div class="card" style="margin-top:24px"><h3>Deliverable Scorecard</h3>
        <table class="data-table"><thead><tr>
          <th>Type</th><th>Pioneer</th><th class="text-right">xCSG Days</th><th class="text-right">Legacy Days</th><th class="text-right">Effort Ratio</th><th>Revisions</th><th class="text-right">Value Multiplier</th>
        </tr></thead><tbody>`;
      for (const d of deliverables) {
        html += `<tr>
          <td>${esc(d.deliverable_type)}</td><td>${esc(d.pioneer_name)}</td>
          <td class="text-right">${round2(d.xcsg_person_days)}</td><td class="text-right">${round2(d.legacy_person_days)}</td>
          <td class="text-right"><strong>${round2(d.effort_ratio)}x</strong></td>
          <td>${d.xcsg_revisions} → ${d.legacy_revisions}</td>
          <td class="text-right vm-cell">${round2(d.value_multiplier)}x</td>
        </tr>`;
      }
      html += '</tbody></table></div>';
    }

    // Checkpoint 2+: Charts
    if (checkpoint >= 2 && deliverables.length >= 3) {
      html += `<div class="chart-grid" style="margin-top:24px">
        <div class="card"><h3>Effort Comparison</h3><canvas id="effortChart"></canvas></div>
        <div class="card"><h3>Quality Comparison</h3><canvas id="qualityChart"></canvas></div>
      </div>`;

      html += `<div class="card" style="margin-top:24px"><h3>Flywheel Leg Scores</h3>
        <div class="flywheel-gauges">
          <div class="gauge"><div class="gauge-label">Machine-First</div><div class="gauge-track"><div class="gauge-fill" style="width:${Math.round((summary.machine_first_avg || 0) * 100)}%;background:var(--blue)"></div></div><div class="gauge-value">${Math.round((summary.machine_first_avg || 0) * 100)}%</div></div>
          <div class="gauge"><div class="gauge-label">Senior-Led</div><div class="gauge-track"><div class="gauge-fill" style="width:${Math.round((summary.senior_led_avg || 0) * 100)}%;background:var(--navy)"></div></div><div class="gauge-value">${Math.round((summary.senior_led_avg || 0) * 100)}%</div></div>
          <div class="gauge"><div class="gauge-label">Proprietary Knowledge</div><div class="gauge-track"><div class="gauge-fill" style="width:${Math.round((summary.proprietary_knowledge_avg || 0) * 100)}%;background:var(--orange)"></div></div><div class="gauge-value">${Math.round((summary.proprietary_knowledge_avg || 0) * 100)}%</div></div>
        </div>
      </div>`;
    }

    // Checkpoint 3+: Trend line
    if (checkpoint >= 3 && deliverables.length >= 8) {
      html += `<div class="card" style="margin-top:24px"><h3>Value Multiplier Trend</h3><canvas id="trendChart"></canvas></div>`;
    }

    // Checkpoint 4: Scaling gates
    if (checkpoint >= 4 && gates) {
      html += `<div class="card" style="margin-top:24px"><h3>Scaling Gates</h3><div class="gates-grid">`;
      for (const g of (gates.gates || [])) {
        const badge = g.status === 'pass' ? 'badge-green' : 'badge-orange';
        html += `<div class="gate-item"><span class="badge ${badge}">${g.status === 'pass' ? '✓ Pass' : '⏳ Pending'}</span> ${esc(g.name)}</div>`;
      }
      html += `<div class="gate-summary">${gates.passed_count}/${gates.total_count} gates passed</div></div></div>`;
    }

    mc.innerHTML = html;

    // Render charts after DOM update
    setTimeout(() => {
      if (checkpoint >= 2 && deliverables.length >= 3) {
        renderEffortChart(deliverables);
        renderQualityChart(deliverables);
      }
      if (checkpoint >= 3 && deliverables.length >= 8) {
        renderTrendChart(deliverables);
      }
    }, 100);

  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load dashboard: ${esc(err.message)}</div>`;
  }
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function renderEffortChart(data) {
  const canvas = document.getElementById('effortChart');
  if (!canvas) return;
  destroyChart('effort');
  const labels = data.map(d => d.deliverable_type.slice(0, 15));
  charts.effort = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Legacy Person-Days', data: data.map(d => d.legacy_person_days), backgroundColor: '#9CA3AF' },
        { label: 'xCSG Person-Days', data: data.map(d => d.xcsg_person_days), backgroundColor: '#121F6B' },
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderQualityChart(data) {
  const canvas = document.getElementById('qualityChart');
  if (!canvas) return;
  destroyChart('quality');
  const labels = data.map(d => d.deliverable_type.slice(0, 15));
  charts.quality = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Legacy Revisions', data: data.map(d => d.legacy_revisions), backgroundColor: '#9CA3AF' },
        { label: 'xCSG Revisions', data: data.map(d => d.xcsg_revisions), backgroundColor: '#6EC1E4' },
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderTrendChart(data) {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  destroyChart('trend');
  charts.trend = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map((_, i) => `#${i + 1}`),
      datasets: [{
        label: 'Value Multiplier',
        data: data.map(d => d.value_multiplier),
        borderColor: '#121F6B',
        backgroundColor: 'rgba(18,31,107,0.1)',
        fill: true, tension: 0.3,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   NEW DELIVERABLE
   ═══════════════════════════════════════════════════════════════════════ */

function renderNewDeliverable(prefill = null) {
  const mc = document.getElementById('mainContent');
  const isEdit = !!prefill;
  const title = isEdit ? 'Edit Deliverable' : 'New Deliverable';

  const todayStr = new Date().toISOString().slice(0, 10);
  mc.innerHTML = `
    <div class="card">
      <form id="deliverableForm">
        <fieldset><legend>Deliverable Information</legend>
          <div class="form-row">
            <div class="form-group"><label>Deliverable Type <span class="required">*</span></label><select id="fType" required>${optionsHTML(DELIVERABLE_TYPES, prefill?.deliverable_type)}</select></div>
            <div class="form-group"><label>Engagement Stage <span class="required">*</span></label><select id="fStage" required>${optionsHTML(ENGAGEMENT_STAGES, prefill?.engagement_stage)}</select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Pioneer Name <span class="required">*</span></label><input type="text" id="fPioneer" required value="${esc(prefill?.pioneer_name || '')}"></div>
            <div class="form-group"><label>Pioneer Email</label><input type="email" id="fEmail" value="${esc(prefill?.pioneer_email || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Client Name</label><input type="text" id="fClient" value="${esc(prefill?.client_name || '')}"></div>
            <div class="form-group"><label>Description</label><input type="text" id="fDesc" value="${esc(prefill?.description || '')}"></div>
          </div>
        </fieldset>

        <fieldset><legend>Timeline</legend>
          <div class="form-row">
            <div class="form-group"><label>Date Started</label><input type="date" id="fDateStart" value="${prefill?.date_started || todayStr}"></div>
            <div class="form-group"><label>Date Delivered</label><input type="date" id="fDateEnd" value="${prefill?.date_delivered || ''}"></div>
          </div>
        </fieldset>

        <fieldset><legend>xCSG Performance</legend>
          <div class="form-row">
            <div class="form-group"><label>Calendar Days <span class="required">*</span></label><select id="fXDays" required>${optionsHTML(CALENDAR_DAYS, prefill?.xcsg_calendar_days)}</select></div>
            <div class="form-group"><label>Team Size <span class="required">*</span></label><select id="fXTeam" required>${optionsHTML(TEAM_SIZES, prefill?.xcsg_team_size)}</select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Revision Rounds <span class="required">*</span></label><select id="fXRevisions" required>${optionsHTML(REVISION_ROUNDS, prefill?.xcsg_revision_rounds)}</select></div>
            <div class="form-group"><label>Scope Expansion</label><select id="fScope">${optionsHTML(SCOPE_OPTIONS, prefill?.scope_expansion)}</select></div>
          </div>
        </fieldset>

        <fieldset><legend>Legacy Performance</legend>
          <p class="legacy-note">These fields auto-populate from saved norms when you select a deliverable type. Override if needed.</p>
          <div class="form-row">
            <div class="form-group"><label>Calendar Days</label><select id="fLDays" class="legacy-field">${optionsHTML(CALENDAR_DAYS, prefill?.legacy_calendar_days)}</select></div>
            <div class="form-group"><label>Team Size</label><select id="fLTeam" class="legacy-field">${optionsHTML(TEAM_SIZES, prefill?.legacy_team_size)}</select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Revision Rounds</label><select id="fLRevisions" class="legacy-field">${optionsHTML(REVISION_ROUNDS, prefill?.legacy_revision_rounds)}</select></div>
            <div class="form-group"></div>
          </div>
        </fieldset>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="window.location.hash='#deliverables'">Cancel</button>
          <button type="submit" class="btn btn-primary" style="padding:14px 32px;font-size:15px" id="deliverableSubmit">${isEdit ? 'Save Changes' : 'Create Deliverable'}</button>
        </div>
      </form>
    </div>`;

  // Auto-populate legacy norms on type change
  document.getElementById('fType').addEventListener('change', async function () {
    if (isEdit) return; // don't override on edit
    const type = this.value;
    if (!type) return;
    try {
      const norm = await apiCall('GET', `/norms/${encodeURIComponent(type)}`);
      if (norm) {
        document.getElementById('fLDays').value = norm.typical_calendar_days || '';
        document.getElementById('fLTeam').value = norm.typical_team_size || '';
        document.getElementById('fLRevisions').value = norm.typical_revision_rounds || '';
      }
    } catch { /* norms not found — that's fine */ }
  });

  // Submit
  document.getElementById('deliverableForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const dateStart = document.getElementById('fDateStart').value;
    const dateEnd = document.getElementById('fDateEnd').value;
    if (dateStart && dateEnd && dateStart > dateEnd) {
      showToast('Start date must be before delivery date', 'error');
      return;
    }
    const btn = document.getElementById('deliverableSubmit');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const payload = {
      deliverable_type: document.getElementById('fType').value,
      engagement_stage: document.getElementById('fStage').value,
      pioneer_name: document.getElementById('fPioneer').value.trim(),
      pioneer_email: document.getElementById('fEmail').value.trim() || null,
      client_name: document.getElementById('fClient').value.trim() || null,
      description: document.getElementById('fDesc').value.trim() || null,
      date_started: dateStart || null,
      date_delivered: dateEnd || null,
      xcsg_calendar_days: document.getElementById('fXDays').value,
      xcsg_team_size: document.getElementById('fXTeam').value,
      xcsg_revision_rounds: document.getElementById('fXRevisions').value,
      scope_expansion: document.getElementById('fScope').value || null,
      legacy_calendar_days: document.getElementById('fLDays').value || null,
      legacy_team_size: document.getElementById('fLTeam').value || null,
      legacy_revision_rounds: document.getElementById('fLRevisions').value || null,
    };
    try {
      if (isEdit) {
        await apiCall('PUT', `/deliverables/${prefill.id}`, payload);
        showToast('Deliverable updated');
        window.location.hash = '#deliverables';
      } else {
        const result = await apiCall('POST', '/deliverables', payload);
        const expertUrl = `${window.location.origin}${window.location.pathname}#expert/${result.expert_token}`;
        showModal(`
          <h3>Deliverable Created</h3>
          <p>Share this link with the expert to complete their assessment:</p>
          <div class="expert-link-box">
            <input type="text" value="${expertUrl}" readonly id="expertLinkInput" style="flex:1">
            <button class="btn btn-primary" onclick="copyToClipboard(document.getElementById('expertLinkInput').value)">Copy</button>
          </div>
          <div class="form-actions" style="margin-top:20px">
            <button class="btn btn-secondary" onclick="hideModal();window.location.hash='#deliverables'">Done</button>
          </div>
        `);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Deliverable';
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT DELIVERABLE
   ═══════════════════════════════════════════════════════════════════════ */

async function renderEditDeliverable(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const d = await apiCall('GET', `/deliverables/${id}`);
    renderNewDeliverable(d);
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load deliverable: ${esc(err.message)}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   DELIVERABLES LIST
   ═══════════════════════════════════════════════════════════════════════ */

async function renderDeliverables() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading deliverables…</div>';
  try {
    const rows = await apiCall('GET', '/deliverables');
    if (!rows || rows.length === 0) {
      mc.innerHTML = `<div class="empty-state"><h3>No deliverables yet</h3><p>Create your first one to get started.</p><a href="#new" class="btn btn-primary">New Deliverable</a></div>`;
      return;
    }

    let html = `
      <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center">
        <select id="statusFilter" class="filter-select">
          <option value="">All Status</option>
          <option value="expert_pending">Expert Pending</option>
          <option value="complete">Complete</option>
        </select>
        <a href="#new" class="btn btn-primary" style="margin-left:auto">+ New Deliverable</a>
      </div>
      <div class="card"><table class="data-table" id="deliverableTable"><thead><tr>
        <th>Type</th><th>Pioneer</th><th>Client</th><th>Status</th><th>Created</th><th>Actions</th>
      </tr></thead><tbody>`;

    for (const d of rows) {
      const statusBadge = d.status === 'complete'
        ? '<span class="badge badge-green">Complete</span>'
        : '<span class="badge badge-orange">Expert Pending</span>';
      const linkSvg = '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
      const trashSvg = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      const expertBtn = d.status !== 'complete' && d.expert_token
        ? `<button class="btn-icon" title="Copy expert link" onclick="event.stopPropagation();copyToClipboard('${window.location.origin}${window.location.pathname}#expert/${d.expert_token}')">${linkSvg}</button>`
        : '';
      const isAdmin = state.user && state.user.role === 'admin';
      const deleteBtn = isAdmin
        ? `<button class="btn-icon btn-danger-icon" title="Delete" onclick="event.stopPropagation();confirmDelete(${d.id},'${esc(d.deliverable_type)}')">${trashSvg}</button>`
        : '';
      html += `<tr class="clickable-row" onclick="window.location.hash='#edit/${d.id}'">
        <td>${esc(d.deliverable_type)}</td><td>${esc(d.pioneer_name)}</td><td>${esc(d.client_name || '—')}</td>
        <td>${statusBadge}</td><td>${formatDate(d.created_at)}</td>
        <td class="actions-cell">${expertBtn}${deleteBtn}</td>
      </tr>`;
    }
    html += '</tbody></table></div>';
    mc.innerHTML = html;

    // Filter
    document.getElementById('statusFilter').addEventListener('change', function () {
      const f = this.value;
      document.querySelectorAll('#deliverableTable tbody tr').forEach(tr => {
        if (!f) { tr.style.display = ''; return; }
        const badge = tr.querySelector('.badge');
        const status = badge?.classList.contains('badge-green') ? 'complete' : 'expert_pending';
        tr.style.display = status === f ? '' : 'none';
      });
    });

  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load: ${esc(err.message)}</div>`;
  }
}

function confirmDelete(id, type) {
  showModal(`
    <h3>Delete Deliverable</h3>
    <p>Are you sure you want to delete this <strong>${esc(type)}</strong> deliverable? This will also delete any expert responses.</p>
    <div class="form-actions">
      <button class="btn btn-danger" onclick="doDelete(${id})">Delete</button>
      <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
    </div>
  `);
}

async function doDelete(id) {
  hideModal();
  try {
    await apiCall('DELETE', `/deliverables/${id}`);
    showToast('Deliverable deleted');
    renderDeliverables();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   EXPERT FORM (standalone, no auth)
   ═══════════════════════════════════════════════════════════════════════ */

async function renderExpert(token) {
  const ec = document.getElementById('expertContent');
  ec.innerHTML = '<div class="loading">Loading assessment…</div>';

  try {
    const ctx = await apiCall('GET', `/expert/${token}`);

    if (ctx.already_completed) {
      ec.innerHTML = `
        <div class="expert-thankyou">
          <div class="thankyou-icon">&#10003;</div>
          <h2>Thank You</h2>
          <p>This assessment has already been submitted. Your responses have been recorded.</p>
        </div>`;
      return;
    }

    ec.innerHTML = `
      <div class="expert-section-card">
        <div class="expert-section-title">Deliverable Context</div>
        <div class="context-grid">
          <div><strong>Type:</strong> ${esc(ctx.deliverable_type)}</div>
          <div><strong>Client:</strong> ${esc(ctx.client_name || 'N/A')}</div>
          <div><strong>Pioneer:</strong> ${esc(ctx.pioneer_name)}</div>
          <div><strong>Dates:</strong> ${esc(ctx.date_started || '?')} → ${esc(ctx.date_delivered || '?')}</div>
          <div><strong>Team Size:</strong> ${esc(ctx.xcsg_team_size)}</div>
          <div><strong>Calendar Days:</strong> ${esc(ctx.xcsg_calendar_days)}</div>
        </div>
      </div>

      <div class="expert-progress">
        <span class="expert-progress-dot active"></span>
        <span class="expert-progress-dot"></span>
        <span class="expert-progress-dot"></span>
        <span class="expert-progress-dot"></span>
        <span class="expert-progress-label">4 sections to complete</span>
      </div>

      <form id="expertForm">
        <div class="expert-section-card">
          <div class="expert-section-title">Section B: How AI-Driven Was This Work?</div>
          <div class="expert-section-desc">Assess how much of this deliverable was built using machine-first processes.</div>
          <div class="expert-question"><label><span class="q-id">B1</span> Starting point: Did you build the final deliverable from an AI-generated draft or from a blank page?</label><span class="helper-text">Select whether the initial draft originated from AI tools or was created manually.</span><select name="b1_starting_point" required>${optionsHTML(B1_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">B2</span> Research throughput: How many distinct data sources were synthesized?</label><span class="helper-text">Count unique databases, reports, or feeds that contributed to the analysis.</span><select name="b2_research_sources" required>${optionsHTML(B2_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">B3</span> Assembly ratio: What percentage of data collection and structuring was AI-performed?</label><span class="helper-text">Estimate the share of raw data gathering and organization done by AI vs. manually.</span><select name="b3_assembly_ratio" required>${optionsHTML(B3_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">B4</span> Hypothesis approach: Was this structured around a pre-formed hypothesis or open-ended discovery?</label><span class="helper-text">Hypothesis-first means the team tested a specific thesis; discovery-first means open-ended research.</span><select name="b4_hypothesis_first" required>${optionsHTML(B4_OPTIONS)}</select></div>
        </div>

        <div class="expert-section-card">
          <div class="expert-section-title">Section C: How Senior-Led Was the Engagement?</div>
          <div class="expert-section-desc">Evaluate the depth of expert involvement and judgment applied.</div>
          <div class="expert-question"><label><span class="q-id">C1</span> Specialization match: Is the analyst a recognized domain specialist in this subject?</label><span class="helper-text">Deep specialist = published or recognized expert in this therapeutic area or methodology.</span><select name="c1_specialization" required>${optionsHTML(C1_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">C2</span> Directness: Did the expert author or only review the deliverable?</label><span class="helper-text">Distinguish between hands-on authorship vs. oversight/review role.</span><select name="c2_directness" required>${optionsHTML(C2_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">C3</span> Judgment concentration: What % of expert time was high-value work vs assembly?</label><span class="helper-text">High-value = strategic interpretation, client insight, novel analysis. Assembly = formatting, data entry.</span><select name="c3_judgment_pct" required>${optionsHTML(C3_OPTIONS)}</select></div>
        </div>

        <div class="expert-section-card">
          <div class="expert-section-title">Section D: Proprietary Knowledge Moat</div>
          <div class="expert-section-desc">Assess how much proprietary or accumulated knowledge made this deliverable unique.</div>
          <div class="expert-question"><label><span class="q-id">D1</span> Does this contain data from Alira proprietary sources not available publicly?</label><span class="helper-text">Proprietary sources include internal databases, prior engagement data, or licensed datasets.</span><select name="d1_proprietary_data" required>${optionsHTML(D1_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">D2</span> Did this build on reusable knowledge assets from previous engagements?</label><span class="helper-text">E.g., frameworks, templates, or datasets created in prior work that accelerated this deliverable.</span><select name="d2_knowledge_reuse" required>${optionsHTML(D2_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">D3</span> Could a competitor without Alira's proprietary data have produced an equivalent deliverable?</label><span class="helper-text">This measures the competitive moat created by accumulated institutional knowledge.</span><select name="d3_moat_test" required>${optionsHTML(D3_OPTIONS)}</select></div>
        </div>

        <div class="expert-section-note">Section E is reserved for future framework expansion and is not part of this assessment.</div>

        <div class="expert-section-card">
          <div class="expert-section-title">Section F: Value Creation</div>
          <div class="expert-section-desc">Evaluate whether xCSG created value that wouldn't exist in the legacy model.</div>
          <div class="expert-question"><label><span class="q-id">F1</span> Would this deliverable have been feasible in the legacy model?</label><span class="helper-text">Consider scope, timeline, and resource constraints of the pre-xCSG approach.</span><select name="f1_feasibility" required>${optionsHTML(F1_OPTIONS)}</select></div>
          <div class="expert-question"><label><span class="q-id">F2</span> Could a component be reused as a standardized offering?</label><span class="helper-text">Indicates whether the output or methodology has potential for productization.</span><select name="f2_productization" required>${optionsHTML(F2_OPTIONS)}</select></div>
        </div>

        <div class="expert-submit-area">
          <span class="time-hint">Takes approximately 3 minutes</span>
          <button type="submit" class="btn btn-primary" id="expertSubmit">Submit Assessment</button>
        </div>
      </form>`;

    document.getElementById('expertForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = document.getElementById('expertSubmit');
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      const fd = new FormData(this);
      const payload = Object.fromEntries(fd.entries());
      try {
        const result = await apiCall('POST', `/expert/${token}`, payload);
        if (result.already_completed) {
          ec.innerHTML = `<div class="expert-thankyou"><div class="thankyou-icon">&#10003;</div><h2>Already Submitted</h2><p>This assessment was previously completed.</p></div>`;
        } else {
          ec.innerHTML = `<div class="expert-thankyou"><div class="thankyou-icon">&#10003;</div><h2>Thank You!</h2><p>Your assessment has been recorded successfully.</p></div>`;
        }
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Submit Assessment';
      }
    });

  } catch (err) {
    if (err.message.includes('404') || err.message.includes('invalid')) {
      ec.innerHTML = `<div class="expert-error"><h2>Invalid Link</h2><p>This expert assessment link is invalid or has expired. Please contact the PMO team for a new link.</p></div>`;
    } else {
      ec.innerHTML = `<div class="expert-error"><h2>Connection Error</h2><p>Unable to load the assessment. Please check your connection and try again.</p><button class="btn btn-primary" onclick="renderExpert('${esc(token)}')">Retry</button></div>`;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   LEGACY NORMS
   ═══════════════════════════════════════════════════════════════════════ */

async function renderNorms() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading norms…</div>';
  try {
    const norms = await apiCall('GET', '/norms');
    let html = `
      <div class="card">
        <div class="info-banner">These norms auto-populate legacy performance fields when creating deliverables. Edit them to match your organization's baseline.</div>
        <table class="data-table"><thead><tr>
          <th>Deliverable Type</th><th>Calendar Days</th><th>Team Size</th><th>Revision Rounds</th><th>Notes</th><th>Actions</th>
        </tr></thead><tbody>`;

    for (const n of norms) {
      html += `<tr id="norm-${esc(n.deliverable_type)}">
        <td><strong>${esc(n.deliverable_type)}</strong></td>
        <td><select class="norm-edit" data-field="typical_calendar_days">${optionsHTML(CALENDAR_DAYS, n.typical_calendar_days)}</select></td>
        <td><select class="norm-edit" data-field="typical_team_size">${optionsHTML(TEAM_SIZES, n.typical_team_size)}</select></td>
        <td><select class="norm-edit" data-field="typical_revision_rounds">${optionsHTML(REVISION_ROUNDS, n.typical_revision_rounds)}</select></td>
        <td><input type="text" class="norm-edit" data-field="notes" value="${esc(n.notes || '')}" placeholder="Optional notes"></td>
        <td><button class="btn btn-primary btn-sm norm-save-btn" onclick="saveNorm('${esc(n.deliverable_type)}')">Save</button></td>
      </tr>`;
    }
    html += '</tbody></table></div>';
    mc.innerHTML = html;
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load norms: ${esc(err.message)}</div>`;
  }
}

async function saveNorm(type) {
  const row = document.getElementById(`norm-${type}`);
  if (!row) return;
  const fields = {};
  row.querySelectorAll('.norm-edit').forEach(el => {
    const f = el.dataset.field;
    fields[f] = el.value;
  });
  try {
    await apiCall('PUT', `/norms/${encodeURIComponent(type)}`, fields);
    showToast(`Norms updated for ${type}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ACTIVITY LOG
   ═══════════════════════════════════════════════════════════════════════ */

async function renderActivity() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading activity…</div>';
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
        <td>${esc(a.details || '—')}</td>
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

// Modal close on overlay click
document.getElementById('globalModal')?.addEventListener('click', function (e) {
  if (e.target === this) hideModal();
});

// Nav clicks
document.querySelectorAll('.nav-item[data-route]').forEach(el => {
  el.addEventListener('click', () => {
    window.location.hash = '#' + el.dataset.route;
  });
});

// Logout
on('logoutBtn', 'click', handleLogout);

// Login form — use direct binding to ensure preventDefault fires
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

// Hash routing
window.addEventListener('hashchange', route);

// Restore user from JWT payload (base64 decode the middle segment)
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
  } catch { /* invalid token — will fail on first API call and logout */ }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  if (state.token) {
    restoreUserFromToken(state.token);
    showScreen('app');
    route();
  } else {
    route();
  }
});
