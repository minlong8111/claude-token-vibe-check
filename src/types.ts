export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  timestamp: number;
  sessionId: string;
  projectName: string;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheCreationCost: number;
  cacheReadCost: number;
  totalCost: number;
  model: string;
}

export interface UsageSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  messageCount: number;
  costBreakdown: { input: number; output: number; cacheWrite: number; cacheRead: number };
  modelBreakdown: Record<string, {
    cost: number;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    count: number;
  }>;
}

export interface DailyUsage {
  date: string;
  data: UsageSummary;
}

export interface HourlyUsage {
  hour: string;
  data: UsageSummary;
}

export interface SessionUsage {
  sessionId: string;
  projectName: string;
  startTime: Date;
  endTime: Date;
  data: UsageSummary;
  peakContextTokens: number;
}

export interface ProjectUsage {
  projectName: string;
  projectPath: string;
  sessionCount: number;
  lastSeen: Date;
  data: UsageSummary;
}

export interface BudgetConfig {
  daily: number;
  weekly: number;
  monthly: number;
  alertThreshold: number;
  projectBudgets: Record<string, number>;
}

export interface BudgetStatus {
  period: 'daily' | 'weekly' | 'monthly' | string;
  spent: number;
  limit: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
  alertLevel: 'normal' | 'caution' | 'warning' | 'critical';
}

export interface BudgetAlert {
  period: string;
  level: 'caution' | 'warning' | 'critical' | 'exceeded';
  message: string;
  percentage: number;
  actions: string[];
}

export interface ModelPricing {
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  cacheCreationPricePerMToken: number;
  cacheReadPricePerMToken: number;
}
