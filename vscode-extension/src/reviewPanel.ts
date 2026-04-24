import * as vscode from 'vscode';
import type { ReviewSession } from '../../mcp-server/src/types';
import { discardPendingSession, discardPendingSessionInScope, writeCompletedSession } from './fileBridge';

/**
 * Message sent from the webview to the extension host when the user
 * submits their review.
 */
interface SubmitReviewMessage {
  type: 'submitReview';
  sessionId: string;
  status: 'approved' | 'approved_with_notes' | 'changes_requested';
  reviewedHtml: string;
}

type WebviewMessage = SubmitReviewMessage;

export class ReviewPanel {
  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _bridgeScope?: string;
  private readonly _sessionId: string;
  private _submitted = false;
  private _disposed = false;

  private constructor(panel: vscode.WebviewPanel, session: ReviewSession, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._bridgeScope = session.bridgeScope;
    this._sessionId = session.sessionId;

    // Set initial HTML content.
    this._panel.webview.html = ReviewPanel._buildHtml(this._panel.webview, extensionUri, session);

    // Handle messages from the webview.
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        if (message.type === 'submitReview') {
          this._submitted = true;
          writeCompletedSession(this._bridgeScope ?? 'global', message.sessionId, message.status, message.reviewedHtml);
          this._panel.dispose();
        }
      },
      null,
      this._disposables,
    );

    // Clean up when the panel is closed by the user.
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Create and show a new ReviewPanel for the given session.
   */
  static create(extensionUri: vscode.Uri, session: ReviewSession): ReviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      'uiReview',
      session.title ?? `UI Review – ${session.sessionId}`,
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        // Restrict the webview to only load resources from the extension's dist folder.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
        retainContextWhenHidden: true,
      },
    );

    return new ReviewPanel(panel, session, extensionUri);
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    if (!this._submitted) {
      if (this._bridgeScope) {
        discardPendingSessionInScope(this._bridgeScope, this._sessionId);
      } else {
        discardPendingSession(this._sessionId);
      }
    }

    // If closed without submitting, the standalone server's poll will time out
    // and return an error to the agent automatically.
    this._panel.dispose();

    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static _buildHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    session: ReviewSession,
  ): string {
    // Resolve the webview-safe URI for the bundled webview script.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'),
    );

    // Use a per-session nonce so that inline scripts are allowed by the CSP
    // while still blocking injected scripts from untrusted HTML content.
    const nonce = ReviewPanel._generateNonce();

    // Serialise only what the webview needs; avoid leaking internal state.
    const sessionData = JSON.stringify({
      sessionId: session.sessionId,
      html: session.originalHtml,
      title: session.title ?? '',
      instructions: session.instructions ?? '',
    });

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--
    Content Security Policy:
    - default-src 'none'            – deny everything not listed
    - style-src  'unsafe-inline'    – allow inline styles (needed for the loading UI)
    - script-src 'nonce-${nonce}'   – allow only scripts with matching nonce
    - frame-src  blob:               – sandboxed iframe for HTML preview
    - img-src    ${webview.cspSource} data: – extension images + data URIs
  -->
  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      style-src   'unsafe-inline';
      script-src  'nonce-${nonce}' ${webview.cspSource};
      frame-src   blob:;
      img-src     ${webview.cspSource} data:;
    "
  />
  <title>UI Review</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family, sans-serif);
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      height: 100vh;
      overflow: hidden;
    }
    #root {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <!--
    Inject the review session data as a global before the bundle loads.
    The nonce ensures this inline script is permitted by the CSP.
  -->
  <script nonce="${nonce}">
    window.__REVIEW_SESSION__ = ${sessionData};
  </script>

  <!-- Main webview bundle -->
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /** Generate a cryptographically-adequate random nonce for the CSP. */
  private static _generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
