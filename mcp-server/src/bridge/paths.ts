import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

export const UI_REVIEW_BRIDGE_SCOPE_ENV = 'UI_REVIEW_BRIDGE_SCOPE';

function normalizeScopeInput(scope: string): string {
  const resolved = resolve(scope);
  const normalized = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  return normalized.replace(/[/\\]+/g, '/');
}

export function getBridgeScope(scope = process.env[UI_REVIEW_BRIDGE_SCOPE_ENV]): string {
  if (!scope || !scope.trim()) {
    return 'global';
  }

  return createHash('sha256').update(normalizeScopeInput(scope)).digest('hex').slice(0, 16);
}

export function getBridgeDirectories(scope?: string): {
  bridgeDir: string;
  pendingDir: string;
  completedDir: string;
} {
  const bridgeDir = join(tmpdir(), 'ui-review-mcp', getBridgeScope(scope));
  return {
    bridgeDir,
    pendingDir: join(bridgeDir, 'pending'),
    completedDir: join(bridgeDir, 'completed'),
  };
}