import * as vscode from 'vscode';
import { readJsonlFiles, getDefaultDataDir } from './logParser';
import { calculateCost } from './costCalculator';
import { createStatusBar, updateStatusBar, disposeStatusBar } from './statusBar';
import { checkBudgets, checkProjectBudgets, getBudgetStatuses, getProjectBudgetStatuses, showBudgetAlerts, resetNotifications, setPauseUntilMs, setPauseUntilEndOfDay } from './budgetManager';
import { getConfig } from './config';
import { openDashboard, updateDashboard } from './dashboard/main';
import { TokenUsage, UsageSummary, DailyUsage, HourlyUsage, SessionUsage, ProjectUsage } from './types';

let refreshTimer: ReturnType<typeof setInterval> | undefined;

export function activate(context: vscode.ExtensionContext) {
  try {
    const statusBar = createStatusBar();
    context.subscriptions.push(statusBar);

    context.subscriptions.push(
      vscode.commands.registerCommand('claudeBudget.openDashboard', () => {
        try {
          const data = computeAllData();
          const { allStatuses } = computeBudgetInfo(data);
          openDashboard({ ...data, budgetStatuses: allStatuses }, () => {
            const d = computeAllData();
            const b = computeBudgetInfo(d);
            return { ...d, budgetStatuses: b.allStatuses };
          });
        } catch (err) {
          console.error('openDashboard error:', err);
          vscode.window.showErrorMessage('Dashboard error: ' + err);
        }
      }),
      vscode.commands.registerCommand('claudeBudget.setDailyBudget', async () => {
        const val = await vscode.window.showInputBox({ prompt: 'Daily budget (USD)', validateInput: v => isNaN(Number(v)) ? 'Must be a number' : undefined });
        if (val !== undefined) vscode.workspace.getConfiguration('claudeBudget').update('dailyBudget', Number(val), vscode.ConfigurationTarget.Global);
      }),
      vscode.commands.registerCommand('claudeBudget.setWeeklyBudget', async () => {
        const val = await vscode.window.showInputBox({ prompt: 'Weekly budget (USD)', validateInput: v => isNaN(Number(v)) ? 'Must be a number' : undefined });
        if (val !== undefined) vscode.workspace.getConfiguration('claudeBudget').update('weeklyBudget', Number(val), vscode.ConfigurationTarget.Global);
      }),
      vscode.commands.registerCommand('claudeBudget.setMonthlyBudget', async () => {
        const val = await vscode.window.showInputBox({ prompt: 'Monthly budget (USD)', validateInput: v => isNaN(Number(v)) ? 'Must be a number' : undefined });
        if (val !== undefined) vscode.workspace.getConfiguration('claudeBudget').update('monthlyBudget', Number(val), vscode.ConfigurationTarget.Global);
      }),
      vscode.commands.registerCommand('claudeBudget.setProjectBudget', async () => {
        const data = computeAllData();
        const projectNames = data.projects.map(p => p.projectName);
        if (projectNames.length === 0) {
          vscode.window.showInformationMessage('No projects found');
          return;
        }
        const project = await vscode.window.showQuickPick(projectNames, { placeHolder: 'Select project' });
        if (!project) return;
        const val = await vscode.window.showInputBox({ prompt: `Budget for "${project}" (USD)`, validateInput: v => isNaN(Number(v)) ? 'Must be a number' : undefined });
        if (val !== undefined) {
          const budgets = getConfig().projectBudgets;
          budgets[project] = Number(val);
          vscode.workspace.getConfiguration('claudeBudget').update('projectBudgets', budgets, vscode.ConfigurationTarget.Global);
        }
      }),
      vscode.commands.registerCommand('claudeBudget.pauseAlerts', async () => {
        const duration = await vscode.window.showQuickPick(
          [
            { label: '1 hour', ms: 1 * 3600000 },
            { label: '4 hours', ms: 4 * 3600000 },
            { label: 'Until end of day', ms: -1 },
          ],
          { placeHolder: 'Pause budget alerts for...' }
        );
        if (duration) {
          if (duration.ms === -1) {
            setPauseUntilEndOfDay();
          } else {
            setPauseUntilMs(duration.ms);
          }
          vscode.window.showInformationMessage(`Budget alerts paused for ${duration.label}`);
        }
      }),
      vscode.commands.registerCommand('claudeBudget.resetBudget', async () => {
        const confirm = await vscode.window.showWarningMessage('Reset all budget settings?', 'Yes', 'No');
        if (confirm === 'Yes') {
          const cfg = vscode.workspace.getConfiguration('claudeBudget');
          await cfg.update('dailyBudget', 0, vscode.ConfigurationTarget.Global);
          await cfg.update('weeklyBudget', 0, vscode.ConfigurationTarget.Global);
          await cfg.update('monthlyBudget', 0, vscode.ConfigurationTarget.Global);
          await cfg.update('projectBudgets', {}, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage('Budget settings reset');
        }
      }),
      vscode.commands.registerCommand('claudeBudget.budgetReport', () => {
        const data = computeAllData();
        const { allStatuses } = computeBudgetInfo(data);
        openDashboard({ ...data, budgetStatuses: allStatuses }, () => {
          const d = computeAllData();
          const b = computeBudgetInfo(d);
          return { ...d, budgetStatuses: b.allStatuses };
        });
      })
    );

    refresh();
    const config = getConfig();
    refreshTimer = setInterval(refresh, config.refreshInterval * 1000);
    context.subscriptions.push({ dispose() { if (refreshTimer) clearInterval(refreshTimer); } });
  } catch (err) {
    console.error('Claude Budget Monitor activation error:', err);
  }
}

function computeBudgetInfo(data: ReturnType<typeof computeAllData>) {
  const config = getConfig();
  const todayStr = formatDate(new Date());
  const todayData = data.dailyUsages.find(d => d.date === todayStr);
  const todayCost = todayData?.data.totalCost || 0;

  const weekStart = getWeekStart(new Date());
  const weekCost = data.dailyUsages.filter(d => d.date >= weekStart).reduce((s, d) => s + d.data.totalCost, 0);

  const monthStart = todayStr.substring(0, 7);
  const monthCost = data.dailyUsages.filter(d => d.date.startsWith(monthStart)).reduce((s, d) => s + d.data.totalCost, 0);

  const budgetConfig = {
    daily: config.dailyBudget,
    weekly: config.weeklyBudget,
    monthly: config.monthlyBudget,
    alertThreshold: config.alertThreshold,
    projectBudgets: config.projectBudgets
  };

  const budgetStatuses = getBudgetStatuses(todayCost, weekCost, monthCost, budgetConfig);
  const projectStatuses = getProjectBudgetStatuses(
    data.projects.map(p => ({ name: p.projectName, cost: p.data.totalCost })),
    config.projectBudgets,
    config.alertThreshold
  );
  const allStatuses = [...budgetStatuses, ...projectStatuses];

  return { todayStr, todayCost, budgetConfig, allStatuses };
}

function refresh() {
  try {
    resetNotifications();
    const data = computeAllData();
    const { todayStr, todayCost, budgetConfig, allStatuses } = computeBudgetInfo(data);

    const alerts = [
      ...checkBudgets(todayCost, budgetConfig, 'daily'),
      ...checkBudgets(
        data.dailyUsages.filter(d => d.date >= getWeekStart(new Date())).reduce((s, d) => s + d.data.totalCost, 0),
        budgetConfig, 'weekly'),
      ...checkBudgets(
        data.dailyUsages.filter(d => d.date.startsWith(todayStr.substring(0, 7))).reduce((s, d) => s + d.data.totalCost, 0),
        budgetConfig, 'monthly'),
      ...checkProjectBudgets(
        data.projects.map(p => ({ name: p.projectName, cost: p.data.totalCost })),
        budgetConfig.projectBudgets),
    ];
    showBudgetAlerts(alerts).catch(err => console.error('Budget alert error:', err));

    updateStatusBar({ todayCost, budgetStatuses: allStatuses });
    updateDashboard({ ...data, budgetStatuses: allStatuses });
  } catch (err) {
    console.error('Claude Budget Monitor refresh error:', err);
  }
}

function buildSummary(usages: TokenUsage[]): UsageSummary {
  let totalCost = 0, totalInput = 0, totalOutput = 0, totalCacheC = 0, totalCacheR = 0;
  let costInput = 0, costOutput = 0, costCacheW = 0, costCacheR = 0;
  const modelBreakdown: UsageSummary['modelBreakdown'] = {};

  for (const u of usages) {
    const cb = calculateCost(u);
    totalCost += cb.totalCost;
    totalInput += u.inputTokens;
    totalOutput += u.outputTokens;
    totalCacheC += u.cacheCreationTokens;
    totalCacheR += u.cacheReadTokens;
    costInput += cb.inputCost;
    costOutput += cb.outputCost;
    costCacheW += cb.cacheCreationCost;
    costCacheR += cb.cacheReadCost;

    if (!modelBreakdown[u.model]) {
      modelBreakdown[u.model] = { cost: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, count: 0 };
    }
    const mb = modelBreakdown[u.model];
    mb.cost += cb.totalCost;
    mb.inputTokens += u.inputTokens;
    mb.outputTokens += u.outputTokens;
    mb.cacheCreationTokens += u.cacheCreationTokens;
    mb.cacheReadTokens += u.cacheReadTokens;
    mb.count++;
  }

  return {
    totalCost, totalInputTokens: totalInput, totalOutputTokens: totalOutput,
    totalCacheCreationTokens: totalCacheC, totalCacheReadTokens: totalCacheR,
    messageCount: usages.length,
    costBreakdown: { input: costInput, output: costOutput, cacheWrite: costCacheW, cacheRead: costCacheR },
    modelBreakdown
  };
}

function aggregateSummaries(summaries: UsageSummary[]): UsageSummary {
  if (summaries.length === 0) {
    return {
      totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0,
      totalCacheCreationTokens: 0, totalCacheReadTokens: 0,
      messageCount: 0,
      costBreakdown: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      modelBreakdown: {}
    };
  }
  const result: UsageSummary = {
    totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0,
    totalCacheCreationTokens: 0, totalCacheReadTokens: 0,
    messageCount: 0,
    costBreakdown: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    modelBreakdown: {}
  };
  for (const s of summaries) {
    result.totalCost += s.totalCost;
    result.totalInputTokens += s.totalInputTokens;
    result.totalOutputTokens += s.totalOutputTokens;
    result.totalCacheCreationTokens += s.totalCacheCreationTokens;
    result.totalCacheReadTokens += s.totalCacheReadTokens;
    result.messageCount += s.messageCount;
    result.costBreakdown.input += s.costBreakdown.input;
    result.costBreakdown.output += s.costBreakdown.output;
    result.costBreakdown.cacheWrite += s.costBreakdown.cacheWrite;
    result.costBreakdown.cacheRead += s.costBreakdown.cacheRead;
    for (const [model, m] of Object.entries(s.modelBreakdown)) {
      if (!result.modelBreakdown[model]) {
        result.modelBreakdown[model] = { cost: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, count: 0 };
      }
      const mb = result.modelBreakdown[model];
      mb.cost += m.cost;
      mb.inputTokens += m.inputTokens;
      mb.outputTokens += m.outputTokens;
      mb.cacheCreationTokens += m.cacheCreationTokens;
      mb.cacheReadTokens += m.cacheReadTokens;
      mb.count += m.count;
    }
  }
  return result;
}

function computeAllData() {
  const config = getConfig();
  const dataDir = config.dataDirectory || getDefaultDataDir();
  const allUsages = readJsonlFiles(dataDir);

  const byDate = new Map<string, TokenUsage[]>();
  const byHour = new Map<string, TokenUsage[]>();
  const bySession = new Map<string, TokenUsage[]>();
  const byProject = new Map<string, TokenUsage[]>();
  const todayStr = formatDate(new Date());

  for (const u of allUsages) {
    const d = new Date(u.timestamp);
    const date = formatDate(d);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(u);

    if (date === todayStr) {
      const hour = String(d.getHours()).padStart(2, '0') + ':00';
      if (!byHour.has(hour)) byHour.set(hour, []);
      byHour.get(hour)!.push(u);
    }

    if (!bySession.has(u.sessionId)) bySession.set(u.sessionId, []);
    bySession.get(u.sessionId)!.push(u);

    if (!byProject.has(u.projectName)) byProject.set(u.projectName, []);
    byProject.get(u.projectName)!.push(u);
  }

  const dailyUsages: DailyUsage[] = Array.from(byDate.entries())
    .map(([date, usages]) => ({ date, data: buildSummary(usages) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourlyUsages: HourlyUsage[] = Array.from(byHour.entries())
    .map(([hour, usages]) => ({ hour, data: buildSummary(usages) }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const sessions: SessionUsage[] = Array.from(bySession.entries())
    .map(([sessionId, usages]) => {
      let minTs = Infinity, maxTs = -Infinity;
      for (const u of usages) {
        if (u.timestamp < minTs) minTs = u.timestamp;
        if (u.timestamp > maxTs) maxTs = u.timestamp;
      }
      return {
        sessionId,
        projectName: usages[0]?.projectName || 'unknown',
        startTime: new Date(minTs),
        endTime: new Date(maxTs),
        data: buildSummary(usages),
        peakContextTokens: 0
      };
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const projects: ProjectUsage[] = Array.from(byProject.entries())
    .map(([projectName, usages]) => {
      let maxTs = -Infinity;
      for (const u of usages) { if (u.timestamp > maxTs) maxTs = u.timestamp; }
      return {
        projectName,
        projectPath: projectName,
        sessionCount: new Set(usages.map(u => u.sessionId)).size,
        lastSeen: new Date(maxTs),
        data: buildSummary(usages)
      };
    })
    .sort((a, b) => b.data.totalCost - a.data.totalCost);

  const monthData = dailyUsages.filter(d => d.date.startsWith(todayStr.substring(0, 7)));
  const monthSummary = aggregateSummaries(monthData.map(d => d.data));
  const allTimeSummary = buildSummary(allUsages);

  return { dailyUsages, hourlyUsages, sessions, projects, monthSummary, allTimeSummary, budgetStatuses: [] };
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return formatDate(monday);
}

export function deactivate() {
  disposeStatusBar();
}
