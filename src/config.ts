import * as vscode from 'vscode';

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration('claudeBudget');
  return {
    refreshInterval: cfg.get<number>('refreshInterval', 60),
    dataDirectory: cfg.get<string>('dataDirectory', ''),
    dailyBudget: cfg.get<number>('dailyBudget', 0),
    weeklyBudget: cfg.get<number>('weeklyBudget', 0),
    monthlyBudget: cfg.get<number>('monthlyBudget', 0),
    alertThreshold: cfg.get<number>('alertThreshold', 80),
    timezone: cfg.get<string>('timezone', ''),
    projectBudgets: cfg.get<Record<string, number>>('projectBudgets', {}),
  };
}

export function getTimezone(): string {
  const tz = getConfig().timezone;
  return tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
