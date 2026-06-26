import * as vscode from 'vscode';
import { BudgetStatus } from './types';

let statusBarItem: vscode.StatusBarItem;

export function createStatusBar(): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'claudeBudget.openDashboard';
  statusBarItem.show();
  return statusBarItem;
}

export function updateStatusBar(params: {
  todayCost: number;
  budgetStatuses: BudgetStatus[];
  quota5h?: number;
  quotaWeekly?: number;
}) {
  const { todayCost, budgetStatuses, quota5h, quotaWeekly } = params;

  const parts: string[] = [];

  parts.push(`$(money) $${todayCost.toFixed(2)}`);

  const exceeded = budgetStatuses.find(b => b.isExceeded);
  const critical = budgetStatuses.find(b => b.alertLevel === 'critical' && !b.isExceeded);
  const warning = budgetStatuses.find(b => b.alertLevel === 'warning');
  const caution = budgetStatuses.find(b => b.alertLevel === 'caution');

  if (exceeded) {
    parts.push(`$(alert) ${exceeded.period} EXCEEDED`);
  } else if (critical) {
    parts.push(`$(alert) ${critical.period} ${critical.percentage.toFixed(0)}%`);
  } else if (warning) {
    parts.push(`$(warning) ${warning.period} ${warning.percentage.toFixed(0)}%`);
  } else if (caution) {
    parts.push(`$(circle-outline) ${caution.period} ${caution.percentage.toFixed(0)}%`);
  }

  if (quota5h !== undefined) parts.push(`5h:${quota5h.toFixed(0)}%`);
  if (quotaWeekly !== undefined) parts.push(`wk:${quotaWeekly.toFixed(0)}%`);

  statusBarItem.text = parts.join(' | ');

  const tooltip = new vscode.MarkdownString();
  tooltip.appendMarkdown(`**Today's Cost:** $${todayCost.toFixed(4)}\n\n`);

  for (const bs of budgetStatuses) {
    if (bs.limit > 0) {
      const icons: Record<string, string> = { normal: '🟢', caution: '🟡', warning: '🟠', critical: '🔴' };
      const icon = bs.isExceeded ? '🔴' : (icons[bs.alertLevel] || '🟢');
      tooltip.appendMarkdown(`${icon} **${bs.period}:** $${bs.spent.toFixed(2)} / $${bs.limit.toFixed(2)} (${bs.percentage.toFixed(1)}%)\n\n`);
    }
  }
  statusBarItem.tooltip = tooltip;

  if (exceeded || critical) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (warning) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.backgroundColor = undefined;
  }
}

export function disposeStatusBar() {
  statusBarItem?.dispose();
}
