import { TokenUsage, CostBreakdown, ModelPricing } from './types';

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-20250514': { inputPricePerMToken: 15, outputPricePerMToken: 75, cacheCreationPricePerMToken: 18.75, cacheReadPricePerMToken: 1.5 },
  'claude-opus-4-20250701': { inputPricePerMToken: 15, outputPricePerMToken: 75, cacheCreationPricePerMToken: 18.75, cacheReadPricePerMToken: 1.5 },
  'claude-sonnet-4-20250514': { inputPricePerMToken: 3, outputPricePerMToken: 15, cacheCreationPricePerMToken: 3.75, cacheReadPricePerMToken: 0.3 },
  'claude-sonnet-4-20250701': { inputPricePerMToken: 3, outputPricePerMToken: 15, cacheCreationPricePerMToken: 3.75, cacheReadPricePerMToken: 0.3 },
  'claude-haiku-3-5-20241022': { inputPricePerMToken: 0.8, outputPricePerMToken: 4, cacheCreationPricePerMToken: 1, cacheReadPricePerMToken: 0.08 },
  'mimo-v2.5-pro': { inputPricePerMToken: 2, outputPricePerMToken: 10, cacheCreationPricePerMToken: 2.5, cacheReadPricePerMToken: 0.2 },
};

const DEFAULT_PRICING: ModelPricing = MODEL_PRICING['claude-sonnet-4-20250514'];

function detectModelFamily(model: string): ModelPricing {
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return MODEL_PRICING['claude-opus-4-20250514'];
  if (lower.includes('haiku')) return MODEL_PRICING['claude-haiku-3-5-20241022'];
  if (lower.includes('mimo')) return MODEL_PRICING['mimo-v2.5-pro'];
  return DEFAULT_PRICING;
}

export function getPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] || detectModelFamily(model);
}

export function calculateCost(usage: TokenUsage): CostBreakdown {
  const pricing = getPricing(usage.model);
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPricePerMToken;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPricePerMToken;
  const cacheCreationCost = (usage.cacheCreationTokens / 1_000_000) * pricing.cacheCreationPricePerMToken;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPricePerMToken;
  return {
    inputCost,
    outputCost,
    cacheCreationCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheCreationCost + cacheReadCost,
    model: usage.model
  };
}

export function getCostForTokenUsages(usages: TokenUsage[]): number {
  return usages.reduce((sum, u) => sum + calculateCost(u).totalCost, 0);
}
