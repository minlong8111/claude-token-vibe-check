import * as vscode from 'vscode';
import { BudgetConfig, BudgetStatus, BudgetAlert } from './types';

const notifiedWarnings = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
let pauseUntil: number | null = null;

function getAlertLevel(percentage: number, alertThreshold: number): BudgetStatus['alertLevel'] {
  if (percentage >= 95) return 'critical';
  if (percentage >= alertThreshold) return 'warning';
  if (percentage >= alertThreshold * 0.75) return 'caution';
  return 'normal';
}

export function checkBudgets(spent: number, config: BudgetConfig, period: string): BudgetAlert[] {
  const limit = period === 'daily' ? config.daily : period === 'weekly' ? config.weekly : config.monthly;
  if (limit <= 0) return [];
  if (pauseUntil && Date.now() < pauseUntil) return [];

  const percentage = (spent / limit) * 100;
  const alerts: BudgetAlert[] = [];
  const now = Date.now();

  const thresholds = [
    { key: 'exceeded', pct: 100, level: 'exceeded' as const, msg: `${period} budget EXCEEDED!` },
    { key: 'critical', pct: 95, level: 'critical' as const, msg: `${period} budget CRITICAL` },
    { key: 'warning', pct: 80, level: 'warning' as const, msg: `${period} budget warning` },
    { key: 'caution', pct: 60, level: 'caution' as const, msg: `${period} budget caution` },
  ];

  for (const t of thresholds) {
    if (percentage >= t.pct) {
      const lastNotified = notifiedWarnings.get(`${period}-${t.key}`) || 0;
      if (now - lastNotified > ALERT_COOLDOWN_MS || t.key === 'exceeded') {
        if (t.key === 'exceeded' && notifiedWarnings.has(`${period}-exceeded`)) break;
        alerts.push({
          period,
          level: t.level,
          message: `${t.msg} — $${spent.toFixed(2)} / $${limit.toFixed(2)} (${percentage.toFixed(0)}%)`,
          percentage,
          actions: t.key === 'exceeded' ? ['Snooze', 'Increase Budget', 'Pause Alerts'] : ['Dismiss']
        });
        notifiedWarnings.set(`${period}-${t.key}`, now);
      }
      break;
    }
  }

  return alerts;
}

export function getBudgetStatuses(dailySpent: number, weeklySpent: number, monthlySpent: number, config: BudgetConfig): BudgetStatus[] {
  const periods: Array<{ period: string; spent: number; limit: number }> = [
    { period: 'daily', spent: dailySpent, limit: config.daily },
    { period: 'weekly', spent: weeklySpent, limit: config.weekly },
    { period: 'monthly', spent: monthlySpent, limit: config.monthly },
  ];

  return periods.map(({ period, spent, limit }) => {
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      period,
      spent,
      limit,
      percentage,
      isWarning: percentage >= config.alertThreshold && percentage < 100,
      isExceeded: percentage >= 100,
      alertLevel: getAlertLevel(percentage, config.alertThreshold)
    };
  });
}

export function checkProjectBudgets(projects: Array<{ name: string; cost: number }>, projectBudgets: Record<string, number>): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  const now = Date.now();
  if (pauseUntil && now < pauseUntil) return alerts;

  for (const p of projects) {
    const limit = projectBudgets[p.name];
    if (!limit || limit <= 0) continue;
    const percentage = (p.cost / limit) * 100;
    if (percentage < 100) continue;

    const key = `project-${p.name}-exceeded`;
    if (notifiedWarnings.has(key)) continue;

    alerts.push({
      period: p.name,
      level: 'exceeded',
      message: `Project "${p.name}" budget EXCEEDED! — $${p.cost.toFixed(2)} / $${limit.toFixed(2)} (${percentage.toFixed(0)}%)`,
      percentage,
      actions: ['Snooze', 'Increase Budget', 'Pause Alerts']
    });
    notifiedWarnings.set(key, now);
  }
  return alerts;
}

export function getProjectBudgetStatuses(projects: Array<{ name: string; cost: number }>, projectBudgets: Record<string, number>, alertThreshold: number): BudgetStatus[] {
  return projects
    .filter(p => projectBudgets[p.name] && projectBudgets[p.name] > 0)
    .map(p => {
      const limit = projectBudgets[p.name];
      const percentage = (p.cost / limit) * 100;
      return {
        period: p.name,
        spent: p.cost,
        limit,
        percentage,
        isWarning: percentage >= alertThreshold && percentage < 100,
        isExceeded: percentage >= 100,
        alertLevel: getAlertLevel(percentage, alertThreshold)
      };
    });
}

export async function showBudgetAlerts(alerts: BudgetAlert[]) {
  for (const alert of alerts) {
    const items = alert.actions;
    let result: string | undefined;

    if (alert.level === 'exceeded' || alert.level === 'critical') {
      result = await vscode.window.showErrorMessage(alert.message, ...items);
    } else if (alert.level === 'warning') {
      result = await vscode.window.showWarningMessage(alert.message, ...items);
    } else if (alert.level === 'caution') {
      vscode.window.showInformationMessage(alert.message);
      continue;
    }

    if (result === 'Snooze') {
      pauseUntil = Date.now() + 4 * 3600000;
      vscode.window.showInformationMessage('Budget alerts snoozed for 4 hours');
    } else if (result === 'Pause Alerts') {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      pauseUntil = endOfDay.getTime();
      vscode.window.showInformationMessage('Budget alerts paused until end of day');
    } else if (result === 'Increase Budget') {
      vscode.commands.executeCommand('claudeBudget.setDailyBudget');
    }
  }
}

export function resetNotifications() {
  // Only clear expired cooldown entries; never clear 'exceeded' keys
  const now = Date.now();
  for (const [key, timestamp] of notifiedWarnings) {
    if (key.endsWith('-exceeded')) continue; // keep exceeded forever
    if (now - timestamp > ALERT_COOLDOWN_MS) {
      notifiedWarnings.delete(key);
    }
  }
  if (pauseUntil && now > pauseUntil) {
    pauseUntil = null;
  }
}

export function getPauseUntil(): number | null {
  return pauseUntil;
}

export function setPauseUntilMs(ms: number) {
  pauseUntil = Date.now() + ms;
}

export function setPauseUntilEndOfDay() {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  pauseUntil = endOfDay.getTime();
}
