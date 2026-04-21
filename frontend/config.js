// config.js — frontend-only constants. Anything that crosses the wire lives in
// backend/schema.py DASHBOARD_CONFIG and is read from window.schema.dashboard.

window.DASHBOARD = {
  palette: {
    indigo: '#4F46E5', blue: '#6EC1E4', navy: '#121F6B', success: '#10b981',
    warning: '#f59e0b', danger: '#ef4444', gray: '#9CA3AF',
    gray200: '#E5E7EB', gray400: '#9CA3AF', gray500: '#6B7280',
    series: ['#4F46E5', '#6EC1E4', '#10b981', '#f59e0b', '#ef4444',
             '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'],
  },
  animation: { duration: 400, easing: 'cubicOut' },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    textStyle: { color: '#111827', fontSize: 12 },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 8px;',
  },
  legend: { textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 16, itemHeight: 8, itemGap: 24 },
  bucket: {
    quarterLabel: (y, q) => `${y}-Q${q}`,
    monthLabel:   (y, m) => `${y}-${String(m).padStart(2, '0')}`,
  },
  filterStorageKey: 'xcsg.dashboard.filters.v1',
};
