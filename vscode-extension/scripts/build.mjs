import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = dirname(scriptDir);
const workspaceDir = dirname(extensionDir);
const mcpServerDir = join(workspaceDir, 'mcp-server');
const webviewDir = join(workspaceDir, 'webview');
const extensionEntry = join(extensionDir, 'src', 'extension.ts');
const extensionDistDir = join(extensionDir, 'dist');
const packagedServerDir = join(extensionDistDir, 'mcp-server');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const xhrWorkerStub = `'use strict';

// jsdom resolves this file during startup even when synchronous XHR is never
// used. The UI review server does not support that code path, so keep a stub
// in place to satisfy require.resolve and fail fast if it is ever invoked.
throw new Error('Synchronous XMLHttpRequest is not supported in the bundled UI Review MCP server.');
`;

try {
  runNpmScript(mcpServerDir, 'build');
  runNpmScript(webviewDir, 'build');

  await build({
    entryPoints: [extensionEntry],
    outfile: join(extensionDistDir, 'extension.js'),
    bundle: true,
    external: ['vscode', 'jsdom', 'dompurify', '@modelcontextprotocol/sdk'],
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
  });

  await mkdir(packagedServerDir, { recursive: true });
  await copyFile(
    join(mcpServerDir, 'dist', 'standalone.js'),
    join(packagedServerDir, 'standalone.js'),
  );
  await writeFile(join(packagedServerDir, 'xhr-sync-worker.js'), xhrWorkerStub, 'utf8');
} catch (error) {
  console.error(error);
  process.exit(1);
}

function runNpmScript(cwd, scriptName) {
  const result = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, 'run', scriptName], {
        cwd,
        stdio: 'inherit',
      })
    : spawnSync(npmCommand, ['run', scriptName], {
        cwd,
        stdio: 'inherit',
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}