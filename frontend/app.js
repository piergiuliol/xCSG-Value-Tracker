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
const state = {
  user: null,
  token: sessionStorage.getItem('xcsg_token') || null,
  categories: [],  // cached categories list
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

const CONFIDENCE_FLAG_SVG = '<span class="confidence-flag" title="Legacy baseline uses category defaults \u2014 not project-specific"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>';

/* ═══════════════════════════════════════════════════════════════════════
   DROPDOWN VALUES (must match backend/metrics.py EXACTLY)
   ═══════════════════════════════════════════════════════════════════════ */

const CALENDAR_DAYS = ['1', '2-3', '4-5', '6-10', '11-20', '20+'];
const TEAM_SIZES = ['1', '2', '3', '4+'];
const REVISION_ROUNDS = ['0', '1', '2', '3+'];
const SCOPE_OPTIONS = [
  'Yes, expanded scope', 'Yes, new engagement', 'No', 'Not yet delivered'
];

// V2 — Sectors, sub-categories, geographies
const SECTORS = {
  'Pharma': ['Pre-revenue biotech', 'Commercial biotech', 'Specialty pharma', 'Big pharma', 'Generic / Biosimilar'],
  'Pharma Services': ['CRO', 'CDMO'],
  'Medtech': ['Diagnostics', 'Digital health / Health IT', 'Devices', 'Digital therapeutics'],
  'Financial Sponsor': ['VC', 'Small cap PE', 'Mid cap PE', 'Large cap PE', 'Hedge fund', 'Sovereign wealth / Family office'],
};

const GEOGRAPHIES = {
  'North America': ['US', 'Canada', 'Mexico'],
  'Western Europe': ['UK', 'Ireland', 'Germany', 'Austria', 'Switzerland', 'France', 'Italy', 'Spain', 'Portugal', 'Greece', 'Nordics', 'Benelux'],
  'Emerging Europe': ['Poland', 'Czech Republic', 'Romania', 'Hungary', 'Turkey', 'Russia', 'Rest of CEE'],
  'Asia Pacific': ['Japan', 'South Korea', 'China', 'Hong Kong', 'Taiwan', 'Australia', 'New Zealand', 'Singapore', 'India'],
  'Latin America': ['Brazil', 'Argentina', 'Colombia', 'Chile', 'Rest of LatAm'],
  'Middle East & Africa': ['UAE', 'Saudi Arabia', 'Israel', 'South Africa', 'Nigeria', 'Rest of MEA'],
  'Global': ['Multi-regional'],
};
const GEO_KEYS = Object.keys(GEOGRAPHIES);

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

async function route() {
  const hash = window.location.hash || '#portfolio';

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

  // Load categories cache
  await loadCategories();

  // Highlight nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const routeName = hash.slice(1).split('/')[0];
  const navEl = document.querySelector(`.nav-item[data-route="${routeName}"]`);
  if (navEl) navEl.classList.add('active');

  // Title
  const titles = {
    portfolio: 'Portfolio', new: 'New Project', edit: 'Edit Project',
    projects: 'Projects', settings: 'Settings', norms: 'Norms v2', activity: 'Activity Log'
  };
  document.getElementById('topbarTitle').textContent = titles[routeName] || 'Portfolio';

  // Fade-in transition
  const mc = document.getElementById('mainContent');
  if (mc) { mc.classList.remove('view-fade-in'); void mc.offsetWidth; mc.classList.add('view-fade-in'); }

  // Render
  if (hash === '#portfolio') renderPortfolio();
  else if (hash === '#new') renderNewProject();
  else if (hash.startsWith('#edit/')) renderEditProject(hash.split('/')[1]);
  else if (hash === '#projects') renderProjects();
  else if (hash === '#settings') renderSettings();
  else if (hash === '#norms') renderNormsV2Page();
  else if (hash === '#activity') renderActivity();
  else renderPortfolio();
}

/* ═══════════════════════════════════════════════════════════════════════
   PORTFOLIO (was Dashboard)
   ═══════════════════════════════════════════════════════════════════════ */

async function renderPortfolio() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading portfolio\u2026</div>';

  try {
    const [summary, metricsProjects, gates, allProjects] = await Promise.all([
      apiCall('GET', '/metrics/summary'),
      apiCall('GET', '/metrics/projects'),
      apiCall('GET', '/metrics/scaling-gates'),
      apiCall('GET', '/projects'),
    ]);

    const complete = summary.complete_projects || 0;
    const total = summary.total_projects || 0;
    const checkpoint = summary.checkpoint || 1;
    const nextThreshold = checkpoint === 1 ? 3 : checkpoint === 2 ? 8 : checkpoint === 3 ? 20 : null;

    if (total === 0) {
      mc.innerHTML = `
        <div class="empty-state">
          <h2>Welcome to the xCSG Value Tracker</h2>
          <p>Start by creating your first project to begin measuring xCSG performance.</p>
          <a href="#new" class="btn btn-primary" style="margin-top:16px">Create First Project</a>
        </div>`;
      return;
    }

    // Build lookup for legacy_overridden from allProjects
    const overriddenMap = {};
    for (const p of allProjects) {
      overriddenMap[p.id] = !!p.legacy_overridden;
    }

    // Count low-confidence projects in metrics
    const lowConfCount = metricsProjects.filter(m => !overriddenMap[m.id]).length;

    let html = '';

    // Portfolio header with export
    html += `<div class="dashboard-header"><div></div><button class="btn-export" onclick="exportExcel()">Export to Excel</button></div>`;

    // Checkpoint progress — step dots
    const cpNames = ['Baseline', 'Patterns', 'Trends', 'Scale'];
    html += `<div class="checkpoint-bar">`;
    for (let i = 1; i <= 4; i++) {
      const cls = i < checkpoint ? 'completed' : i === checkpoint ? 'active' : '';
      html += `<div class="checkpoint-step ${cls}"><div class="checkpoint-dot">${i < checkpoint ? '\u2713' : i}</div><span>${cpNames[i-1]}</span></div>`;
      if (i < 4) html += `<div class="checkpoint-line${i < checkpoint ? ' done' : ''}"></div>`;
    }
    html += `<div class="checkpoint-meta"><strong>${complete}</strong> / ${nextThreshold || complete} projects</div></div>`;

    // KPI cards
    const vm = summary.average_value_multiplier || 0;
    const er = summary.average_effort_ratio || 0;
    const fh = summary.flywheel_health || 0;
    const vmSubtitle = lowConfCount > 0
      ? `<div class="kpi-sub">${lowConfCount} of ${metricsProjects.length} using category defaults</div>`
      : '';
    const aiRate = summary.ai_adoption_rate != null ? Math.round(summary.ai_adoption_rate * 100) : '—';
    const srLev = summary.senior_leverage || '—';
    const scopePred = summary.scope_predictability || '—';
    html += `<div class="kpi-grid" style="grid-template-columns:repeat(7,1fr)">
      <div class="kpi-card"><div class="kpi-value">${total}</div><div class="kpi-label">Total Projects</div><div class="kpi-sub">${complete} complete \u00b7 ${total - complete} pending</div></div>
      <div class="kpi-card"><div class="kpi-value">${round2(vm)}x</div><div class="kpi-label">Avg Value Multiplier</div>${vmSubtitle}</div>
      <div class="kpi-card"><div class="kpi-value">${round2(er)}x</div><div class="kpi-label">Avg Effort Ratio</div></div>
      <div class="kpi-card"><div class="kpi-value">${Math.round(fh * 100)}%</div><div class="kpi-label">Flywheel Health</div></div>
      <div class="kpi-card"><div class="kpi-value">${typeof aiRate === 'number' ? aiRate + '%' : aiRate}</div><div class="kpi-label">AI Adoption Rate</div></div>
      <div class="kpi-card"><div class="kpi-value">${typeof srLev === 'number' ? round2(srLev) + 'x' : srLev}</div><div class="kpi-label">Senior Leverage</div></div>
      <div class="kpi-card"><div class="kpi-value">${typeof scopePred === 'number' ? round2(scopePred) : scopePred}</div><div class="kpi-label">Scope Predictability</div><div class="kpi-sub">lower = better</div></div>
    </div>`;

    // Filters bar
    const cats = [...new Set(allProjects.map(p => p.category_name).filter(Boolean))].sort();
    const clients = [...new Set(allProjects.map(p => p.client_name).filter(Boolean))].sort();
    const pioneers = [...new Set(allProjects.map(p => p.pioneer_name).filter(Boolean))].sort();

    html += `<div class="portfolio-filters">
      <span class="filters-label">Filter by</span>
      <select id="portfolioCatFilter" class="filter-select"><option value="">All Categories</option>${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
      <select id="portfolioClientFilter" class="filter-select"><option value="">All Clients</option>${clients.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
      <select id="portfolioPioneerFilter" class="filter-select"><option value="">All Pioneers</option>${pioneers.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
      <select id="portfolioStatusFilter" class="filter-select"><option value="">All Status</option><option value="complete">Complete</option><option value="expert_pending">Expert Pending</option></select>
      <select id="portfolioComplexityFilter" class="filter-select"><option value="">All Complexity</option>${[1,2,3,4,5,6,7].map(i=>`<option value="${i}">${i}</option>`).join('')}</select>
      <button class="filter-reset" id="portfolioFilterReset" style="display:none">Clear filters</button>
    </div>`;

    // Scorecard
    if (metricsProjects.length > 0) {
      html += `<div class="card" style="margin-top:8px"><h3 style="padding:16px 24px;font-size:15px;font-weight:700;color:var(--navy)">Project Scorecard</h3>
        <table class="data-table" id="scorecardTable"><thead><tr>
          <th>Project</th><th>Category</th><th>Client</th><th>Pioneer</th><th>Status</th><th class="text-right">Effort Ratio</th><th class="text-right">Value Multiplier</th>
        </tr></thead><tbody>`;
      for (const d of metricsProjects) {
        const isLowConf = !overriddenMap[d.id];
        const confFlag = isLowConf ? CONFIDENCE_FLAG_SVG : '';
        // Find project status from allProjects
        const proj = allProjects.find(p => p.id === d.id);
        const statusVal = proj ? proj.status : 'complete';
        const statusBadge = statusVal === 'complete'
          ? '<span class="badge badge-green">Complete</span>'
          : '<span class="badge badge-orange">Expert Pending</span>';
        html += `<tr data-cat="${esc(d.category_name)}" data-client="${esc(d.client_name || '')}" data-pioneer="${esc(d.pioneer_name)}" data-status="${statusVal}" data-complexity="${d.complexity || ''}">
          <td>${esc(d.project_name)}${confFlag}</td><td>${esc(d.category_name)}</td>
          <td>${esc(d.client_name || '\u2014')}</td><td>${esc(d.pioneer_name)}</td>
          <td>${statusBadge}</td>
          <td class="text-right"><strong>${round2(d.effort_ratio)}x</strong></td>
          <td class="text-right vm-cell${isLowConf ? ' low-confidence' : ''}">${round2(d.value_multiplier)}x</td>
        </tr>`;
      }
      html += '</tbody></table></div>';
    }

    // Checkpoint 2+: Charts
    if (checkpoint >= 2 && metricsProjects.length >= 3) {
      html += `<div class="chart-grid" style="margin-top:24px">
        <div class="card"><h3 style="padding:16px 24px;font-size:15px;font-weight:700;color:var(--navy)">Effort Comparison</h3><canvas id="effortChart"></canvas></div>
        <div class="card"><h3 style="padding:16px 24px;font-size:15px;font-weight:700;color:var(--navy)">Quality Comparison</h3><canvas id="qualityChart"></canvas></div>
      </div>`;

      html += `<div class="card" style="margin-top:24px"><h3 style="padding:16px 24px;font-size:15px;font-weight:700;color:var(--navy)">Flywheel Leg Scores</h3>
        <div class="flywheel-gauges">
          <div class="gauge"><div class="gauge-label">Machine-First</div><div class="gauge-track"><div class="gauge-fill" style="width:${Math.round((summary.machine_first_avg || 0) * 100)}%;background:var(--blue)"></div></div><div class="gauge-value">${Math.round((summary.machine_first_avg || 0) * 100)}%</div></div>
          <div class="gauge"><div class="gauge-label">Senior-Led</div><div class="gauge-track"><div class="gauge-fill" style="width:${Math.round((summary.senior_led_avg || 0) * 100)}%;background:var(--navy)"></div></div><div class="gauge-value">${Math.round((summary.senior_led_avg || 0) * 100)}%</div></div>
          <div class="gauge"><div class="gauge-label">Proprietary Knowledge</div><div class="gauge-track"><div class="gauge-fill" style="width:${Math.round((summary.proprietary_knowledge_avg || 0) * 100)}%;background:var(--orange)"></div></div><div class="gauge-value">${Math.round((summary.proprietary_knowledge_avg || 0) * 100)}%</div></div>
        </div>
      </div>`;
    }

    // Checkpoint 3+: Trend line
    if (checkpoint >= 3 && metricsProjects.length >= 8) {
      html += `<div class="card" style="margin-top:24px"><h3 style="padding:16px 24px;font-size:15px;font-weight:700;color:var(--navy)">Value Multiplier Trend</h3><canvas id="trendChart"></canvas></div>`;
    }

    // Checkpoint 4: Scaling gates
    if (checkpoint >= 4 && gates) {
      html += `<div class="card" style="margin-top:24px"><h3 style="padding:16px 24px;font-size:15px;font-weight:700;color:var(--navy)">Scaling Gates</h3><div class="gates-grid" style="padding:0 24px 24px">`;
      for (const g of (gates.gates || [])) {
        const badge = g.status === 'pass' ? 'badge-green' : 'badge-orange';
        html += `<div class="gate-item"><span class="badge ${badge}">${g.status === 'pass' ? '\u2713 Pass' : '\u23f3 Pending'}</span> ${esc(g.name)}</div>`;
      }
      html += `<div class="gate-summary">${gates.passed_count}/${gates.total_count} gates passed</div></div></div>`;
    }

    mc.innerHTML = html;

    // Portfolio filters
    function applyPortfolioFilters() {
      const catF = document.getElementById('portfolioCatFilter')?.value || '';
      const clientF = document.getElementById('portfolioClientFilter')?.value || '';
      const pioneerF = document.getElementById('portfolioPioneerFilter')?.value || '';
      const statusF = document.getElementById('portfolioStatusFilter')?.value || '';
      const resetBtn = document.getElementById('portfolioFilterReset');

      // Show/hide clear button
      if (resetBtn) {
        resetBtn.style.display = (catF || clientF || pioneerF || statusF) ? '' : 'none';
      }

      let visibleCount = 0;
      document.querySelectorAll('#scorecardTable tbody tr:not(.filter-empty-row)').forEach(tr => {
        const show =
          (!catF || tr.dataset.cat === catF) &&
          (!clientF || tr.dataset.client === clientF) &&
          (!pioneerF || tr.dataset.pioneer === pioneerF) &&
          (!statusF || tr.dataset.status === statusF);
        tr.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });

      // Empty state row
      let emptyRow = document.querySelector('#scorecardTable .filter-empty-row');
      if (visibleCount === 0) {
        if (!emptyRow) {
          emptyRow = document.createElement('tr');
          emptyRow.className = 'filter-empty-row';
          emptyRow.innerHTML = '<td colspan="7" style="text-align:center;padding:32px;color:var(--gray-400)">No projects match the selected filters.</td>';
          document.querySelector('#scorecardTable tbody')?.appendChild(emptyRow);
        }
        emptyRow.style.display = '';
      } else if (emptyRow) {
        emptyRow.style.display = 'none';
      }
    }

    ['portfolioCatFilter', 'portfolioClientFilter', 'portfolioPioneerFilter', 'portfolioStatusFilter', 'portfolioComplexityFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', applyPortfolioFilters);
    });

    // Clear filters
    document.getElementById('portfolioFilterReset')?.addEventListener('click', () => {
      ['portfolioCatFilter', 'portfolioClientFilter', 'portfolioPioneerFilter', 'portfolioStatusFilter', 'portfolioComplexityFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      applyPortfolioFilters();
    });

    // Render charts after DOM update
    setTimeout(() => {
      if (checkpoint >= 2 && metricsProjects.length >= 3) {
        renderEffortChart(metricsProjects);
        renderQualityChart(metricsProjects);
      }
      if (checkpoint >= 3 && metricsProjects.length >= 8) {
        renderTrendChart(metricsProjects);
      }
    }, 100);

  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load portfolio: ${esc(err.message)}</div>`;
  }
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function renderEffortChart(data) {
  const canvas = document.getElementById('effortChart');
  if (!canvas) return;
  destroyChart('effort');
  const labels = data.map(d => (d.project_name || d.category_name).slice(0, 15));
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
  const labels = data.map(d => (d.project_name || d.category_name).slice(0, 15));
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
   NEW PROJECT
   ═══════════════════════════════════════════════════════════════════════ */

function renderNewProject(prefill = null) {
  const mc = document.getElementById('mainContent');
  const isEdit = !!prefill;
  const todayStr = new Date().toISOString().slice(0, 10);
  const legacyClass = isEdit ? '' : 'legacy-auto';
  const legacyOverridden = isEdit && prefill?.legacy_overridden;
  const catName = prefill ? (state.categories.find(c => c.id == prefill.category_id)?.name || '') : '';

  // Pre-fill v2 fields
  const pfComplexity = prefill?.complexity || '';
  const pfSector = prefill?.client_sector || '';
  const pfSubCat = prefill?.client_sub_category || '';
  let pfGeos = [];
  try { pfGeos = prefill?.geographies ? JSON.parse(prefill.geographies) : []; } catch {}
  let pfCountries = [];
  try { pfCountries = prefill?.countries_served ? JSON.parse(prefill.countries_served) : []; } catch {}
  const pfRevisionIntensity = prefill?.xcsg_revision_intensity || '';
  const pfScopeExpansion = prefill?.xcsg_scope_expansion || '';

  function legacySourceText(field) {
    if (isEdit) {
      return legacyOverridden ? '<span class="legacy-source overridden">(overridden)</span>' : '<span class="legacy-source">(from category defaults)</span>';
    }
    return catName ? `<span class="legacy-source" data-legacy-source>(from ${esc(catName)} defaults)</span>` : '<span class="legacy-source" data-legacy-source>(from defaults)</span>';
  }

  const legacyBannerHTML = isEdit ? '' : `
    <div class="legacy-banner" id="legacyBanner">
      <svg class="legacy-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <div><strong>Category defaults loaded.</strong> Adjust these values to match this specific project's legacy context. Overriding improves metric accuracy.</div>
    </div>`;

  // Build geo checkboxes HTML
  function geoCheckboxesHTML() {
    let html = '<div class="geo-section" id="geoSection">';
    html += '<div class="geo-section-title">Geographies</div>';
    for (const geo of GEO_KEYS) {
      const checked = pfGeos.includes(geo) ? 'checked' : '';
      html += `<div class="geo-section" style="margin-bottom:8px">`;
      html += `<label style="font-size:13px;font-weight:500;color:var(--gray-700);cursor:pointer;display:flex;align-items:center;gap:6px"><input type="checkbox" class="geo-region-check" value="${esc(geo)}" ${checked} style="accent-color:var(--navy)">${esc(geo)}</label>`;
      html += `<div class="geo-grid" data-region="${esc(geo)}">`;
      for (const country of GEOGRAPHIES[geo]) {
        const cChecked = pfCountries.includes(country) ? 'checked' : '';
        html += `<label><input type="checkbox" class="country-check" value="${esc(country)}" ${cChecked}>${esc(country)}</label>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  // Sub-category options
  const subCatOptions = SECTORS[pfSector] || [];
  const subCatHTML = '<option value="">— Select Sub-Category —</option>' + subCatOptions.map(v => `<option value="${esc(v)}"${v === pfSubCat ? ' selected' : ''}>${esc(v)}</option>`).join('');

  mc.innerHTML = `
    <div class="card">
      <form id="projectForm">
        <fieldset><legend>Project Information</legend>
          <div class="form-row full">
            <div class="form-group"><label>Project Name <span class="required">*</span></label><input type="text" id="fName" required value="${esc(prefill?.project_name || '')}" placeholder="e.g., Pfizer EU Market Access Q2"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Category <span class="required">*</span></label><select id="fCategory" required>${categoryOptionsHTML(prefill?.category_id)}</select></div>
            <div class="form-group"><label>Client Name</label><input type="text" id="fClient" value="${esc(prefill?.client_name || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Pioneer Name <span class="required">*</span></label><input type="text" id="fPioneer" required value="${esc(prefill?.pioneer_name || '')}"></div>
            <div class="form-group"><label>Pioneer Email</label><input type="email" id="fEmail" value="${esc(prefill?.pioneer_email || '')}"></div>
          </div>
          <div class="form-row full">
            <div class="form-group"><label>Description</label><textarea id="fDesc" rows="3" placeholder="Brief project description">${esc(prefill?.description || '')}</textarea></div>
          </div>
        </fieldset>

        <fieldset><legend>Timeline</legend>
          <div class="form-row">
            <div class="form-group"><label>Date Started</label><input type="date" id="fDateStart" value="${prefill?.date_started || todayStr}"></div>
            <div class="form-group"><label>Target Delivery Date</label><input type="date" id="fDateEnd" value="${prefill?.date_delivered || ''}"></div>
          </div>
        </fieldset>

        <fieldset><legend>Project Context</legend>
          <div class="slider-group">
            <label>Complexity <span class="slider-value-badge" id="complexityBadge">${pfComplexity || '—'}</span></label>
            <div class="slider-labels"><span>1 \u2014 Straightforward</span><span>7 \u2014 Highly complex</span></div>
            <input type="range" class="xcsg-slider" id="fComplexity" min="1" max="7" step="1" value="${pfComplexity || 4}">
          </div>
          <div class="form-row">
            <div class="form-group"><label>Client Sector <span class="required">*</span></label>
              <select id="fSector" required><option value="">— Select Sector —</option>${Object.keys(SECTORS).map(s => `<option value="${esc(s)}"${s === pfSector ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Client Sub-Category <span class="required">*</span></label>
              <select id="fSubCategory" required>${subCatHTML}</select>
            </div>
          </div>
          ${geoCheckboxesHTML()}
        </fieldset>

        <fieldset><legend>xCSG Performance</legend>
          <div class="form-row">
            <div class="form-group"><label>Calendar Days <span class="required">*</span></label><select id="fXDays" required>${optionsHTML(CALENDAR_DAYS, prefill?.xcsg_calendar_days)}</select></div>
            <div class="form-group"><label>Team Size <span class="required">*</span></label><select id="fXTeam" required>${optionsHTML(TEAM_SIZES, prefill?.xcsg_team_size)}</select></div>
          </div>
          <div class="slider-group">
            <label>Revision Intensity <span class="slider-value-badge" id="revisionIntensityBadge">${pfRevisionIntensity || '—'}</span></label>
            <div class="slider-labels"><span>Minimal</span><span>Exhaustive</span></div>
            <input type="range" class="xcsg-slider" id="fRevisionIntensity" min="1" max="7" step="1" value="${pfRevisionIntensity || 3}">
          </div>
          <div class="slider-group">
            <label>Scope Expansion <span class="slider-value-badge" id="scopeExpansionBadge">${pfScopeExpansion || '—'}</span></label>
            <div class="slider-labels"><span>Stayed on scope</span><span>Blew past scope</span></div>
            <input type="range" class="xcsg-slider" id="fScopeExpansion" min="1" max="7" step="1" value="${pfScopeExpansion || 3}">
          </div>
        </fieldset>

        <fieldset><legend>Legacy Baseline</legend>
          <div id="legacyNormInfo"></div>
          ${legacyBannerHTML}
          <div id="legacyNoNorms" class="legacy-no-norms" style="display:none">No defaults available. Enter values manually or set project context above.</div>
          <div class="form-row">
            <div class="form-group"><label>Calendar Days ${legacySourceText('days')}</label><select id="fLDays" class="${legacyClass}">${optionsHTML(CALENDAR_DAYS, prefill?.legacy_calendar_days)}</select></div>
            <div class="form-group"><label>Team Size ${legacySourceText('team')}</label><select id="fLTeam" class="${legacyClass}">${optionsHTML(TEAM_SIZES, prefill?.legacy_team_size)}</select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Revision Rounds ${legacySourceText('revisions')}</label><select id="fLRevisions" class="${legacyClass}">${optionsHTML(REVISION_ROUNDS, prefill?.legacy_revision_rounds)}</select></div>
            <div class="form-group"></div>
          </div>
        </fieldset>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="window.location.hash='#projects'">Cancel</button>
          <button type="submit" class="btn btn-primary" style="padding:14px 32px;font-size:15px" id="projectSubmit">${isEdit ? 'Save Changes' : 'Create Project'}</button>
        </div>
      </form>
    </div>`;

  // Slider live value updates
  const complexitySlider = document.getElementById('fComplexity');
  if (complexitySlider) {
    complexitySlider.addEventListener('input', () => {
      document.getElementById('complexityBadge').textContent = complexitySlider.value;
      tryAutoLookup();
    });
  }
  ['fRevisionIntensity', 'fScopeExpansion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const badgeId = id === 'fRevisionIntensity' ? 'revisionIntensityBadge' : 'scopeExpansionBadge';
      document.getElementById(badgeId).textContent = el.value;
    });
  });

  // Sector → Sub-category cascade
  document.getElementById('fSector')?.addEventListener('change', function () {
 const subs = SECTORS[this.value] || [];
    document.getElementById('fSubCategory').innerHTML = '<option value="">— Select Sub-Category —</option>' + subs.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    tryAutoLookup();
  });
  document.getElementById('fSubCategory')?.addEventListener('change', () => tryAutoLookup());
  document.getElementById('fCategory')?.addEventListener('change', () => tryAutoLookup());

  // Geo region check → toggle countries visibility
  document.querySelectorAll('.geo-region-check').forEach(cb => {
    cb.addEventListener('change', function () {
      const grid = document.querySelector(`.geo-grid[data-region="${this.value}"]`);
      if (grid) grid.style.display = this.checked ? '' : 'none';
      tryAutoLookup();
    });
  });

  // V2 Norm lookup
  let legacyManuallyChanged = false;
  async function tryAutoLookup() {
    if (isEdit) return;
    const catId = document.getElementById('fCategory')?.value;
    const complexity = document.getElementById('fComplexity')?.value;
    const subCat = document.getElementById('fSubCategory')?.value;
    const geoRegions = [];
    document.querySelectorAll('.geo-region-check:checked').forEach(cb => geoRegions.push(cb.value));

    if (!catId || !complexity || !subCat || geoRegions.length === 0) return;

    try {
      const params = new URLSearchParams({ category_id: catId, complexity, client_sub_category: subCat, geographies: JSON.stringify(geoRegions) });
      const norm = await apiCall('GET', `/norms/v2/lookup?${params}`);
      if (norm && norm.sample_size > 0) {
        const n = norm.sample_size;
        let confClass, confText;
        if (n >= 20) { confClass = 'confidence-high'; confText = `Based on ${n} projects`; }
        else if (n >= 5) { confClass = 'confidence-med'; confText = `Based on ${n} projects \u2014 limited data`; }
        else { confClass = 'confidence-low'; confText = 'Limited data \u2014 generic baseline'; }
        const infoEl = document.getElementById('legacyNormInfo');
        if (infoEl) infoEl.innerHTML = `<div style="margin-bottom:16px"><span class="confidence-badge ${confClass}">${confText}</span></div>`;

        const banner = document.getElementById('legacyBanner');
        const noNorms = document.getElementById('legacyNoNorms');
        if (banner) banner.style.display = '';
        if (noNorms) noNorms.style.display = 'none';

        ['fLDays', 'fLTeam', 'fLRevisions'].forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.classList.remove('legacy-overridden'); el.classList.add('legacy-auto'); }
        });
        if (norm.avg_calendar_days) document.getElementById('fLDays').value = norm.avg_calendar_days;
        if (norm.avg_team_size) document.getElementById('fLTeam').value = norm.avg_team_size;
        if (norm.avg_revision_intensity) document.getElementById('fLRevisions').value = norm.avg_revision_intensity;
        legacyManuallyChanged = false;
      }
    } catch {}
  }

  // Legacy field override tracking (new project only)
  if (!isEdit) {
    ['fLDays', 'fLTeam', 'fLRevisions'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          this.classList.remove('legacy-auto'); this.classList.add('legacy-overridden');
          legacyManuallyChanged = true;
          const sourceSpan = this.closest('.form-group')?.querySelector('.legacy-source');
          if (sourceSpan) { sourceSpan.textContent = '(overridden)'; sourceSpan.classList.add('overridden'); }
        });
      }
    });
  }

  // Fallback: old category-based norm load (when no v2 lookup params)
  document.getElementById('fCategory').addEventListener('change', async function () {
    if (isEdit) return;
    const catId = this.value;
    if (!catId) return;
    // Try v2 lookup first; if not all params set, fall back to v1
    const complexity = document.getElementById('fComplexity')?.value;
    const subCat = document.getElementById('fSubCategory')?.value;
    const geoRegions = [];
    document.querySelectorAll('.geo-region-check:checked').forEach(cb => geoRegions.push(cb.value));
    if (!complexity || !subCat || geoRegions.length === 0) {
      // Fallback to v1 norms
      const selectedCat = state.categories.find(c => c.id == catId);
      const catDisplayName = selectedCat ? selectedCat.name : 'category';
      try {
        const norm = await apiCall('GET', `/norms/${catId}`);
        if (norm) {
          const banner = document.getElementById('legacyBanner'); const noNorms = document.getElementById('legacyNoNorms');
          if (banner) banner.style.display = ''; if (noNorms) noNorms.style.display = 'none';
          ['fLDays', 'fLTeam', 'fLRevisions'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('legacy-overridden'); el.classList.add('legacy-auto'); }
          });
          document.getElementById('fLDays').value = norm.typical_calendar_days || '';
          document.getElementById('fLTeam').value = norm.typical_team_size || '';
          document.getElementById('fLRevisions').value = norm.typical_revision_rounds || '';
          legacyManuallyChanged = false;
          document.querySelectorAll('[data-legacy-source]').forEach(span => { span.textContent = `(from ${catDisplayName} defaults)`; span.classList.remove('overridden'); });
        }
      } catch {
        const banner = document.getElementById('legacyBanner'); const noNorms = document.getElementById('legacyNoNorms');
        if (banner) banner.style.display = 'none'; if (noNorms) noNorms.style.display = '';
        ['fLDays', 'fLTeam', 'fLRevisions'].forEach(id => { const el = document.getElementById(id); if (el) { el.value = ''; el.classList.remove('legacy-auto', 'legacy-overridden'); } });
      }
    }
  });

  // Submit
  document.getElementById('projectForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const dateStart = document.getElementById('fDateStart').value;
    const dateEnd = document.getElementById('fDateEnd').value;
    if (dateStart && dateEnd && dateStart > dateEnd) { showToast('Start date must be before delivery date', 'error'); return; }
    const btn = document.getElementById('projectSubmit'); btn.disabled = true; btn.textContent = 'Saving\u2026';

    const geoRegions = [];
    document.querySelectorAll('.geo-region-check:checked').forEach(cb => geoRegions.push(cb.value));
    const countries = [];
    document.querySelectorAll('.country-check:checked').forEach(cb => countries.push(cb.value));

    const payload = {
      project_name: document.getElementById('fName').value.trim(),
      category_id: parseInt(document.getElementById('fCategory').value),
      pioneer_name: document.getElementById('fPioneer').value.trim(),
      pioneer_email: document.getElementById('fEmail').value.trim() || null,
      client_name: document.getElementById('fClient').value.trim() || null,
      description: document.getElementById('fDesc').value.trim() || null,
      date_started: dateStart || null,
      date_delivered: dateEnd || null,
      complexity: parseFloat(document.getElementById('fComplexity').value),
      client_sector: document.getElementById('fSector').value || null,
      client_sub_category: document.getElementById('fSubCategory').value || null,
      geographies: JSON.stringify(geoRegions),
      countries_served: JSON.stringify(countries),
      xcsg_calendar_days: document.getElementById('fXDays').value,
      xcsg_team_size: document.getElementById('fXTeam').value,
      xcsg_revision_intensity: parseFloat(document.getElementById('fRevisionIntensity').value),
      xcsg_scope_expansion: document.getElementById('fScopeExpansion').value || null,
      legacy_calendar_days: document.getElementById('fLDays').value || null,
      legacy_team_size: document.getElementById('fLTeam').value || null,
      legacy_revision_rounds: document.getElementById('fLRevisions').value || null,
    };
    try {
      if (isEdit) {
        await apiCall('PUT', `/projects/${prefill.id}`, payload);
        showToast('Project updated'); window.location.hash = '#projects';
      } else {
        const result = await apiCall('POST', '/projects', payload);
        if (!legacyManuallyChanged) showToast('Tip: Legacy baseline uses defaults. Edit project to set project-specific values for more accurate metrics.', 'info');
        const expertUrl = `${window.location.origin}${window.location.pathname}#expert/${result.expert_token}`;
        showModal(`<h3>Project Created</h3><p>Share this link with the expert:</p><div class="expert-link-box"><input type="text" value="${expertUrl}" readonly id="expertLinkInput" style="flex:1"><button class="btn btn-primary" onclick="copyToClipboard(document.getElementById('expertLinkInput').value)">Copy</button></div><div class="form-actions" style="margin-top:20px"><button class="btn btn-secondary" onclick="hideModal();window.location.hash='#projects'">Done</button></div>`);
      }
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Create Project'; }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   EXPERT ASSESSMENT READ-ONLY VIEW
   ═══════════════════════════════════════════════════════════════════════ */

const ASSESSMENT_FIELDS = [
  {
    section: 'B', title: 'Machine-First Operations',
    desc: 'How much of this work was driven by AI vs. manual effort?',
    icon: '🤖',
    fields: [
      { id: 'B1', key: 'b1_starting_point', label: 'Starting Point', hint: 'Did the final deliverable start from an AI draft or blank page?', scores: { 'From AI draft': 1.0, 'Mixed (AI structure, manual content)': 0.5, 'From blank page': 0.0 } },
      { id: 'B2', key: 'b2_research_sources', label: 'Research Throughput', hint: 'How many distinct data sources were synthesized?', scores: { '1-3': 0.25, '4-7': 0.5, '8-12': 0.75, '13+': 1.0 } },
      { id: 'B3', key: 'b3_assembly_ratio', label: 'Assembly Ratio', hint: 'What % of data collection & structuring was AI-performed?', scores: { '>75% AI': 1.0, '50-75%': 0.75, '25-50%': 0.5, '<25%': 0.25 } },
      { id: 'B4', key: 'b4_hypothesis_first', label: 'Hypothesis Approach', hint: 'Was this structured around a thesis or open-ended discovery?', scores: { 'Hypothesis-first (tested a specific thesis)': 1.0, 'Hybrid (hypothesis emerged during work)': 0.5, 'Discovery-first (open-ended research)': 0.0 } },
    ]
  },
  {
    section: 'C', title: 'Senior-Led Engagement',
    desc: 'How deeply was senior expertise involved in crafting the output?',
    icon: '👔',
    fields: [
      { id: 'C1', key: 'c1_specialization', label: 'Specialization Match', hint: 'Is the analyst a recognized domain specialist?', scores: { 'Deep specialist in this TA/methodology': 1.0, 'Adjacent expertise': 0.5, 'Generalist': 0.0 } },
      { id: 'C2', key: 'c2_directness', label: 'Directness', hint: 'Did the expert author, co-author, or only review?', scores: { 'Expert authored (with AI assist)': 1.0, 'Expert co-authored (shared with team)': 0.5, 'Expert reviewed only': 0.0 } },
      { id: 'C3', key: 'c3_judgment_pct', label: 'Judgment Concentration', hint: 'What % of expert time was high-value judgment vs assembly?', scores: { '>75% judgment': 1.0, '50-75%': 0.75, '25-50%': 0.5, '<25%': 0.25 } },
    ]
  },
  {
    section: 'D', title: 'Proprietary Knowledge Moat',
    desc: 'How much proprietary or accumulated knowledge made this unique?',
    icon: '🏰',
    fields: [
      { id: 'D1', key: 'd1_proprietary_data', label: 'Proprietary Data', hint: 'Does this contain data from Alira proprietary sources?', scores: { 'Yes': 1.0, 'No': 0.0 } },
      { id: 'D2', key: 'd2_knowledge_reuse', label: 'Knowledge Reuse', hint: 'Did this build on reusable assets from prior engagements?', scores: { 'Yes, directly reused and extended': 1.0, 'Yes, provided useful starting context': 0.5, 'No, built from scratch': 0.0 } },
      { id: 'D3', key: 'd3_moat_test', label: 'Moat Test', hint: 'Could a competitor without Alira\'s data produce an equivalent?', scores: { 'No \u2014 proprietary inputs decisive': 1.0, 'Partially \u2014 they would miss key insights': 0.5, 'Yes \u2014 all inputs publicly available': 0.0 } },
    ]
  },
  {
    section: 'F', title: 'Value Creation',
    desc: 'Whether xCSG created value that wouldn\'t exist in the legacy model.',
    icon: '💎',
    fields: [
      { id: 'F1', key: 'f1_feasibility', label: 'Legacy Feasibility', hint: 'Would this have been feasible without AI?', scores: { 'Not feasible \u2014 scope or timeline was only possible with AI': 1.0, 'Feasible but at 2x+ the cost and time': 0.67, 'Feasible at similar cost \u2014 xCSG provided marginal benefit': 0.33, 'Legacy would have been more effective': 0.0 } },
      { id: 'F2', key: 'f2_productization', label: 'Productization Potential', hint: 'Could a component be reused as a standardized offering?', scores: { 'Yes, largely as-is': 1.0, 'Yes, with moderate customization': 0.5, 'No, fully bespoke': 0.0 } },
    ]
  },
];

function scoreColor(score) {
  if (score >= 0.7) return '#10B981'; // green
  if (score >= 0.4) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

function scoreLabel(score) {
  if (score >= 0.8) return 'Strong';
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Moderate';
  return 'Low';
}

function gaugeHTML(score, size = 56) {
  const pct = Math.round(score * 100);
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 20;
  const offset = circumference * (1 - score);
  return `<div class="score-gauge" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 48 48" width="${size}" height="${size}">
      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--gray-200)" stroke-width="4"/>
      <circle cx="24" cy="24" r="20" fill="none" stroke="${color}" stroke-width="4"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 24 24)"/>
      <text x="24" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="${color}">${pct}</text>
    </svg>
  </div>`;
}

function barHTML(score, label) {
  const pct = Math.round(score * 100);
  const color = scoreColor(score);
  return `<div class="assessment-bar">
    <div class="assessment-bar-track">
      <div class="assessment-bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <span class="assessment-bar-label" style="color:${color}">${label || pct + '%'}</span>
  </div>`;
}

function renderExpertAssessment(er, metrics) {
  // Compute section scores
  const sectionScores = {};
  for (const sec of ASSESSMENT_FIELDS) {
    let sum = 0, count = 0;
    for (const f of sec.fields) {
      const val = er[f.key];
      const s = f.scores[val];
      if (s !== undefined) { sum += s; count++; }
    }
    sectionScores[sec.section] = count > 0 ? sum / count : null;
  }

  // Overall xCSG Score = average of B, C, D (F is descriptive)
  const coreScores = [sectionScores.B, sectionScores.C, sectionScores.D].filter(s => s !== null);
  const overall = coreScores.length > 0 ? coreScores.reduce((a, b) => a + b, 0) / coreScores.length : null;

  // Value multiplier from metrics
  const vm = metrics.value_multiplier;
  const effortRatio = metrics.effort_ratio;
  const qualityRatio = metrics.quality_ratio;

  let html = `<div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
    <span>Expert Assessment</span>
    <span class="badge badge-complete" style="font-size:11px">Submitted</span>
  </div>`;

  html += `<div class="card-body">`;

  // ── Overall Score Banner ──
  html += `<div class="assessment-overall-banner">
    <div class="assessment-overall-left">
      ${overall !== null ? gaugeHTML(overall, 72) : '<div class="score-gauge" style="width:72px;height:72px"><div class="score-na">N/A</div></div>'}
      <div>
        <div class="assessment-overall-title">xCSG Score</div>
        <div class="assessment-overall-subtitle">${overall !== null ? scoreLabel(overall) + ' (' + Math.round(overall * 100) + '/100)' : 'Insufficient data'}</div>
        <div class="assessment-overall-hint">Average of Machine-First, Senior-Led, and Knowledge Moat</div>
      </div>
    </div>
    <div class="assessment-overall-metrics">
      <div class="assessment-metric-chip ${effortRatio >= 2 ? 'chip-green' : effortRatio >= 1 ? 'chip-amber' : 'chip-red'}">
        <span class="chip-value">${effortRatio !== undefined ? effortRatio.toFixed(1) + '×' : '—'}</span>
        <span class="chip-label">Effort Ratio</span>
        <span class="chip-hint">Person-days saved vs legacy</span>
      </div>
      <div class="assessment-metric-chip ${qualityRatio >= 1 ? 'chip-green' : qualityRatio >= 0.5 ? 'chip-amber' : 'chip-red'}">
        <span class="chip-value">${qualityRatio !== undefined ? qualityRatio.toFixed(1) + '×' : '—'}</span>
        <span class="chip-label">Quality Ratio</span>
        <span class="chip-hint">Revision reduction vs legacy</span>
      </div>
      <div class="assessment-metric-chip ${vm >= 3 ? 'chip-green' : vm >= 1.5 ? 'chip-amber' : 'chip-red'}">
        <span class="chip-value">${vm !== undefined ? vm.toFixed(1) + '×' : '—'}</span>
        <span class="chip-label">Value Multiplier</span>
        <span class="chip-hint">Effort × Quality combined</span>
      </div>
    </div>
  </div>`;

  // ── Section Cards ──
  for (const sec of ASSESSMENT_FIELDS) {
    const secScore = sectionScores[sec.section];
    html += `<div class="assessment-section-card">
      <div class="assessment-section-header">
        <div class="assessment-section-title-row">
          <span class="assessment-section-icon">${sec.icon}</span>
          <div>
            <div class="assessment-section-label">Section ${sec.section}: ${esc(sec.title)}</div>
            <div class="assessment-section-desc">${esc(sec.desc)}</div>
          </div>
        </div>
        ${secScore !== null ? gaugeHTML(secScore, 44) : ''}
      </div>
      <div class="assessment-fields">`;

    for (const f of sec.fields) {
      const val = er[f.key] || '—';
      const score = f.scores[val];
      const displayVal = val === 'Yes' ? 'Yes ✓' : val === 'No' ? 'No ✗' : val;
      html += `<div class="assessment-field">
        <div class="assessment-field-top">
          <span class="assessment-field-id">${f.id}</span>
          <span class="assessment-field-label">${esc(f.label)}</span>
          <span class="assessment-field-hint">${esc(f.hint)}</span>
        </div>
        <div class="assessment-field-answer">
          <span class="assessment-field-value">${esc(displayVal)}</span>
          ${score !== undefined ? barHTML(score, scoreLabel(score)) : ''}
        </div>
      </div>`;
    }

    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT PROJECT
   ═══════════════════════════════════════════════════════════════════════ */

async function renderEditProject(id) {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading\u2026</div>';
  try {
    const p = await apiCall('GET', `/projects/${id}`);
    renderNewProject(p);

    // Complete Project button
    if (p.status === 'expert_pending' && p.expert_response) {
      const btnBar = document.createElement('div');
      btnBar.style.cssText = 'display:flex;gap:12px;align-items:center;margin-top:20px;';
      btnBar.innerHTML = '<button class="btn btn-primary" id="completeProjectBtn" style="background:var(--success)">\u2705 Complete Project</button>';
      mc.querySelector('.form-actions')?.after(btnBar);
      btnBar.querySelector('#completeProjectBtn').addEventListener('click', () => showCompletionModal(id, p));
    }

    // If expert response exists, show rich read-only assessment below form
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

function showCompletionModal(projectId, project) {
  const p = project;
  const overlay = document.getElementById('globalModal');
  const card = document.getElementById('globalModalCard');
  card.className = 'modal-card wide-modal';
  card.innerHTML = `
    <div class="completion-modal">
      <h3>Complete Project</h3>
      <p class="modal-subtitle">Compare xCSG vs legacy performance for <strong>${esc(p.project_name)}</strong></p>
      <div class="completion-sides">
        <div class="completion-side xcsg-side">
          <h4>\uD83E\uDD16 xCSG Performance</h4>
          <div class="completion-slider"><label>Revision Intensity <span class="slider-value-badge" id="compXRI">${p.xcsg_revision_intensity || 3}</span></label><div class="slider-labels"><span>Minimal</span><span>Exhaustive</span></div><input type="range" class="xcsg-slider" id="compXcsgRI" min="1" max="7" step="1" value="${p.xcsg_revision_intensity || 3}"></div>
          <div class="completion-slider"><label>Scope Expansion <span class="slider-value-badge" id="compXSE">${p.xcsg_scope_expansion || 3}</span></label><div class="slider-labels"><span>Stayed on scope</span><span>Blew past scope</span></div><input type="range" class="xcsg-slider" id="compXcsgSE" min="1" max="7" step="1" value="${p.xcsg_scope_expansion || 3}"></div>
          <div class="completion-slider"><label>Senior Involvement <span class="slider-value-badge" id="compXSI">3</span></label><div class="slider-labels"><span>Junior-led</span><span>Senior-led</span></div><input type="range" class="xcsg-slider" id="compXcsgSI" min="1" max="7" step="1" value="3"></div>
          <div class="completion-slider"><label>AI Usage <span class="slider-value-badge" id="compXAI">3</span></label><div class="slider-labels"><span>None</span><span>Fully machine-first</span></div><input type="range" class="xcsg-slider" id="compXcsgAI" min="1" max="7" step="1" value="3"></div>
        </div>
        <div class="completion-side legacy-side">
          <h4>\uD83D\uDCBC Legacy Performance</h4>
          <div class="completion-slider"><label>Revision Intensity <span class="slider-value-badge" id="compLRI">3</span></label><div class="slider-labels"><span>Minimal</span><span>Exhaustive</span></div><input type="range" class="xcsg-slider" id="compLegacyRI" min="1" max="7" step="1" value="3"></div>
          <div class="completion-slider"><label>Scope Expansion <span class="slider-value-badge" id="compLSE">3</span></label><div class="slider-labels"><span>Stayed on scope</span><span>Blew past scope</span></div><input type="range" class="xcsg-slider" id="compLegacySE" min="1" max="7" step="1" value="3"></div>
          <div class="completion-slider"><label>Senior Involvement <span class="slider-value-badge" id="compLSI">3</span></label><div class="slider-labels"><span>Junior-led</span><span>Senior-led</span></div><input type="range" class="xcsg-slider" id="compLegacySI" min="1" max="7" step="1" value="3"></div>
          <div class="completion-slider"><label>AI Usage <span class="slider-value-badge" id="compLAI">1</span></label><div class="slider-labels"><span>None</span><span>Fully machine-first</span></div><input type="range" class="xcsg-slider" id="compLegacyAI" min="1" max="7" step="1" value="1"></div>
        </div>
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
        <button class="btn btn-primary" id="submitCompletion" style="background:var(--success)">Complete Project</button>
      </div>
      <div id="completionResult"></div>
    </div>`;
  overlay.classList.add('active');

  // Wire slider badges
  const sliderBadgeMap = [
    ['compXcsgRI','compXRI'], ['compXcsgSE','compXSE'], ['compXcsgSI','compXSI'], ['compXcsgAI','compXAI'],
    ['compLegacyRI','compLRI'], ['compLegacySE','compLSE'], ['compLegacySI','compLSI'], ['compLegacyAI','compLAI'],
  ];
  sliderBadgeMap.forEach(([sliderId, badgeId]) => {
    const s = document.getElementById(sliderId);
    if (s) s.addEventListener('input', () => { document.getElementById(badgeId).textContent = s.value; });
  });

  document.getElementById('submitCompletion').addEventListener('click', async () => {
    const btn = document.getElementById('submitCompletion'); btn.disabled = true; btn.textContent = 'Saving\u2026';
    try {
      const result = await apiCall('POST', `/projects/${projectId}/complete`, {
        xcsg_revision_intensity: parseFloat(document.getElementById('compXcsgRI').value),
        xcsg_scope_expansion: parseFloat(document.getElementById('compXcsgSE').value),
        xcsg_senior_involvement: parseFloat(document.getElementById('compXcsgSI').value),
        xcsg_ai_usage: parseFloat(document.getElementById('compXcsgAI').value),
        legacy_revision_intensity: parseFloat(document.getElementById('compLegacyRI').value),
        legacy_scope_expansion: parseFloat(document.getElementById('compLegacySE').value),
        legacy_senior_involvement: parseFloat(document.getElementById('compLegacySI').value),
        legacy_ai_usage: parseFloat(document.getElementById('compLegacyAI').value),
      });
      const mfs = result.machine_first_score != null ? Math.round(result.machine_first_score) : '—';
      document.getElementById('completionResult').innerHTML = `
        <div class="completion-score-banner">
          <div class="score-label">Machine-First Score</div>
          <div class="score-value">${mfs}${typeof mfs === 'number' ? '/100' : ''}</div>
          <div class="score-desc">Project completed successfully</div>
        </div>`;
      btn.textContent = 'Done';
      btn.onclick = () => { hideModal(); window.location.hash = `#edit/${projectId}`; };
    } catch (err) { showToast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Complete Project'; }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECTS LIST
   ═══════════════════════════════════════════════════════════════════════ */

async function renderProjects() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading projects\u2026</div>';
  try {
    const rows = await apiCall('GET', '/projects');
    if (!rows || rows.length === 0) {
      mc.innerHTML = `<div class="empty-state"><h3>No projects yet</h3><p>Create your first one to get started.</p><a href="#new" class="btn btn-primary">New Project</a></div>`;
      return;
    }

    const cats = [...new Set(rows.map(p => p.category_name).filter(Boolean))].sort();
    const pioneers = [...new Set(rows.map(p => p.pioneer_name).filter(Boolean))].sort();

    let html = `
      <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
        <select id="statusFilter" class="filter-select">
          <option value="">All Status</option>
          <option value="expert_pending">Expert Pending</option>
          <option value="complete">Complete</option>
        </select>
        <select id="catFilter" class="filter-select">
          <option value="">All Categories</option>
          ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        <select id="pioneerFilter" class="filter-select">
          <option value="">All Pioneers</option>
          ${pioneers.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
        </select>
        <a href="#new" class="btn btn-primary" style="margin-left:auto">+ New Project</a>
      </div>
      <div class="card"><table class="data-table" id="projectTable"><thead><tr>
        <th>Project Name</th><th>Category</th><th>Client</th><th>Pioneer</th><th>Status</th><th>Created</th><th>Actions</th>
      </tr></thead><tbody>`;

    for (const p of rows) {
      const statusBadge = p.status === 'complete'
        ? '<span class="badge badge-green">Complete</span>'
        : '<span class="badge badge-orange">Expert Pending</span>';
      const confFlag = !p.legacy_overridden ? CONFIDENCE_FLAG_SVG : '';
      const linkSvg = '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
      const trashSvg = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      const expertBtn = p.status !== 'complete' && p.expert_token
        ? `<button class="btn-icon" title="Copy expert link" onclick="event.stopPropagation();copyToClipboard('${window.location.origin}${window.location.pathname}#expert/${p.expert_token}')">${linkSvg}</button>`
        : '';
      const isAdmin = state.user && state.user.role === 'admin';
      const deleteBtn = isAdmin
        ? `<button class="btn-icon btn-danger-icon" title="Delete" onclick="event.stopPropagation();confirmDelete(${p.id},'${esc(p.project_name)}')">${trashSvg}</button>`
        : '';
      html += `<tr class="clickable-row" data-status="${p.status}" data-cat="${esc(p.category_name)}" data-pioneer="${esc(p.pioneer_name)}" onclick="window.location.hash='#edit/${p.id}'">
        <td>${esc(p.project_name)}${confFlag}</td><td><span class="badge badge-navy">${esc(p.category_name)}</span></td><td>${esc(p.client_name || '\u2014')}</td>
        <td>${esc(p.pioneer_name)}</td><td>${statusBadge}</td><td>${formatDate(p.created_at)}</td>
        <td class="actions-cell">${expertBtn}${deleteBtn}</td>
      </tr>`;
    }
    html += '</tbody></table></div>';
    mc.innerHTML = html;

    // Filters
    function applyProjectFilters() {
      const sf = document.getElementById('statusFilter')?.value || '';
      const cf = document.getElementById('catFilter')?.value || '';
      const pf = document.getElementById('pioneerFilter')?.value || '';
      document.querySelectorAll('#projectTable tbody tr').forEach(tr => {
        const show =
          (!sf || tr.dataset.status === sf) &&
          (!cf || tr.dataset.cat === cf) &&
          (!pf || tr.dataset.pioneer === pf);
        tr.style.display = show ? '' : 'none';
      });
    }
    document.getElementById('statusFilter')?.addEventListener('change', applyProjectFilters);
    document.getElementById('catFilter')?.addEventListener('change', applyProjectFilters);
    document.getElementById('pioneerFilter')?.addEventListener('change', applyProjectFilters);

  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load: ${esc(err.message)}</div>`;
  }
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
   EXPERT FORM (standalone, no auth)
   ═══════════════════════════════════════════════════════════════════════ */

async function renderExpert(token) {
  const ec = document.getElementById('expertContent');
  ec.innerHTML = '<div class="loading">Loading assessment\u2026</div>';

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
        <div class="context-title">${esc(ctx.project_name)}</div>
        <div class="context-subtitle">${esc(ctx.category_name)}${ctx.client_name ? ' \u00b7 ' + esc(ctx.client_name) : ''}</div>
        ${ctx.description ? `<p class="context-description">${esc(ctx.description)}</p>` : ''}
        <div class="context-grid">
          <div class="context-item">
            <span class="label">Pioneer</span>
            <span class="value">${esc(ctx.pioneer_name)}</span>
          </div>
          <div class="context-item">
            <span class="label">Timeline</span>
            <span class="value">${esc(ctx.date_started || '?')} \u2192 ${esc(ctx.date_delivered || '?')}</span>
          </div>
          <div class="context-item">
            <span class="label">Team Size</span>
            <span class="value">${esc(ctx.xcsg_team_size)}</span>
          </div>
          <div class="context-item">
            <span class="label">Calendar Days</span>
            <span class="value">${esc(ctx.xcsg_calendar_days)}</span>
          </div>
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
      btn.textContent = 'Submitting\u2026';
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
   SETTINGS (Categories + Legacy Norms tabs)
   ═══════════════════════════════════════════════════════════════════════ */

async function renderSettings() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `
    <div class="settings-tabs">
      <button class="settings-tab active" id="tabCategories" onclick="switchSettingsTab('categories')">Categories</button>
      <button class="settings-tab" id="tabNorms" onclick="switchSettingsTab('norms')">Legacy Norms</button>
    </div>
    <div id="settingsContent"><div class="loading">Loading\u2026</div></div>`;
  renderCategoriesTab();
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tab === 'categories' ? 'tabCategories' : 'tabNorms').classList.add('active');
  if (tab === 'categories') renderCategoriesTab();
  else renderNormsTab();
}

async function renderCategoriesTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading categories\u2026</div>';
  try {
    const cats = await apiCall('GET', '/categories');
    state.categories = cats;
    const isAdmin = state.user && state.user.role === 'admin';

    let html = '<div class="card">';
    if (isAdmin) {
      html += `<div style="padding:16px 24px;border-bottom:1px solid var(--gray-200);display:flex;gap:12px;align-items:center">
        <input type="text" id="newCatName" placeholder="Category name" style="flex:1;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif">
        <input type="text" id="newCatDesc" placeholder="Description (optional)" style="flex:2;padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:14px;font-family:Roboto,sans-serif">
        <button class="btn btn-primary btn-sm" onclick="addCategory()">Add</button>
      </div>`;
    }
    html += `<table class="data-table"><thead><tr><th>Name</th><th>Description</th><th>Projects</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead><tbody>`;
    for (const c of cats) {
      const count = c.project_count || 0;
      const deleteDisabled = count > 0;
      html += `<tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(c.description || '\u2014')}</td>
        <td>${count}</td>
        ${isAdmin ? `<td class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="editCategory(${c.id},'${esc(c.name)}','${esc(c.description || '')}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon btn-danger-icon" title="${deleteDisabled ? 'Cannot delete \u2014 ' + count + ' projects use this category' : 'Delete'}" ${deleteDisabled ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''} onclick="${deleteDisabled ? '' : "deleteCategory(" + c.id + ",'" + esc(c.name) + "')"}"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </td>` : ''}
      </tr>`;
    }
    html += '</tbody></table></div>';
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

async function renderNormsTab() {
  const sc = document.getElementById('settingsContent');
  sc.innerHTML = '<div class="loading">Loading norms\u2026</div>';
  try {
    const [norms, cats] = await Promise.all([
      apiCall('GET', '/norms'),
      apiCall('GET', '/categories'),
    ]);

    // Build set of category IDs that have norms
    const normCatIds = new Set(norms.map(n => n.category_id));

    let html = `
      <div class="card">
        <div class="info-banner">These norms pre-fill legacy baseline fields when creating new projects. Pioneers can override them per-project. Think of these as starting suggestions, not fixed values.</div>
        <table class="data-table"><thead><tr>
          <th>Category</th><th>Calendar Days</th><th>Team Size</th><th>Revision Rounds</th><th>Notes</th><th>Actions</th>
        </tr></thead><tbody>`;

    for (const n of norms) {
      html += `<tr id="norm-${n.category_id}">
        <td><strong>${esc(n.category_name)}</strong></td>
        <td><select class="norm-edit" data-field="typical_calendar_days">${optionsHTML(CALENDAR_DAYS, n.typical_calendar_days)}</select></td>
        <td><select class="norm-edit" data-field="typical_team_size">${optionsHTML(TEAM_SIZES, n.typical_team_size)}</select></td>
        <td><select class="norm-edit" data-field="typical_revision_rounds">${optionsHTML(REVISION_ROUNDS, n.typical_revision_rounds)}</select></td>
        <td><input type="text" class="norm-edit" data-field="notes" value="${esc(n.notes || '')}" placeholder="Optional notes"></td>
        <td><button class="btn btn-primary btn-sm norm-save-btn" onclick="saveNorm(${n.category_id})">Save</button></td>
      </tr>`;
    }

    // Show categories without norms
    for (const c of cats) {
      if (!normCatIds.has(c.id)) {
        html += `<tr id="norm-${c.id}" class="norm-not-configured">
          <td><strong>${esc(c.name)}</strong> <span class="badge badge-gray">Not configured</span></td>
          <td><select class="norm-edit" data-field="typical_calendar_days">${optionsHTML(CALENDAR_DAYS)}</select></td>
          <td><select class="norm-edit" data-field="typical_team_size">${optionsHTML(TEAM_SIZES)}</select></td>
          <td><select class="norm-edit" data-field="typical_revision_rounds">${optionsHTML(REVISION_ROUNDS)}</select></td>
          <td><input type="text" class="norm-edit" data-field="notes" value="" placeholder="Optional notes"></td>
          <td><button class="btn btn-primary btn-sm norm-save-btn" onclick="saveNorm(${c.id})">Save</button></td>
        </tr>`;
      }
    }

    html += '</tbody></table></div>';
    sc.innerHTML = html;
  } catch (err) {
    sc.innerHTML = `<div class="error-state">Failed to load norms: ${esc(err.message)}</div>`;
  }
}

async function saveNorm(categoryId) {
  const row = document.getElementById(`norm-${categoryId}`);
  if (!row) return;
  const fields = {};
  row.querySelectorAll('.norm-edit').forEach(el => {
    const f = el.dataset.field;
    fields[f] = el.value;
  });
  try {
    await apiCall('PUT', `/norms/${categoryId}`, fields);
    showToast('Norms updated');
    // Remove "not configured" styling if it was
    row.classList.remove('norm-not-configured');
    const notConfBadge = row.querySelector('.badge-gray');
    if (notConfBadge) notConfBadge.remove();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   NORMS V2 PAGE
   ═══════════════════════════════════════════════════════════════════════ */

async function renderNormsV2Page() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading norms v2\u2026</div>';
  try {
    const [normsData, cats] = await Promise.all([apiCall('GET', '/norms/v2'), apiCall('GET', '/categories')]);
    const isAdmin = state.user && state.user.role === 'admin';

    // Group norms by category
    const grouped = {};
    for (const n of (normsData.norms || normsData || [])) {
      const catId = n.category_id;
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(n);
    }

    let html = `<div class="norms-v2-header"><h1>Norms v2</h1>`;
    if (isAdmin) html += '<button class="btn btn-primary" id="recalcNormsBtn">Recalculate All Norms</button>';
    html += '</div>';

    // Show categories, even those without norms
    for (const cat of cats) {
      const norms = grouped[cat.id] || [];
      html += `<div class="norms-v2-category" data-cat-id="${cat.id}">`;
      html += `<div class="norms-v2-category-header" onclick="this.classList.toggle('collapsed');this.nextElementSibling.classList.toggle('collapsed')">
        <span>${esc(cat.name)} <span style="font-weight:400;color:var(--gray-400);font-size:12px">(${norms.length} norms)</span></span>
        <span class="collapse-icon">\u25BC</span>
      </div>`;
      html += `<div class="norms-v2-category-body">`;

      if (norms.length === 0 && !isAdmin) {
        html += '<div style="padding:16px 20px;color:var(--gray-400);font-size:13px">No norms configured for this category.</div>';
      } else if (norms.length === 0) {
        html += '<div style="padding:16px 20px;text-align:center">';
        html += '<div style="color:var(--gray-400);font-size:13px;margin-bottom:12px">No norms yet — add one to define legacy baselines for this category.</div>';
        html += '<button class="btn btn-primary" onclick="showAddNormForm(' + cat.id + ')" style="font-size:13px;padding:8px 20px">+ Add First Norm</button>';
        html += '</div>';
      }
      // Column headers when norms exist
      if (norms.length > 0) {
        html += `<div class="norms-v2-row norms-v2-col-header">
          <div>Profile</div>
          <div>Cal Days</div>
          <div>Team Size</div>
          <div>Revision Int.</div>
          <div>Scope Exp.</div>
          <div>Senior Inv.</div>
          <div>Sample</div>
        </div>`;
      }
      for (const n of norms) {
        const sampleSize = n.sample_size || 0;
        const sampleClass = sampleSize >= 20 ? 'badge-green' : sampleSize >= 5 ? 'badge-orange' : 'badge-red';
        html += `<div class="norms-v2-row" id="normv2-${n.id}" onclick="toggleNormEdit(${n.id})">
          <div><strong>C${n.complexity != null ? n.complexity : '?'}</strong> <span class="badge badge-navy" style="font-size:10px">${esc(n.client_sector || '\u2014')}</span> <span class="badge badge-gray" style="font-size:10px">${esc(n.client_sub_category || '\u2014')}</span></div>
          <div>${n.avg_calendar_days != null ? n.avg_calendar_days : '\u2014'}</div>
          <div>${n.avg_team_size != null ? n.avg_team_size : '\u2014'}</div>
          <div>${n.avg_revision_intensity != null ? round2(n.avg_revision_intensity) : '\u2014'}</div>
          <div>${n.avg_scope_expansion != null ? round2(n.avg_scope_expansion) : '\u2014'}</div>
          <div>${n.avg_senior_involvement != null ? round2(n.avg_senior_involvement) : '\u2014'}</div>
          <div><span class="badge ${sampleClass}">n=${sampleSize}</span></div>
        </div>
        <div id="normv2-edit-${n.id}" style="display:none"></div>
      `;
      }

      // Add Norm button (admin only)
      // When 0 norms, the empty state already has an Add button, so skip the add-area
      if (isAdmin && norms.length > 0) {
        html += `<div class="norms-v2-add-area" id="normv2-add-area-${cat.id}" style="padding:12px 20px;border-top:1px solid var(--gray-100)">`;
        html += `<button class="btn btn-primary" onclick="showAddNormForm(${cat.id})" style="font-size:13px;padding:8px 20px">+ Add Norm</button>`;
        html += `<div id="normv2-add-form-${cat.id}" style="display:none"></div>`;
        html += '</div>';
      } else if (isAdmin) {
        // Still need the hidden form container for the empty-state Add button
        html += `<div id="normv2-add-form-${cat.id}" style="display:none"></div>`;
      }

      html += '</div></div>';
    }

    mc.innerHTML = html;

    // Recalculate button
    document.getElementById('recalcNormsBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('recalcNormsBtn'); btn.disabled = true; btn.textContent = 'Recalculating\u2026';
      try {
        const result = await apiCall('POST', '/norms/v2/recalculate');
        showToast(`Recalculation complete: ${result.norms_updated || 0} norms updated`, 'success');
        renderNormsV2Page();
      } catch (err) { showToast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Recalculate All Norms'; }
    });
  } catch (err) {
    mc.innerHTML = `<div class="error-state">Failed to load norms: ${esc(err.message)}</div>`;
  }
}

/* ── Norm form helpers (shared between add/edit) ── */

function _normFormHTML(prefix, defaults) {
  defaults = defaults || {};
  const sectorOptions = Object.keys(SECTORS).map(s =>
    `<option value="${esc(s)}"${defaults.client_sector === s ? ' selected' : ''}>${esc(s)}</option>`
  ).join('');

  let geoChecks = '';
  for (const region of GEO_KEYS) {
    geoChecks += `<div class="norm-geo-region"><strong>${esc(region)}</strong>`;
    for (const c of GEOGRAPHIES[region]) {
      const checked = (defaults._geoList || []).includes(c) ? ' checked' : '';
      geoChecks += `<label class="norm-geo-check"><input type="checkbox" name="${prefix}_geo" value="${esc(c)}"${checked}> ${esc(c)}</label>`;
    }
    geoChecks += '</div>';
  }

  // Build sub-category options for current sector
  let subcatOptions = '<option value="">\u2014</option>';
  if (defaults.client_sector && SECTORS[defaults.client_sector]) {
    for (const sc of SECTORS[defaults.client_sector]) {
      subcatOptions += `<option value="${esc(sc)}"${defaults.client_sub_category === sc ? ' selected' : ''}>${esc(sc)}</option>`;
    }
  }

  return `
    <div class="norms-v2-edit-panel">
      <div class="edit-grid">
        <div><label>Complexity (1-7)</label><input type="number" min="1" max="7" step="1" id="${prefix}_complexity" value="${defaults.complexity != null ? defaults.complexity : ''}"></div>
        <div><label>Client Sector</label><select id="${prefix}_sector" onchange="_onSectorChange('${prefix}')"><option value="">\u2014</option>${sectorOptions}</select></div>
        <div><label>Client Sub-Category</label><select id="${prefix}_subcat">${subcatOptions}</select></div>
        <div><label>Avg Calendar Days</label><input type="number" step="0.1" id="${prefix}_cal" value="${defaults.avg_calendar_days != null ? defaults.avg_calendar_days : ''}"></div>
        <div><label>Avg Team Size</label><input type="number" step="0.1" id="${prefix}_team" value="${defaults.avg_team_size != null ? defaults.avg_team_size : ''}"></div>
        <div><label>Avg Revision Intensity (1-7)</label><input type="number" min="1" max="7" step="0.1" id="${prefix}_ri" value="${defaults.avg_revision_intensity != null ? defaults.avg_revision_intensity : ''}"></div>
        <div><label>Avg Scope Expansion</label><input type="number" step="0.1" id="${prefix}_se" value="${defaults.avg_scope_expansion != null ? defaults.avg_scope_expansion : ''}"></div>
        <div><label>Avg Senior Involvement</label><input type="number" step="0.1" id="${prefix}_si" value="${defaults.avg_senior_involvement != null ? defaults.avg_senior_involvement : ''}"></div>
        <div><label>Avg AI Usage</label><input type="number" step="0.1" id="${prefix}_ai" value="${defaults.avg_ai_usage != null ? defaults.avg_ai_usage : ''}"></div>
      </div>
      <div><label style="font-size:12px;font-weight:500;color:var(--gray-600);display:block;margin-bottom:4px">Geographies</label><div class="norm-geo-grid">${geoChecks}</div></div>
      <div style="margin-top:8px"><label style="font-size:12px;font-weight:500;color:var(--gray-600);display:block;margin-bottom:4px">Notes</label><textarea id="${prefix}_notes" rows="2" style="width:100%;padding:8px;border:1px solid var(--gray-300);border-radius:var(--radius-sm);font-size:13px;font-family:Roboto,sans-serif">${esc(defaults.notes || '')}</textarea></div>
    </div>`;
}

function _onSectorChange(prefix) {
  const sector = document.getElementById(`${prefix}_sector`).value;
  const subcatSel = document.getElementById(`${prefix}_subcat`);
  subcatSel.innerHTML = '<option value="">\u2014</option>';
  if (sector && SECTORS[sector]) {
    for (const sc of SECTORS[sector]) {
      subcatSel.innerHTML += `<option value="${esc(sc)}">${esc(sc)}</option>`;
    }
  }
}

function _collectNormFields(prefix) {
  const geoChecked = [];
  document.querySelectorAll(`input[name="${prefix}_geo"]:checked`).forEach(cb => geoChecked.push(cb.value));
  return {
    complexity: document.getElementById(`${prefix}_complexity`)?.value ? parseFloat(document.getElementById(`${prefix}_complexity`).value) : null,
    client_sector: document.getElementById(`${prefix}_sector`)?.value || null,
    client_sub_category: document.getElementById(`${prefix}_subcat`)?.value || null,
    geographies: geoChecked.length ? geoChecked : null,
    avg_calendar_days: document.getElementById(`${prefix}_cal`)?.value ? parseFloat(document.getElementById(`${prefix}_cal`).value) : null,
    avg_team_size: document.getElementById(`${prefix}_team`)?.value ? parseFloat(document.getElementById(`${prefix}_team`).value) : null,
    avg_revision_intensity: document.getElementById(`${prefix}_ri`)?.value ? parseFloat(document.getElementById(`${prefix}_ri`).value) : null,
    avg_scope_expansion: document.getElementById(`${prefix}_se`)?.value ? parseFloat(document.getElementById(`${prefix}_se`).value) : null,
    avg_senior_involvement: document.getElementById(`${prefix}_si`)?.value ? parseFloat(document.getElementById(`${prefix}_si`).value) : null,
    avg_ai_usage: document.getElementById(`${prefix}_ai`)?.value ? parseFloat(document.getElementById(`${prefix}_ai`).value) : null,
    notes: document.getElementById(`${prefix}_notes`)?.value || null,
  };
}

/* ── Add Norm ── */

function showAddNormForm(catId) {
  const container = document.getElementById(`normv2-add-form-${catId}`);
  if (!container) return;
  if (container.style.display !== 'none') {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = '';
  container.innerHTML = _normFormHTML('newnorm', {}) +
    `<div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-primary btn-sm" onclick="createNormV2(${catId})">Save</button>
      <button class="btn btn-sm" style="background:transparent;border:1px solid var(--gray-300)" onclick="showAddNormForm(${catId})">Cancel</button>
    </div>`;
}

async function createNormV2(catId) {
  const payload = _collectNormFields('newnorm');
  try {
    await apiCall('POST', `/norms/v2?category_id=${catId}`, payload);
    showToast('Norm created');
    renderNormsV2Page();
  } catch (err) { showToast(err.message, 'error'); }
}

/* ── Delete Norm ── */

async function deleteNormV2(normId) {
  if (!confirm('Delete this norm? This cannot be undone.')) return;
  try {
    await apiCall('DELETE', `/norms/v2/${normId}`);
    showToast('Norm deleted');
    renderNormsV2Page();
  } catch (err) { showToast(err.message, 'error'); }
}

let activeNormEdit = null;
async function toggleNormEdit(normId) {
  // Close previous
  if (activeNormEdit && activeNormEdit !== normId) {
    const prev = document.getElementById(`normv2-edit-${activeNormEdit}`);
    if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
    const prevRow = document.getElementById(`normv2-${activeNormEdit}`);
    if (prevRow) prevRow.style.background = '';
  }
  const panel = document.getElementById(`normv2-edit-${normId}`);
  const row = document.getElementById(`normv2-${normId}`);
  if (!panel) return;

  if (panel.style.display === 'none') {
    activeNormEdit = normId;
    row.style.background = 'var(--blue-pale)';
    panel.style.display = '';
    try {
      const norm = await apiCall('GET', `/norms/v2/${normId}`);
      // Parse geographies for the checkbox defaults
      let geoList = [];
      if (norm.geographies) {
        try { geoList = JSON.parse(norm.geographies); } catch(e) { geoList = [norm.geographies]; }
      }
      const defaults = { ...norm, _geoList: geoList };
      panel.innerHTML = _normFormHTML(`edit${normId}`, defaults) +
        `<div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-primary btn-sm" onclick="saveNormV2(${normId})">Save</button>
          <button class="btn btn-secondary btn-sm" onclick="loadNormHistory(${normId})">History</button>
          <button class="btn btn-sm" style="background:transparent;border:1px solid var(--gray-300)" onclick="toggleNormEdit(${normId})">Cancel</button>
          <button class="btn btn-sm" style="background:var(--error-bg);color:var(--error-text);border:1px solid var(--error-text);margin-left:auto" onclick="deleteNormV2(${normId})">Delete</button>
        </div>
        <div id="normHistory-${normId}"></div>`;
    } catch (err) {
      panel.innerHTML = `<div style="color:var(--error);font-size:13px;padding:12px">Failed: ${esc(err.message)}</div>`;
    }
  } else {
    activeNormEdit = null;
    row.style.background = '';
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
}

async function saveNormV2(normId) {
  const payload = _collectNormFields(`edit${normId}`);
  try {
    await apiCall('PUT', `/norms/v2/${normId}`, payload);
    showToast('Norm updated');
    renderNormsV2Page();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadNormHistory(normId) {
  const container = document.getElementById(`normHistory-${normId}`);
  if (!container) return;
  container.innerHTML = '<div class="loading" style="padding:12px">Loading history\u2026</div>';
  try {
    const history = await apiCall('GET', `/norms/v2/${normId}/history`);
    if (!history || history.length === 0) {
      container.innerHTML = '<div style="font-size:13px;color:var(--gray-400);padding:8px">No edit history.</div>';
      return;
    }
    let html = '<div class="norms-v2-history"><h4>Edit History</h4>';
    for (const h of history) {
      html += `<div class="history-entry">
        <span class="history-field">${esc(h.field_changed)}</span>
        <span class="history-arrow">\u2192</span>
        ${esc(h.old_value)} <span class="history-arrow">\u2192</span> ${esc(h.new_value)}
        <br><small style="color:var(--gray-400)">${esc(h.changed_by || '')} \u00b7 ${formatDateTime(h.changed_at)}</small>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--error);font-size:13px">Failed: ${esc(err.message)}</div>`;
  }
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
