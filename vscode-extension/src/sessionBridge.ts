import { EventEmitter } from 'events';
import type { ReviewSession, ReviewResult } from '../../mcp-server/src/types';
import { sessionStore } from '../../mcp-server/src/sessions/store';

class SessionBridge extends EventEmitter {
  /**
   * Notify listeners that a new review session has been created.
   * The extension listens to this event to open a ReviewPanel.
   */
  notifyNewSession(session: ReviewSession): void {
    this.emit('newSession', session);
  }

  /**
   * Mark a review session as complete with the given result.
   * Resolves the pending promise held by the MCP tool handler.
   */
  async completeSession(sessionId: string, result: ReviewResult): Promise<void> {
    await sessionStore.complete(sessionId, result);
  }

  /**
   * Cancel a session without a result, e.g. when the user closes the panel
   * without submitting. Rejects the pending promise in the tool handler.
   */
  cancelSession(sessionId: string, reason = 'Review panel closed without submission'): void {
    sessionStore.cancel(sessionId, reason);
  }
}

export const sessionBridge = new SessionBridge();
