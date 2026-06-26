import { UsageSummary, DailyUsage, HourlyUsage, SessionUsage, ProjectUsage, BudgetStatus } from '../types';

const fmt = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};
const fmtCost = (n: number): string => '$' + n.toFixed(2);
const fmtDate = (d: Date): string => {
  if (!d || isNaN(d.getTime())) return '-';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (d.toDateString() === now.toDateString()) return 'Today ' + hm;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday ' + hm;
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + hm;
};
const esc = (s: string): string => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function renderSummaryGrid(d: UsageSummary): string {
  const inputSide = d.totalInputTokens + d.totalCacheCreationTokens + d.totalCacheReadTokens;
  const cacheHit = inputSide > 0 ? (d.totalCacheReadTokens / inputSide) * 100 : 0;
  const hasCacheCreation = d.totalCacheCreationTokens > 0;
  const items: [string, string, string][] = [
    ['Cost', fmtCost(d.totalCost), 'cost'],
    ['Messages', fmt(d.messageCount), ''],
    ['Input Tokens', fmt(d.totalInputTokens), ''],
    ['Output Tokens', fmt(d.totalOutputTokens), ''],
  ];
  if (hasCacheCreation) items.push(['Cache Creation', fmt(d.totalCacheCreationTokens), '']);
  items.push(['Cache Read', fmt(d.totalCacheReadTokens), '']);
  items.push(['Cache Hit Rate', cacheHit.toFixed(0) + '%', '']);
  return '<div class="summary-grid">' + items.map(([l, v, c]) =>
    `<div class="summary-item"><div class="label">${l}</div><div class="value ${c}">${v}</div></div>`
  ).join('') + '</div>';
}

function renderCostComposition(d: UsageSummary): string {
  const cb = d.costBreakdown;
  const total = cb.input + cb.output + cb.cacheWrite + cb.cacheRead;
  if (total <= 0) return '';
  const hasCacheWrite = cb.cacheWrite > 0;
  const pct = (v: number) => ((v / total) * 100).toFixed(1);
  const legendItems: string[] = [
    `<span class="legend-item"><span class="legend-dot seg-input"></span>Input ${fmtCost(cb.input)} (${pct(cb.input)}%)</span>`,
    `<span class="legend-item"><span class="legend-dot seg-output"></span>Output ${fmtCost(cb.output)} (${pct(cb.output)}%)</span>`,
  ];
  if (hasCacheWrite) legendItems.push(`<span class="legend-item"><span class="legend-dot seg-cache-creation"></span>Cache Write ${fmtCost(cb.cacheWrite)} (${pct(cb.cacheWrite)}%)</span>`);
  legendItems.push(`<span class="legend-item"><span class="legend-dot seg-cache-read"></span>Cache Read ${fmtCost(cb.cacheRead)} (${pct(cb.cacheRead)}%)</span>`);
  return `<div class="cost-composition">
    <div class="cost-comp-head">Cost Composition</div>
    <div class="cost-comp-bar">
      <div class="cost-comp-seg seg-input" style="width:${pct(cb.input)}%"></div>
      <div class="cost-comp-seg seg-output" style="width:${pct(cb.output)}%"></div>
      ${hasCacheWrite ? `<div class="cost-comp-seg seg-cache-creation" style="width:${pct(cb.cacheWrite)}%"></div>` : ''}
      <div class="cost-comp-seg seg-cache-read" style="width:${pct(cb.cacheRead)}%"></div>
    </div>
    <div class="cost-comp-legend">${legendItems.join('')}</div>
  </div>`;
}

function renderModelBreakdown(d: UsageSummary): string {
  const models = Object.entries(d.modelBreakdown).sort(([, a], [, b]) => b.cost - a.cost);
  if (models.length === 0) return '';
  const hasCacheCreation = models.some(([, m]) => m.cacheCreationTokens > 0);
  const rows = models.map(([model, m], i) => {
    const inputSide = m.inputTokens + m.cacheCreationTokens + m.cacheReadTokens;
    const hitRate = inputSide > 0 ? (m.cacheReadTokens / inputSide) * 100 : 0;
    const details = [
      `<span>Input: ${fmt(m.inputTokens)}</span>`,
      `<span>Output: ${fmt(m.outputTokens)}</span>`,
    ];
    if (hasCacheCreation) details.push(`<span>Cache Creation: ${fmt(m.cacheCreationTokens)}</span>`);
    details.push(`<span>Cache Read: ${fmt(m.cacheReadTokens)}</span>`);
    details.push(`<span>Cache Hit: ${hitRate.toFixed(0)}%</span>`);
    details.push(`<span>Messages: ${fmt(m.count)}</span>`);
    return `<details class="model-item" ${i === 0 ? 'open' : ''}>
      <summary class="model-header"><span class="model-name">${esc(model)}</span><span class="model-cost">${fmtCost(m.cost)}</span></summary>
      <div class="model-details">${details.join('')}</div>
    </details>`;
  }).join('');
  return `<div class="model-breakdown"><h3>Model Breakdown</h3><div class="model-list">${rows}</div></div>`;
}

function renderBarChart(items: { label: string; value: number }[]): string {
  if (items.length === 0) return '';
  const max = Math.max(...items.map(i => i.value), 1);
  const bars = items.map(i => {
    const h = (i.value / max) * 120;
    return `<div class="hc-col"><div class="hc-bar" style="height:${h}px" title="${esc(i.label)}: ${fmtCost(i.value)}"></div><div class="hc-xlabel">${esc(i.label)}</div></div>`;
  }).join('');
  return `<div class="hc-wrap"><div class="hc-yaxis"><span>${fmtCost(max)}</span><span>${fmtCost(max / 2)}</span><span>$0</span></div><div class="hc-main"><div class="hc-bars">${bars}</div></div></div>`;
}

function renderCompositionChart(items: { label: string; data: UsageSummary }[]): string {
  if (items.length === 0) return '';
  const hasCacheCreation = items.some(i => i.data.totalCacheCreationTokens > 0);
  const totals = items.map(i => i.data.totalInputTokens + i.data.totalOutputTokens + i.data.totalCacheCreationTokens + i.data.totalCacheReadTokens);
  const max = Math.max(...totals, 1);
  const bars = items.map((it, idx) => {
    const d = it.data;
    const total = totals[idx];
    const barH = (total / max) * 120;
    const seg = (v: number, cls: string) => `<div class="stack-seg ${cls}" style="height:${total > 0 ? (v / total) * barH : 0}px"></div>`;
    return `<div class="hc-col"><div class="stack-bar">${seg(d.totalInputTokens, 'seg-input')}${seg(d.totalCacheReadTokens, 'seg-cache-read')}${hasCacheCreation ? seg(d.totalCacheCreationTokens, 'seg-cache-creation') : ''}${seg(d.totalOutputTokens, 'seg-output')}</div><div class="hc-xlabel">${esc(it.label)}</div></div>`;
  }).join('');
  const legendItems = [
    '<span class="legend-item"><span class="legend-dot seg-input"></span>Input</span>',
    '<span class="legend-item"><span class="legend-dot seg-cache-read"></span>Cache Read</span>',
  ];
  if (hasCacheCreation) legendItems.push('<span class="legend-item"><span class="legend-dot seg-cache-creation"></span>Cache Write</span>');
  legendItems.push('<span class="legend-item"><span class="legend-dot seg-output"></span>Output</span>');
  return `<div class="composition-chart"><h4>Token Composition</h4>
    <div class="stack-legend">${legendItems.join('')}</div>
    <div class="hc-wrap"><div class="hc-yaxis"><span>${fmt(max)}</span><span>${fmt(Math.round(max / 2))}</span><span>0</span></div><div class="hc-main"><div class="hc-bars">${bars}</div></div></div></div>`;
}

function renderDailyTableGrouped(dailyUsages: DailyUsage[]): string {
  if (dailyUsages.length === 0) return '';
  const hasCacheCreation = dailyUsages.some(d => d.data.totalCacheCreationTokens > 0);

  const groups = new Map<string, DailyUsage[]>();
  for (const d of dailyUsages) {
    const month = d.date.substring(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(d);
  }

  const sortedMonths = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  let allRows = '';
  for (const [month, days] of sortedMonths) {
    let mCost = 0, mInput = 0, mOutput = 0, mCacheC = 0, mCacheR = 0, mMsgs = 0;
    for (const d of days) {
      mCost += d.data.totalCost;
      mInput += d.data.totalInputTokens;
      mOutput += d.data.totalOutputTokens;
      mCacheC += d.data.totalCacheCreationTokens;
      mCacheR += d.data.totalCacheReadTokens;
      mMsgs += d.data.messageCount;
    }
    const mCells = `<td>${month}</td><td class="cost-cell">${fmtCost(mCost)}</td><td>${fmt(mInput)}</td><td>${fmt(mOutput)}</td>` + (hasCacheCreation ? `<td>${fmt(mCacheC)}</td>` : '') + `<td>${fmt(mCacheR)}</td><td>${fmt(mMsgs)}</td>`;
    allRows += `<tr class="month-row" onclick="this.classList.toggle('open');var n=this.nextElementSibling;while(n&&n.classList.contains('day-row')){n.style.display=n.style.display==='none'?'':'none';n=n.nextElementSibling}"><td class="month-arrow">▶</td>${mCells}</tr>`;

    const sortedDays = [...days].sort((a, b) => b.date.localeCompare(a.date));
    for (const d of sortedDays) {
      const s = d.data;
      const dCells = `<td>${d.date}</td><td class="cost-cell">${fmtCost(s.totalCost)}</td><td>${fmt(s.totalInputTokens)}</td><td>${fmt(s.totalOutputTokens)}</td>` + (hasCacheCreation ? `<td>${fmt(s.totalCacheCreationTokens)}</td>` : '') + `<td>${fmt(s.totalCacheReadTokens)}</td><td>${fmt(s.messageCount)}</td>`;
      allRows += `<tr class="day-row" style="display:none"><td></td>${dCells}</tr>`;
    }
  }

  const headerCells = '<th></th><th>Date</th><th>Cost</th><th>Input</th><th>Output</th>' + (hasCacheCreation ? '<th>Cache Write</th>' : '') + '<th>Cache Read</th><th>Msgs</th>';
  return `<div class="daily-table-container"><table class="daily-table"><thead><tr>${headerCells}</tr></thead><tbody>${allRows}</tbody></table></div>`;
}

function renderDailyTable(dailyUsages: DailyUsage[]): string {
  if (dailyUsages.length === 0) return '';
  const hasCacheCreation = dailyUsages.some(d => d.data.totalCacheCreationTokens > 0);
  const headerCells = '<th>Date</th><th>Cost</th><th>Input</th><th>Output</th>' + (hasCacheCreation ? '<th>Cache Write</th>' : '') + '<th>Cache Read</th><th>Msgs</th>';
  const rows = dailyUsages.map(d => {
    const s = d.data;
    const cells = `<td>${d.date}</td><td class="cost-cell">${fmtCost(s.totalCost)}</td><td>${fmt(s.totalInputTokens)}</td><td>${fmt(s.totalOutputTokens)}</td>` + (hasCacheCreation ? `<td>${fmt(s.totalCacheCreationTokens)}</td>` : '') + `<td>${fmt(s.totalCacheReadTokens)}</td><td>${fmt(s.messageCount)}</td>`;
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<div class="daily-table-container"><table class="daily-table"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSessionTable(sessions: SessionUsage[]): string {
  if (sessions.length === 0) return '<div class="no-data"><p>No session data</p></div>';
  const rows = sessions.map(s => {
    const d = s.data;
    const dur = s.endTime.getTime() - s.startTime.getTime();
    const durStr = dur < 60000 ? '<1m' : dur < 3600000 ? Math.round(dur / 60000) + 'm' : Math.floor(dur / 3600000) + 'h ' + Math.round((dur % 3600000) / 60000) + 'm';
    return `<tr><td>${fmtDate(s.startTime)}</td><td title="${esc(s.sessionId)}">${esc(s.sessionId.substring(0, 8))}...</td><td>${esc(s.projectName)}</td><td class="cost-cell">${fmtCost(d.totalCost)}</td><td>${fmt(d.totalInputTokens)}</td><td>${fmt(d.totalOutputTokens)}</td><td>${fmt(d.messageCount)}</td><td>${durStr}</td></tr>`;
  }).join('');
  return `<div class="daily-table-container"><table class="daily-table"><thead><tr><th>Time</th><th>Session</th><th>Project</th><th>Cost</th><th>Input</th><th>Output</th><th>Msgs</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderProjectTable(projects: ProjectUsage[]): string {
  if (projects.length === 0) return '<div class="no-data"><p>No project data</p></div>';
  const rows = projects.map(p => {
    const d = p.data;
    return `<tr><td>${esc(p.projectName)}</td><td>${p.sessionCount}</td><td class="cost-cell">${fmtCost(d.totalCost)}</td><td>${fmt(d.totalInputTokens)}</td><td>${fmt(d.totalOutputTokens)}</td><td>${fmt(d.messageCount)}</td><td>${fmtDate(p.lastSeen)}</td></tr>`;
  }).join('');
  return `<div class="daily-table-container"><table class="daily-table"><thead><tr><th>Project</th><th>Sessions</th><th>Cost</th><th>Input</th><th>Output</th><th>Msgs</th><th>Last Active</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function getWebviewContent(data: {
  dailyUsages: DailyUsage[];
  hourlyUsages: HourlyUsage[];
  sessions: SessionUsage[];
  projects: ProjectUsage[];
  monthSummary: UsageSummary;
  allTimeSummary: UsageSummary;
  budgetStatuses: BudgetStatus[];
  initialTab?: string;
}): string {
  const { dailyUsages, hourlyUsages, sessions, projects, monthSummary, allTimeSummary, budgetStatuses, initialTab } = data;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayData = dailyUsages.find(d => d.date === todayStr)?.data;
  const activeTab = initialTab || 'today';

  const tab = (id: string, label: string) => `<button class="tab ${activeTab === id ? 'active' : ''}" onclick="showTab('${id}')">${label}</button>`;
  const tabContent = (id: string, content: string) => `<div id="${id}" class="tab-content ${activeTab === id ? 'active' : ''}">${content}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px 32px;font-size:13px;line-height:1.6;letter-spacing:0.01em}
.container{max-width:1200px;margin:0 auto}

/* Header */
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
header h1{font-size:16px;font-weight:500;opacity:0.9;letter-spacing:0.05em}
.actions{display:flex;gap:8px;align-items:center}
.btn-secondary{background:none;color:var(--vscode-foreground);border:1px solid var(--vscode-panel-border);padding:5px 14px;border-radius:4px;cursor:pointer;font-size:12px;opacity:0.7;transition:opacity 0.15s ease}
.btn-secondary:hover{opacity:1}

/* Tabs */
.tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:1px solid var(--vscode-panel-border)}
.tab{background:none;border:none;color:var(--vscode-foreground);padding:10px 20px;cursor:pointer;font-size:13px;font-weight:400;opacity:0.5;border-bottom:2px solid transparent;transition:all 0.15s ease;margin-bottom:-1px}
.tab:hover{opacity:0.8}
.tab.active{opacity:1;border-bottom-color:var(--vscode-foreground)}
.tab-content{display:none}.tab-content.active{display:block}

/* Summary Cards */
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--vscode-panel-border);border:1px solid var(--vscode-panel-border);margin-bottom:32px}
.summary-item{background:var(--vscode-editor-background);padding:16px 18px}
.summary-item .label{font-size:11px;opacity:0.5;margin-bottom:8px;letter-spacing:0.03em}
.summary-item .value{font-size:20px;font-weight:600}
.summary-item .value.cost{color:var(--vscode-textLink-foreground)}
.summary-item .value.exceeded{color:#ef4444}

/* Cost Composition */
.cost-composition{margin-bottom:32px}
.cost-comp-head{font-size:12px;font-weight:500;margin-bottom:12px;opacity:0.7;letter-spacing:0.03em}
.cost-comp-bar{display:flex;height:6px;overflow:hidden;margin-bottom:12px}
.cost-comp-seg{height:100%}
.seg-input{background:var(--vscode-textLink-foreground)}.seg-output{background:#8b5cf6}.seg-cache-creation{background:#f59e0b}.seg-cache-read{background:#22c55e}
.cost-comp-legend{display:flex;flex-wrap:wrap;gap:16px;font-size:11px;opacity:0.7}
.legend-item{display:flex;align-items:center;gap:6px}
.legend-dot{width:6px;height:6px;border-radius:50%;display:inline-block}

/* Model Breakdown */
.model-breakdown{margin-bottom:32px}
.model-breakdown h3{font-size:13px;font-weight:500;margin-bottom:12px;opacity:0.7;letter-spacing:0.03em}
.model-list{display:flex;flex-direction:column;gap:1px;background:var(--vscode-panel-border);border:1px solid var(--vscode-panel-border)}
.model-item{background:var(--vscode-editor-background)}
.model-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer;font-weight:400}
.model-name{font-size:12px;font-family:monospace;opacity:0.8}
.model-cost{font-weight:600;font-size:13px}
.model-details{padding:12px 16px;font-size:11px;display:flex;flex-wrap:wrap;gap:16px;opacity:0.6;border-top:1px solid var(--vscode-panel-border)}

/* Charts */
.hc-wrap{display:flex;gap:12px;margin:16px 0;height:160px}
.hc-yaxis{display:flex;flex-direction:column;justify-content:space-between;font-size:10px;opacity:0.4;text-align:right;min-width:50px;padding:4px 0}
.hc-main{flex:1;overflow-x:auto}
.hc-bars{display:flex;align-items:flex-end;gap:3px;height:140px;padding-top:4px}
.hc-col{display:flex;flex-direction:column;align-items:center;flex:1;min-width:20px}
.hc-bar{background:var(--vscode-textLink-foreground);border-radius:1px 1px 0 0;width:100%;min-height:2px;opacity:0.8;transition:opacity 0.15s ease}
.hc-bar:hover{opacity:1}
.hc-xlabel{font-size:9px;opacity:0.4;margin-top:6px;white-space:nowrap}
.stack-bar{display:flex;flex-direction:column;align-items:center;width:100%}
.stack-seg{width:100%;min-height:0}
.composition-chart{margin:20px 0}
.composition-chart h4{font-size:12px;font-weight:500;margin-bottom:10px;opacity:0.7;letter-spacing:0.03em}
.stack-legend{display:flex;gap:16px;font-size:11px;margin-bottom:10px;opacity:0.7}

/* Tables */
.daily-table-container{overflow-x:auto;margin:16px 0}
.daily-table{width:100%;border-collapse:collapse;font-size:12px}
.daily-table th{text-align:left;padding:10px 12px;font-weight:500;font-size:11px;opacity:0.5;border-bottom:1px solid var(--vscode-panel-border);letter-spacing:0.03em}
.daily-table td{padding:10px 12px;border-bottom:1px solid var(--vscode-panel-border)}
.daily-table .cost-cell{font-weight:600}
.daily-table tbody tr{transition:background 0.1s ease}
.daily-table tbody tr:hover{background:var(--vscode-list-hoverBackground)}

/* Month Group Rows */
.month-row{cursor:pointer;font-weight:500;background:var(--vscode-editor-inactiveSelectionBackground)}
.month-row:hover{background:var(--vscode-list-hoverBackground)}
.month-arrow{width:20px;text-align:center;font-size:10px;transition:transform 0.15s ease;user-select:none;opacity:0.5}
.month-row.open .month-arrow{transform:rotate(90deg)}
.day-row{opacity:0.7}
.day-row td:first-child{padding-left:28px}

/* Section Headers */
.daily-breakdown{margin-top:32px}
.daily-breakdown h3{font-size:13px;font-weight:500;margin-bottom:12px;opacity:0.7;letter-spacing:0.03em;padding-bottom:8px;border-bottom:1px solid var(--vscode-panel-border)}

/* Empty State */
.no-data{text-align:center;padding:48px;opacity:0.4;font-size:13px}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Claude Budget Monitor</h1>
    <div class="actions">
      <button class="btn-secondary" onclick="refresh()">↻ Refresh</button>
    </div>
  </header>

  <div class="tabs">
    ${tab('today', 'Today')}
    ${tab('month', 'This Month')}
    ${tab('all', 'All Time')}
    ${tab('sessions', 'Sessions')}
    ${tab('projects', 'Projects')}
  </div>

  ${tabContent('today',
    (todayData ? renderSummaryGrid(todayData) + renderCostComposition(todayData) + renderModelBreakdown(todayData) : '<div class="no-data"><p>No data for today</p></div>')
    + (hourlyUsages.length > 0 ? '<div class="daily-breakdown"><h3>Hourly Breakdown</h3>' + renderBarChart(hourlyUsages.map(h => ({ label: h.hour, value: h.data.totalCost }))) + renderCompositionChart(hourlyUsages.map(h => ({ label: h.hour, data: h.data }))) + '</div>' : '')
    + (() => {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 86400000;
        const todaySessions = sessions.filter(s => {
          const t = s.startTime instanceof Date ? s.startTime.getTime() : new Date(s.startTime).getTime();
          return t >= todayStart && t < todayEnd;
        }).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        return todaySessions.length > 0
          ? '<div class="daily-breakdown"><h3>Today\'s Sessions (' + todaySessions.length + ')</h3>' + renderSessionTable(todaySessions) + '</div>'
          : '<div class="daily-breakdown"><h3>Today\'s Sessions</h3><div class="no-data"><p>No sessions found for today</p></div></div>';
      })()
  )}

  ${tabContent('month',
    renderSummaryGrid(monthSummary) + renderCostComposition(monthSummary) + renderModelBreakdown(monthSummary)
    + (() => { const m = dailyUsages.filter(d => d.date.startsWith(todayStr.substring(0, 7))); const asc = [...m].sort((a, b) => a.date.localeCompare(b.date)); const desc = [...m].sort((a, b) => b.date.localeCompare(a.date)); return m.length > 0 ? '<div class="daily-breakdown"><h3>Daily Breakdown</h3>' + renderBarChart(asc.map(d => ({ label: d.date.substring(5), value: d.data.totalCost }))) + renderCompositionChart(asc.map(d => ({ label: d.date.substring(5), data: d.data }))) + renderDailyTable(desc) + '</div>' : ''; })()
  )}

  ${tabContent('all',
    renderSummaryGrid(allTimeSummary) + renderCostComposition(allTimeSummary) + renderModelBreakdown(allTimeSummary)
    + (() => { const asc = [...dailyUsages].sort((a, b) => a.date.localeCompare(b.date)); return asc.length > 0 ? '<div class="daily-breakdown"><h3>Daily Breakdown</h3>' + renderBarChart(asc.map(d => ({ label: d.date.substring(5), value: d.data.totalCost }))) + renderCompositionChart(asc.map(d => ({ label: d.date.substring(5), data: d.data }))) + renderDailyTableGrouped(asc) + '</div>' : ''; })()
  )}

  ${tabContent('sessions', '<div class="daily-breakdown"><h3>Session Breakdown</h3>' + renderSessionTable([...sessions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime())) + '</div>')}

  ${tabContent('projects', '<div class="daily-breakdown"><h3>Project Breakdown</h3>' + renderProjectTable(projects) + '</div>')}
</div>
<script>
var vscode;
try{vscode=acquireVsCodeApi()}catch(e){}
function showTab(t){
  document.querySelectorAll('.tab-content').forEach(function(e){e.classList.remove('active')});
  document.querySelectorAll('.tab').forEach(function(e){e.classList.remove('active')});
  document.getElementById(t).classList.add('active');
  document.querySelectorAll('.tab').forEach(function(e){if(e.getAttribute('onclick')==="showTab('"+t+"')") e.classList.add('active')});
}
function refresh(){
  var overlay=document.getElementById('loading-overlay');
  if(vscode){
    if(overlay) overlay.style.display='flex';
    vscode.postMessage({command:'refresh'});
    setTimeout(function(){if(overlay) overlay.style.display='none';},5000);
  } else {
    location.reload();
  }
}
</script>
<div id="loading-overlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;justify-content:center;align-items:center">
  <div style="background:var(--vscode-editor-background);padding:24px;border-radius:8px;text-align:center">
    <div style="margin-bottom:12px"><span style="display:inline-block;width:24px;height:24px;border:3px solid var(--vscode-foreground);border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></span></div>
    <div>Refreshing...</div>
  </div>
</div>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
</body>
</html>`;
}
