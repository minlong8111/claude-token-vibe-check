import * as vscode from 'vscode';
import { getWebviewContent } from './webview';
import { UsageSummary, DailyUsage, HourlyUsage, SessionUsage, ProjectUsage, BudgetStatus } from '../types';

let panel: vscode.WebviewPanel | undefined;
let refreshFn: (() => any) | undefined;

interface DashboardData {
  dailyUsages: DailyUsage[];
  hourlyUsages: HourlyUsage[];
  sessions: SessionUsage[];
  projects: ProjectUsage[];
  monthSummary: UsageSummary;
  allTimeSummary: UsageSummary;
  budgetStatuses: BudgetStatus[];
  initialTab?: string;
}

export function openDashboard(data: DashboardData, onRefresh?: () => any) {
  if (onRefresh) refreshFn = onRefresh;

  if (panel) {
    panel.webview.html = getWebviewContent(data);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'claudeBudgetDashboard',
    'Claude Budget Monitor',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = getWebviewContent(data);

  panel.webview.onDidReceiveMessage(message => {
    if (message.command === 'refresh' && refreshFn) {
      try {
        const newData = refreshFn();
        if (newData && panel) {
          panel.webview.html = getWebviewContent(newData);
        }
      } catch (err) {
        console.error('Dashboard refresh error:', err);
      }
    }
  });

  panel.onDidDispose(() => { panel = undefined; });
}

export function updateDashboard(data: DashboardData) {
  if (panel) {
    panel.webview.html = getWebviewContent(data);
  }
}
