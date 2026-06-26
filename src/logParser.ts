import * as fs from 'fs';
import * as path from 'path';
import { TokenUsage } from './types';

export function parseJsonlLine(line: string, projectName: string): TokenUsage | null {
  try {
    const obj = JSON.parse(line);
    const msg = obj.message || obj;
    const usage = msg.usage || obj.usage;
    const model = msg.model || obj.model;
    if (!usage || !model) return null;
    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheCreationTokens: usage.cache_creation_input_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      model,
      timestamp: new Date(obj.timestamp || Date.now()).getTime(),
      sessionId: obj.sessionId || obj.session_id || 'unknown',
      projectName
    };
  } catch {
    return null;
  }
}

export function parseJsonlContent(content: string, projectName: string): TokenUsage[] {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => parseJsonlLine(line, projectName))
    .filter((u): u is TokenUsage => u !== null);
}

export function readJsonlFiles(dataDir: string): TokenUsage[] {
  const results: TokenUsage[] = [];

  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.jsonl')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const projectName = path.basename(path.dirname(fullPath));
        results.push(...parseJsonlContent(content, projectName));
      }
    }
  }

  walkDir(dataDir);
  return results;
}

export function getDefaultDataDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = [
    path.join(home, '.claude', 'projects'),
    path.join(home, '.config', 'claude', 'projects')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}
