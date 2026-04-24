import * as vscode from 'vscode';
import { watchPendingSessions } from './fileBridge';
import { ReviewPanel } from './reviewPanel';
import {
  ensureBundledServerInstalled,
  registerConfigureWorkspaceCommand,
} from './setupWorkspace';
import type { ReviewSession } from '../../mcp-server/src/types';

export function activate(context: vscode.ExtensionContext): void {
  void ensureBundledServerInstalled(context).catch((error) => {
    console.error('UI Review MCP: failed to refresh bundled MCP server', error);
  });

  const workspacePaths = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);

  // ------------------------------------------------------------------
  // Watch the OS temp bridge directory for pending review sessions.
  // The standalone MCP server (node dist/standalone.js) writes session
  // files there when an agent calls review_generated_ui.
  // ------------------------------------------------------------------
  const watcher = watchPendingSessions(workspacePaths, (session: ReviewSession) => {
    ReviewPanel.create(context.extensionUri, session);
  });

  // ------------------------------------------------------------------
  // Register the manual status command.
  // ------------------------------------------------------------------
  const openPanelCommand = vscode.commands.registerCommand(
    'uiReview.openPanel',
    () => {
      vscode.window.showInformationMessage(
        'UI Review MCP: waiting for an agent to call review_generated_ui…',
      );
    },
  );

  context.subscriptions.push(
    openPanelCommand,
    registerConfigureWorkspaceCommand(context),
    new vscode.Disposable(() => watcher.dispose()),
  );
}

export function deactivate(): void {
  // Watcher is disposed via subscriptions.
}

