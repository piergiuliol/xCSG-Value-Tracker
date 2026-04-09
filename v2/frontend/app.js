/**
 * app.js — xCSG Value Measurement Tracker V2 SPA
 * Vanilla JS, no frameworks. Chart.js 4.4.0 loaded via CDN (defer).
 * D3 and G1 options use em dashes (\u2014). No apostrophes in single-quoted strings.
 */

/* ═══════════════════════════════════════════════════════════════════════
   STATE & CONFIG
   ═══════════════════════════════════════════════════════════════════════ */

const API = '/api';
const state = {
    user: null,
    token: window.__app_token || null,
    norms: [],
};
const charts = {};

/* ═══════════════════════════════════════════════════════════════════════
   DROPDOWN VALUES — must match backend/metrics.py EXACTLY
   ═══════════════════════════════════════════════════════════════════════ */

const DELIVERABLE_TYPES = ['CDD', 'Competitive landscape', 'Financial model', 'Market access', 'Proposal', 'Call prep brief', 'Presentation', 'KOL mapping'];
const ENGAGEMENT_STAGES = ['New business (pre-mandate)', 'Active engagement', 'Post-engagement (follow-on)'];
const TEAM_SIZES = ['1', '2', '3', '4+'];
const REVISION_ROUNDS = ['0', '1', '2', '3+'];
const SCOPE_OPTIONS = ['Yes expanded scope', 'Yes new engagement', 'No', 'Not yet delivered'];
const CALENDAR_DAYS_RANGES = ['1', '2-3', '4-5', '6-10', '11-20', '20+'];
const CLIENT_PULSE_OPTIONS = ['Exceeded expectations', 'Met expectations', 'Below expectations', 'Not yet received'];

// Expert form options — strings MUST match backend scoring maps exactly
const B1_OPTIONS = ['From AI draft', 'Mixed', 'From blank page'];
const B2_OPTIONS = ['1-3', '4-7', '8-12', '13+'];
const B3_OPTIONS = ['>75% AI', '50-75%', '25-50%', '<25%'];
const B4_OPTIONS = ['Hypothesis-first', 'Hybrid', 'Discovery-first'];
const B5_OPTIONS = ['>75%', '50-75%', '25-50%', '<25%', 'Did not use AI draft'];
const C1_OPTIONS = ['Deep specialist', 'Adjacent expertise', 'Generalist'];
const C2_OPTIONS = ['Expert authored', 'Expert co-authored', 'Expert reviewed only'];
const C3_OPTIONS = ['>75% judgment', '50-75%', '25-50%', '<25%'];
const D1_OPTIONS = ['Yes', 'No'];
const D2_OPTIONS = ['Yes directly reused and extended', 'Yes provided useful starting context', 'No built from scratch'];
const D3_OPTIONS = ['No \u2014 proprietary inputs decisive', 'Partially \u2014 they would miss key insights', 'Yes \u2014 all inputs publicly available'];
const F1_OPTIONS = ['Not feasible', 'Feasible but 2x+ cost', 'Feasible similar cost', 'Legacy more effective'];
const F2_OPTIONS = ['Yes largely as-is', 'Yes with moderate customization', 'No fully bespoke'];
const G1_OPTIONS = ['Yes without hesitation', 'Yes with reservations', 'No \u2014 legacy would have been better'];

/* ═══════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════ */

function on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
}

async function apiCall(method, endpoint, body, options) {
    options = options || {};
    const headers = { 'Content-Type': 'application/json' };
    if (state.token && !options.skipAuth) headers['Authorization'] = 'Bearer ' + state.token;
    const opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + endpoint, opts);
    if (res.status === 401) { handleLogout(); throw new Error('Session expired'); }
    if (res.status === 204) return null;
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'Error ' + res.status);
    return json;
}

function showToast(msg, type) {
    type = type || 'success';
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function() { t.classList.add('show'); }, 10);
    setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 3500);
}

function showModal(html) {
    var o = document.getElementById('globalModal');
    var c = document.getElementById('globalModalCard');
    if (o && c) { c.innerHTML = html; o.classList.add('active'); }
}

function hideModal() {
    var o = document.getElementById('globalModal');
    if (o) o.classList.remove('active');
}

function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function formatDate(d) {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function round2(n) { return Math.round((n || 0) * 100) / 100; }

function computeCalendarDays(start, end) {
    if (!start || !end) return null;
    var diff = (new Date(end) - new Date(start)) / 86400000;
    return Math.max(Math.round(diff), 1);
}

function optsHTML(arr, selected) {
    var html = '<option value="">\u2014 Select \u2014</option>';
    for (var i = 0; i < arr.length; i++) {
        html += '<option value="' + esc(arr[i]) + '"' + (arr[i] === selected ? ' selected' : '') + '>' + esc(arr[i]) + '</option>';
    }
    return html;
}

function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

/* ═══════════════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════════════ */

function handleLogout() {
    state.token = null;
    state.user = null;
    delete window.__app_token;
    showScreen('login');
}

function showScreen(screen) {
    document.getElementById('loginScreen').style.display = screen === 'login' ? 'flex' : 'none';
    document.getElementById('appShell').style.display = screen === 'app' ? 'flex' : 'none';
    document.getElementById('expertView').style.display = screen === 'expert' ? 'flex' : 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errEl = document.getElementById('loginError');
    var btn = document.getElementById('loginBtn');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in\u2026';
    try {
        var data = await apiCall('POST', '/auth/login', { username: username, password: password });
        state.token = data.access_token;
        window.__app_token = data.access_token;
        state.user = data.user;
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

async function route() {
    var hash = window.location.hash || '#dashboard';

    // Expert route — no auth
    if (hash.startsWith('#expert/')) {
        var token = hash.slice(8);
        showScreen('expert');
        renderExpert(token);
        return;
    }

    if (!state.token) { showScreen('login'); return; }
    showScreen('app');

    // Load norms cache
    if (state.norms.length === 0) {
        try { state.norms = await apiCall('GET', '/norms'); } catch(e) {}
    }

    // Highlight nav
    document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });
    var routeName = hash.slice(1).split('/')[0];
    var navEl = document.querySelector('.nav-item[data-route="' + routeName + '"]');
    if (navEl) navEl.classList.add('active');

    var titles = { dashboard: 'Dashboard', new: 'New Deliverable', deliverables: 'Deliverables', settings: 'Settings', activity: 'Activity Log' };
    document.getElementById('topbarTitle').textContent = titles[routeName] || 'Dashboard';

    var mc = document.getElementById('mainContent');
    mc.classList.remove('view-fade-in');
    void mc.offsetWidth;
    mc.classList.add('view-fade-in');

    if (hash === '#dashboard') await renderDashboard();
    else if (hash === '#new') renderNewDeliverable();
    else if (hash === '#deliverables') await renderDeliverables();
    else if (hash === '#settings') await renderSettings();
    else if (hash === '#activity') await renderActivity();
    else await renderDashboard();
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */

async function renderDashboard() {
    var mc = document.getElementById('mainContent');
    mc.innerHTML = '<div class="kpi-grid" id="kpiGrid"></div><div id="checkpointPanels"></div>';

    try {
        var summary = await apiCall('GET', '/metrics/summary');
        var cp = summary.checkpoint;
        var ri = summary.reuse_intent_rate;

        // KPI cards
        document.getElementById('kpiGrid').innerHTML =
            kpiCard('accent-navy', 'Total Deliverables', summary.total_deliverables, summary.complete_deliverables + ' complete') +
            kpiCard('accent-blue', 'Avg Effort Ratio', summary.average_effort_ratio ? round2(summary.average_effort_ratio).toFixed(1) + 'x faster' : '\u2014', 'vs legacy') +
            kpiCard('accent-orange', 'Avg Quality Ratio', summary.average_quality_ratio ? round2(summary.average_quality_ratio).toFixed(1) + 'x fewer rev.' : '\u2014', 'revisions') +
            kpiCard('accent-green', 'Reuse Intent', ri !== null && ri !== undefined ? round2(ri).toFixed(0) + '% would reuse' : '\u2014', 'G1 score');

        var panels = document.getElementById('checkpointPanels');

        if (cp === 0) {
            panels.innerHTML = '<div class="empty-state"><p>No completed deliverables yet. Create one and submit an expert assessment to see metrics.</p></div>';
            return;
        }

        // Get detailed metrics
        var delivMetrics = await apiCall('GET', '/metrics/deliverables');

        // Checkpoint 1+: Scorecard
        var html = '<div class="card"><div class="card-header"><h3>Scorecard</h3></div><div style="overflow-x:auto;">';
        html += '<table><thead><tr><th>Type</th><th>xCSG Days</th><th>Legacy Days</th><th>Effort Ratio</th><th>xCSG Rev.</th><th>Legacy Rev.</th><th>Quality Ratio</th><th>Value Mult.</th></tr></thead><tbody>';
        for (var i = 0; i < delivMetrics.length; i++) {
            var d = delivMetrics[i];
            html += '<tr><td>' + esc(d.deliverable_type) + '</td><td>' + d.xcsg_calendar_days + '</td><td>' + esc(d.legacy_calendar_days) + '</td>' +
                '<td>' + (d.effort_ratio ? round2(d.effort_ratio).toFixed(2) + 'x' : '\u2014') + '</td>' +
                '<td>' + (d.xcsg_revisions !== null ? d.xcsg_revisions : '\u2014') + '</td>' +
                '<td>' + (d.legacy_revisions !== null ? d.legacy_revisions : '\u2014') + '</td>' +
                '<td>' + (d.quality_ratio ? round2(d.quality_ratio).toFixed(2) + 'x' : '\u2014') + '</td>' +
                '<td>' + (d.value_multiplier ? round2(d.value_multiplier).toFixed(2) + 'x' : '\u2014') + '</td></tr>';
        }
        html += '</tbody></table></div></div>';
        panels.innerHTML = html;

        // F1 Distribution
        panels.innerHTML += '<div class="card"><div class="card-header"><h3>F1 Feasibility Distribution</h3></div><div class="chart-container"><canvas id="f1Chart"></canvas></div></div>';
        renderF1Chart(delivMetrics);

        if (cp >= 2) {
            panels.innerHTML += '<div class="card"><div class="card-header"><h3>Effort Comparison</h3></div><div class="chart-container"><canvas id="effortChart"></canvas></div></div>';
            panels.innerHTML += '<div class="card"><div class="card-header"><h3>Quality Comparison</h3></div><div class="chart-container"><canvas id="qualityChart"></canvas></div></div>';
            panels.innerHTML += '<div class="card"><div class="card-header"><h3>Flywheel Leg Gauges</h3></div><div id="flywheelGauges" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;"></div></div>';
            setTimeout(function() {
                renderEffortBars(delivMetrics);
                renderQualityBars(delivMetrics);
                renderFlywheelGauges(delivMetrics, summary);
            }, 100);
        }

        if (cp >= 3) {
            panels.innerHTML += '<div class="card"><div class="card-header"><h3>Effort Ratio Trend</h3></div><div class="chart-container"><canvas id="erTrend"></canvas></div></div>';
            panels.innerHTML += '<div class="card"><div class="card-header"><h3>Adoption Health Trend (G1)</h3></div><div class="chart-container"><canvas id="adoptTrend"></canvas></div></div>';
            setTimeout(function() {
                renderERTrend(delivMetrics);
                renderAdoptionTrend(delivMetrics);
            }, 150);
        }

        if (cp >= 4) {
            try {
                var gates = await apiCall('GET', '/metrics/scaling-gates');
                panels.innerHTML += '<div class="card"><div class="card-header"><h3>Scaling Gates (' + gates.passed_count + '/7 passed)</h3></div>' + renderGates(gates.gates) + '</div>';
            } catch(e) {}
        }

    } catch (err) {
        mc.innerHTML = '<div class="empty-state"><p>Error loading dashboard: ' + esc(err.message) + '</p></div>';
    }
}

function kpiCard(accent, label, value, sub) {
    return '<div class="kpi-card ' + accent + '"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + esc(String(value)) + '</div><div class="kpi-sub">' + esc(sub) + '</div></div>';
}

function renderF1Chart(data) {
    var counts = {};
    for (var i = 0; i < data.length; i++) {
        var key = data[i].f1_feasibility || 'Unknown';
        counts[key] = (counts[key] || 0) + 1;
    }
    var labels = Object.keys(counts);
    var values = Object.values(counts);
    var canvas = document.getElementById('f1Chart');
    if (!canvas) return;
    destroyChart('f1');
    charts.f1 = new Chart(canvas, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: values, backgroundColor: ['#121F6B', '#6EC1E4', '#FF8300', '#10B981', '#F59E0B'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
}

function renderEffortBars(data) {
    var canvas = document.getElementById('effortChart');
    if (!canvas) return;
    destroyChart('effort');
    var labels = data.map(function(d) { return '#' + d.id + ' ' + d.deliverable_type; });
    var xcsg = data.map(function(d) { return d.xcsg_calendar_days; });
    var legacy = data.map(function(d) {
        var v = d.legacy_calendar_days;
        var midpoints = {'1':1,'2-3':2.5,'4-5':4.5,'6-10':8,'11-20':15,'20+':25};
        return midpoints[v] || 0;
    });
    charts.effort = new Chart(canvas, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'xCSG Days', data: xcsg, backgroundColor: '#6EC1E4' }, { label: 'Legacy Days (midpoint)', data: legacy, backgroundColor: '#121F6B' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderQualityBars(data) {
    var canvas = document.getElementById('qualityChart');
    if (!canvas) return;
    destroyChart('quality');
    var labels = data.map(function(d) { return '#' + d.id + ' ' + d.deliverable_type; });
    var xcsg = data.map(function(d) { return d.xcsg_revisions !== null ? d.xcsg_revisions : 0; });
    var legacy = data.map(function(d) { return d.legacy_revisions !== null ? d.legacy_revisions : 0; });
    charts.quality = new Chart(canvas, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'xCSG Revisions', data: xcsg, backgroundColor: '#FF8300' }, { label: 'Legacy Revisions', data: legacy, backgroundColor: '#121F6B' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderFlywheelGauges(data, summary) {
    var container = document.getElementById('flywheelGauges');
    if (!container) return;
    var mf = summary.machine_first_avg;
    var sl = summary.senior_led_avg;
    var pk = summary.proprietary_knowledge_avg;
    function gauge(label, val) {
        var pct = val !== null ? round2(val * 100).toFixed(0) : 'N/A';
        var color = val === null ? '#D1D5DB' : (val >= 0.7 ? '#10B981' : (val >= 0.4 ? '#F59E0B' : '#EF4444'));
        return '<div style="text-align:center;"><div style="font-weight:700;color:#121F6B;margin-bottom:8px;">' + label + '</div>' +
            '<div style="width:80px;height:80px;border-radius:50%;border:6px solid ' + color + ';display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:' + color + ';">' + pct + '%</div></div>';
    }
    container.innerHTML = gauge('Machine-First', mf) + gauge('Senior-Led', sl) + gauge('Proprietary Knowledge', pk);
}

function renderERTrend(data) {
    var canvas = document.getElementById('erTrend');
    if (!canvas) return;
    destroyChart('erTrend');
    charts.erTrend = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.map(function(d) { return '#' + d.id; }),
            datasets: [{ label: 'Effort Ratio', data: data.map(function(d) { return d.effort_ratio; }), borderColor: '#6EC1E4', backgroundColor: 'rgba(110,193,228,0.1)', fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderAdoptionTrend(data) {
    var canvas = document.getElementById('adoptTrend');
    if (!canvas) return;
    destroyChart('adoptTrend');
    // Cumulative G1 "Yes without hesitation" rate
    var labels = [];
    var values = [];
    var yes = 0;
    for (var i = 0; i < data.length; i++) {
        if (data[i].g1_reuse_intent) {
            if (data[i].g1_reuse_intent === 'Yes without hesitation') yes++;
            labels.push('#' + data[i].id);
            values.push(round2(yes / (i + 1) * 100));
        }
    }
    charts.adoptTrend = new Chart(canvas, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Reuse Intent %', data: values, borderColor: '#10B981', fill: false, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
}

function renderGates(gates) {
    var html = '<div class="gates-grid">';
    for (var i = 0; i < gates.length; i++) {
        var g = gates[i];
        var badge = g.status === 'pass' ? 'badge-success' : (g.status === 'fail' ? 'badge-error' : 'badge-pending');
        html += '<div class="gate-card"><h4>' + esc(g.name) + ' <span class="badge ' + badge + '">' + g.status + '</span></h4>' +
            '<div class="gate-desc">' + esc(g.description) + '</div><div class="gate-detail">' + esc(g.detail) + '</div></div>';
    }
    html += '</div>';
    return html;
}

/* ═══════════════════════════════════════════════════════════════════════
   NEW DELIVERABLE
   ═══════════════════════════════════════════════════════════════════════ */

function renderNewDeliverable() {
    var mc = document.getElementById('mainContent');
    mc.innerHTML = '<form id="newDelivForm">' +
        '<fieldset><legend>Deliverable Info</legend>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Deliverable Type</label><select id="ndType">' + optsHTML(DELIVERABLE_TYPES) + '</select></div>' +
        '<div class="form-group"><label>Engagement Stage</label><select id="ndStage">' + optsHTML(ENGAGEMENT_STAGES) + '</select></div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Pioneer Name</label><input type="text" id="ndPioneer" required></div>' +
        '<div class="form-group"><label>Pioneer Email</label><input type="email" id="ndPioneerEmail"></div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Client Name</label><input type="text" id="ndClient"></div>' +
        '<div class="form-group"><label>Client Contact Email</label><input type="email" id="ndClientEmail"></div>' +
        '</div>' +
        '<div class="form-group"><label>Description</label><textarea id="ndDesc" rows="3"></textarea></div>' +
        '</fieldset>' +

        '<fieldset><legend>Timeline <span id="calendarDaysBadge"></span></legend>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Date Started *</label><input type="date" id="ndDateStarted" required></div>' +
        '<div class="form-group"><label>Date Delivered *</label><input type="date" id="ndDateDelivered" required></div>' +
        '</div>' +
        '</fieldset>' +

        '<fieldset><legend>xCSG Performance</legend>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Team Size</label><select id="ndTeamSize">' + optsHTML(TEAM_SIZES) + '</select></div>' +
        '<div class="form-group"><label>Revision Rounds</label><select id="ndRevisions">' + optsHTML(REVISION_ROUNDS) + '</select></div>' +
        '</div>' +
        '<div class="form-group"><label>Scope Expansion</label><select id="ndScope">' + optsHTML(SCOPE_OPTIONS) + '</select></div>' +
        '</fieldset>' +

        '<fieldset><legend>Legacy Performance</legend>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Calendar Days</label><select id="ndLegacyDays">' + optsHTML(CALENDAR_DAYS_RANGES) + '</select></div>' +
        '<div class="form-group"><label>Team Size</label><select id="ndLegacyTeam">' + optsHTML(TEAM_SIZES) + '</select></div>' +
        '</div>' +
        '<div class="form-group"><label>Revision Rounds</label><select id="ndLegacyRevs">' + optsHTML(REVISION_ROUNDS) + '</select></div>' +
        '</fieldset>' +

        '<fieldset><legend>Client Pulse (G2)</legend>' +
        '<div class="form-group"><label>Client Pulse</label><select id="ndClientPulse">' + optsHTML(CLIENT_PULSE_OPTIONS, 'Not yet received') + '</select></div>' +
        '</fieldset>' +

        '<div style="display:flex;gap:12px;margin-top:24px;">' +
        '<button type="submit" class="btn btn-primary" id="ndSubmitBtn">Create Deliverable</button>' +
        '<button type="button" class="btn btn-secondary" id="ndClearBtn">Clear</button>' +
        '</div></form>';

    // Auto-populate norms when type changes
    document.getElementById('ndType').addEventListener('change', function() {
        var norm = state.norms.find(function(n) { return n.deliverable_type === this.value; }.bind(this));
        if (norm) {
            document.getElementById('ndLegacyDays').value = norm.typical_calendar_days || '';
            document.getElementById('ndLegacyTeam').value = norm.typical_team_size || '';
            document.getElementById('ndLegacyRevs').value = norm.typical_revision_rounds || '';
        }
    });

    // Calendar days computation
    function updateCalendarDays() {
        var start = document.getElementById('ndDateStarted').value;
        var end = document.getElementById('ndDateDelivered').value;
        var badge = document.getElementById('calendarDaysBadge');
        var days = computeCalendarDays(start, end);
        badge.innerHTML = days ? '<span class="calendar-days-badge">' + days + ' calendar days</span>' : '';
    }
    document.getElementById('ndDateStarted').addEventListener('change', updateCalendarDays);
    document.getElementById('ndDateDelivered').addEventListener('change', updateCalendarDays);

    // Submit
    document.getElementById('newDelivForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var btn = document.getElementById('ndSubmitBtn');
        btn.disabled = true; btn.textContent = 'Creating\u2026';
        try {
            var result = await apiCall('POST', '/deliverables', {
                pioneer_name: document.getElementById('ndPioneer').value,
                pioneer_email: document.getElementById('ndPioneerEmail').value || null,
                deliverable_type: document.getElementById('ndType').value,
                engagement_stage: document.getElementById('ndStage').value,
                client_name: document.getElementById('ndClient').value || null,
                client_contact_email: document.getElementById('ndClientEmail').value || null,
                description: document.getElementById('ndDesc').value || null,
                date_started: document.getElementById('ndDateStarted').value,
                date_delivered: document.getElementById('ndDateDelivered').value,
                xcsg_team_size: document.getElementById('ndTeamSize').value,
                xcsg_revision_rounds: document.getElementById('ndRevisions').value,
                scope_expansion: document.getElementById('ndScope').value || null,
                legacy_calendar_days: document.getElementById('ndLegacyDays').value || null,
                legacy_team_size: document.getElementById('ndLegacyTeam').value || null,
                legacy_revision_rounds: document.getElementById('ndLegacyRevs').value || null,
            });
            var link = window.location.origin + '/#expert/' + result.expert_token;
            showModal('<h3 style="color:#121F6B;margin-bottom:12px;">Deliverable Created!</h3>' +
                '<p style="margin-bottom:12px;">Share this expert assessment link:</p>' +
                '<input type="text" value="' + esc(link) + '" readonly style="width:100%;padding:8px;border:1px solid #E5E7EB;border-radius:6px;font-family:monospace;font-size:13px;" id="expertLinkInput">' +
                '<div style="margin-top:16px;display:flex;gap:8px;">' +
                '<button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById(\'expertLinkInput\').value);showToast(\'Copied!\');">Copy Link</button>' +
                '<button class="btn btn-secondary btn-sm" onclick="hideModal();">Close</button></div>');
            showToast('Deliverable created successfully!');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Create Deliverable';
        }
    });

    document.getElementById('ndClearBtn').addEventListener('click', function() {
        document.getElementById('newDelivForm').reset();
        document.getElementById('calendarDaysBadge').innerHTML = '';
    });
}

/* ═══════════════════════════════════════════════════════════════════════
   DELIVERABLES LIST
   ═══════════════════════════════════════════════════════════════════════ */

async function renderDeliverables() {
    var mc = document.getElementById('mainContent');
    mc.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div><select id="delivStatusFilter" style="padding:6px 12px;border:1px solid #E5E7EB;border-radius:6px;">' +
        '<option value="">All Statuses</option><option value="expert_pending">Expert Pending</option><option value="complete">Complete</option></select></div>' +
        '<button class="btn btn-secondary btn-sm" id="exportBtn">Export Excel</button></div>' +
        '<div id="delivTable"></div>';

    document.getElementById('delivStatusFilter').addEventListener('change', loadDelivs);
    document.getElementById('exportBtn').addEventListener('click', async function() {
        try {
            var r = await apiCall('GET', '/export/excel');
            window.location.href = API + '/export/file/' + r.filename;
            showToast('Export downloaded');
        } catch(e) { showToast('Export failed: ' + e.message, 'error'); }
    });

    await loadDelivs();
}

async function loadDelivs() {
    var filter = document.getElementById('delivStatusFilter').value;
    try {
        var data = await apiCall('GET', '/deliverables' + (filter ? '?status=' + filter : ''));
        var items = data.items || [];
        var html = '<table><thead><tr><th>ID</th><th>Type</th><th>Pioneer</th><th>Client</th><th>Status</th><th>Effort Ratio</th><th>Quality Ratio</th><th>G2 Pulse</th></tr></thead><tbody>';
        for (var i = 0; i < items.length; i++) {
            var d = items[i];
            var statusBadge = d.status === 'complete' ? 'badge-success' : 'badge-warning';
            html += '<tr>' +
                '<td>' + d.id + '</td>' +
                '<td>' + esc(d.deliverable_type) + '</td>' +
                '<td>' + esc(d.pioneer_name) + '</td>' +
                '<td>' + esc(d.client_name) + '</td>' +
                '<td><span class="badge ' + statusBadge + '">' + d.status + '</span></td>' +
                '<td>\u2014</td><td>\u2014</td>' +
                '<td>' + renderG2Cell(d) + '</td></tr>';
        }
        if (items.length === 0) html += '<tr><td colspan="8" class="text-center" style="padding:24px;color:#9CA3AF;">No deliverables found</td></tr>';
        html += '</tbody></table>';
        document.getElementById('delivTable').innerHTML = html;

        // Attach G2 change handlers
        document.querySelectorAll('.inline-g2-select').forEach(function(sel) {
            sel.addEventListener('change', async function() {
                var id = this.getAttribute('data-id');
                try {
                    await apiCall('PUT', '/deliverables/' + id, { client_pulse: this.value });
                    showToast('Client pulse updated');
                } catch(e) { showToast('Error: ' + e.message, 'error'); }
            });
        });
    } catch(e) {
        document.getElementById('delivTable').innerHTML = '<div class="empty-state"><p>Error loading deliverables</p></div>';
    }
}

function renderG2Cell(d) {
    if (d.status !== 'complete') return esc(d.client_pulse || 'Not yet received');
    var current = d.client_pulse || 'Not yet received';
    var html = '<select class="inline-g2-select" data-id="' + d.id + '">';
    for (var i = 0; i < CLIENT_PULSE_OPTIONS.length; i++) {
        html += '<option value="' + esc(CLIENT_PULSE_OPTIONS[i]) + '"' + (CLIENT_PULSE_OPTIONS[i] === current ? ' selected' : '') + '>' + esc(CLIENT_PULSE_OPTIONS[i]) + '</option>';
    }
    html += '</select>';
    return html;
}

/* ═══════════════════════════════════════════════════════════════════════
   EXPERT FORM
   ═══════════════════════════════════════════════════════════════════════ */

async function renderExpert(token) {
    var content = document.getElementById('expertContent');
    content.innerHTML = '<p>Loading assessment form\u2026</p>';
    try {
        var ctx = await apiCall('GET', '/expert/' + token, null, { skipAuth: true });
        if (ctx.already_completed) {
            content.innerHTML = '<div class="thank-you"><h2>Already Completed</h2><p>This assessment has already been submitted. Thank you!</p></div>';
            return;
        }
        var xcsgDays = computeCalendarDays(ctx.date_started, ctx.date_delivered);
        content.innerHTML =
            '<div class="expert-context"><h3>Expert Assessment</h3>' +
            '<p><strong>Deliverable:</strong> ' + esc(ctx.deliverable_type) + '</p>' +
            '<p><strong>Client:</strong> ' + esc(ctx.client_name || '\u2014') + '</p>' +
            '<p><strong>Pioneer:</strong> ' + esc(ctx.pioneer_name) + '</p>' +
            '<p><strong>Timeline:</strong> ' + formatDate(ctx.date_started) + ' \u2013 ' + formatDate(ctx.date_delivered) + ' (' + xcsgDays + ' days)</p>' +
            '<p><strong>Team Size:</strong> ' + esc(ctx.xcsg_team_size) + '</p>' +
            '</div>' +
            '<form id="expertForm">' +
            accordionSection('B', 'Machine-First Operations', [
                q('B1', 'Starting point', 'What was the starting point for this deliverable?', B1_OPTIONS, 'b1_starting_point'),
                q('B2', 'Research sources', 'How many research sources were synthesized?', B2_OPTIONS, 'b2_research_sources'),
                q('B3', 'Assembly ratio', 'What percentage of assembly was AI-performed?', B3_OPTIONS, 'b3_assembly_ratio'),
                q('B4', 'Hypothesis approach', 'Was the approach hypothesis-first?', B4_OPTIONS, 'b4_hypothesis_first'),
                q('B5', 'AI Survival Rate', 'What % of AI-generated content survived to the final deliverable?', B5_OPTIONS, 'b5_ai_survival'),
            ]) +
            accordionSection('C', 'Senior-Led Specialized Engagement', [
                q('C1', 'Specialization level', 'How specialized was the expert for this deliverable?', C1_OPTIONS, 'c1_specialization'),
                q('C2', 'Directness', 'How directly was the expert involved?', C2_OPTIONS, 'c2_directness'),
                q('C3', 'Judgment concentration', 'What % of the deliverable was expert judgment?', C3_OPTIONS, 'c3_judgment_pct'),
            ]) +
            accordionSection('D', 'Proprietary Knowledge', [
                q('D1', 'Proprietary data used', 'Was proprietary data used?', D1_OPTIONS, 'd1_proprietary_data'),
                q('D2', 'Knowledge reuse', 'Was institutional knowledge reused?', D2_OPTIONS, 'd2_knowledge_reuse'),
                q('D3', 'Moat test', 'Could a competitor replicate this with public data only?', D3_OPTIONS, 'd3_moat_test'),
            ]) +
            accordionSection('F', 'Value Creation', [
                q('F1', 'Legacy feasibility', 'Could this deliverable have been produced with legacy methods?', F1_OPTIONS, 'f1_feasibility'),
                q('F2', 'Productization potential', 'Could this approach be productized?', F2_OPTIONS, 'f2_productization'),
            ]) +
            accordionSection('G', 'Honest Signal', [
                q('G1', 'Reuse intent', 'Would you choose the xCSG approach again for this deliverable type?', G1_OPTIONS, 'g1_reuse_intent'),
            ]) +
            '<button type="submit" class="btn btn-primary btn-full" style="margin-top:24px;" id="expertSubmitBtn">Submit Assessment</button>' +
            '</form>';

        // Accordion toggle
        document.querySelectorAll('.accordion-header').forEach(function(h) {
            h.addEventListener('click', function() {
                var body = this.nextElementSibling;
                var arrow = this.querySelector('.accordion-arrow');
                body.classList.toggle('open');
                arrow.classList.toggle('open');
            });
        });

        // Open first section
        var firstBody = document.querySelector('.accordion-body');
        var firstArrow = document.querySelector('.accordion-arrow');
        if (firstBody) firstBody.classList.add('open');
        if (firstArrow) firstArrow.classList.add('open');

        // Submit
        document.getElementById('expertForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var btn = document.getElementById('expertSubmitBtn');
            btn.disabled = true; btn.textContent = 'Submitting\u2026';
            var payload = {
                b1_starting_point: document.getElementById('b1_starting_point').value,
                b2_research_sources: document.getElementById('b2_research_sources').value,
                b3_assembly_ratio: document.getElementById('b3_assembly_ratio').value,
                b4_hypothesis_first: document.getElementById('b4_hypothesis_first').value,
                b5_ai_survival: document.getElementById('b5_ai_survival').value,
                c1_specialization: document.getElementById('c1_specialization').value,
                c2_directness: document.getElementById('c2_directness').value,
                c3_judgment_pct: document.getElementById('c3_judgment_pct').value,
                d1_proprietary_data: document.getElementById('d1_proprietary_data').value,
                d2_knowledge_reuse: document.getElementById('d2_knowledge_reuse').value,
                d3_moat_test: document.getElementById('d3_moat_test').value,
                f1_feasibility: document.getElementById('f1_feasibility').value,
                f2_productization: document.getElementById('f2_productization').value,
                g1_reuse_intent: document.getElementById('g1_reuse_intent').value,
            };
            // Validate all filled
            for (var key in payload) {
                if (!payload[key]) { showToast('Please fill in all questions', 'error'); btn.disabled = false; btn.textContent = 'Submit Assessment'; return; }
            }
            try {
                await apiCall('POST', '/expert/' + token, payload, { skipAuth: true });
                content.innerHTML = '<div class="thank-you"><h2>Thank You!</h2><p>Your assessment has been submitted successfully.</p></div>';
            } catch(e) {
                showToast('Error: ' + e.message, 'error');
                btn.disabled = false; btn.textContent = 'Submit Assessment';
            }
        });
    } catch(e) {
        content.innerHTML = '<div class="empty-state"><p>Error loading form: ' + esc(e.message) + '</p></div>';
    }
}

function accordionSection(id, title, questionsHtml) {
    return '<div class="accordion-section"><div class="accordion-header"><span>Section ' + id + ': ' + title + '</span><span class="accordion-arrow">\u25BC</span></div>' +
        '<div class="accordion-body">' + questionsHtml + '</div></div>';
}

function q(id, label, help, options, fieldName) {
    return '<div class="question-group"><label>' + id + '. ' + label + '</label><small>' + help + '</small>' +
        '<select id="' + fieldName + '">' + optsHTML(options) + '</select></div>';
}

/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════════════ */

async function renderSettings() {
    var mc = document.getElementById('mainContent');
    mc.innerHTML = '<div class="card"><div class="card-header"><h3>Legacy Norms</h3></div>' +
        '<div id="normsTable"></div></div>' +
        '<div class="card"><div class="card-header"><h3>Register User</h3></div>' +
        '<form id="registerForm">' +
        '<div class="form-row"><div class="form-group"><label>Username</label><input type="text" id="regUsername" required></div>' +
        '<div class="form-group"><label>Email</label><input type="email" id="regEmail" required></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Password</label><input type="password" id="regPassword" required></div>' +
        '<div class="form-group"><label>Role</label><select id="regRole"><option value="viewer">Viewer</option><option value="analyst">Analyst</option><option value="admin">Admin</option></select></div></div>' +
        '<button type="submit" class="btn btn-primary btn-sm" style="margin-top:12px;">Create User</button></form></div>';

    // Load norms
    try {
        var norms = await apiCall('GET', '/norms');
        var html = '<table class="norm-table"><thead><tr><th>Type</th><th>Calendar Days</th><th>Team Size</th><th>Revision Rounds</th><th>Action</th></tr></thead><tbody>';
        for (var i = 0; i < norms.length; i++) {
            var n = norms[i];
            html += '<tr data-type="' + esc(n.deliverable_type) + '">' +
                '<td>' + esc(n.deliverable_type) + '</td>' +
                '<td><input type="text" value="' + esc(n.typical_calendar_days) + '" data-field="typical_calendar_days"></td>' +
                '<td><input type="text" value="' + esc(n.typical_team_size) + '" data-field="typical_team_size"></td>' +
                '<td><input type="text" value="' + esc(n.typical_revision_rounds) + '" data-field="typical_revision_rounds"></td>' +
                '<td><button class="btn btn-sm btn-primary norm-save">Save</button></td></tr>';
        }
        html += '</tbody></table>';
        document.getElementById('normsTable').innerHTML = html;

        document.querySelectorAll('.norm-save').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var row = this.closest('tr');
                var type = row.getAttribute('data-type');
                var inputs = row.querySelectorAll('input');
                var data = {};
                inputs.forEach(function(inp) { data[inp.getAttribute('data-field')] = inp.value; });
                try {
                    await apiCall('PUT', '/norms/' + encodeURIComponent(type), data);
                    showToast('Norm updated');
                } catch(e) { showToast('Error: ' + e.message, 'error'); }
            });
        });
    } catch(e) {}

    // Register user
    document.getElementById('registerForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            await apiCall('POST', '/auth/register', {
                username: document.getElementById('regUsername').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value,
                role: document.getElementById('regRole').value,
            });
            showToast('User created');
            document.getElementById('registerForm').reset();
        } catch(e) { showToast('Error: ' + e.message, 'error'); }
    });
}

/* ═══════════════════════════════════════════════════════════════════════
   ACTIVITY LOG
   ═══════════════════════════════════════════════════════════════════════ */

async function renderActivity() {
    var mc = document.getElementById('mainContent');
    try {
        var items = await apiCall('GET', '/activity');
        var html = '<table><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>';
        for (var i = 0; i < items.length; i++) {
            html += '<tr><td>' + formatDate(items[i].created_at) + '</td><td>' + esc(items[i].action) + '</td><td>' + esc(items[i].details || '') + '</td></tr>';
        }
        if (items.length === 0) html += '<tr><td colspan="3" class="text-center" style="padding:24px;color:#9CA3AF;">No activity yet</td></tr>';
        html += '</tbody></table>';
        mc.innerHTML = html;
    } catch(e) {
        mc.innerHTML = '<div class="empty-state"><p>Error loading activity log</p></div>';
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {
    on('loginForm', 'submit', handleLogin);
    on('logoutLink', 'click', function(e) { e.preventDefault(); handleLogout(); });
    on('globalModal', 'click', function(e) { if (e.target.id === 'globalModal') hideModal(); });
    window.addEventListener('hashchange', route);
    route();
});
