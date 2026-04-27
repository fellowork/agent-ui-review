import { ReviewResult, ReviewSession, ReviewSessionOption } from "../types";

class SessionStore {
  private readonly sessions = new Map<string, ReviewSession>();
  private readonly rejects = new Map<string, (reason: Error) => void>();

  create(sessionId: string, title: string, options: ReviewSessionOption[]): ReviewSession {
    if (options.length === 0) {
      throw new Error("Review sessions require at least one option.");
    }

    const session: ReviewSession = {
      sessionId,
      title,
      options,
      selectedOptionId: options[0].id,
      originalHtml: options[0].html,
      reviewedHtml: null,
      status: null,
      createdAt: new Date(),
      completedAt: null,
      resolve: null,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId: string): ReviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  complete(sessionId: string, result: ReviewResult): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.reviewedHtml = result.reviewedHtml;
    session.status = result.status;
    session.selectedOptionId = result.selectedOptionId;
    session.completedAt = new Date();
    if (session.resolve) {
      session.resolve(result);
      session.resolve = null;
    }
  }

  /**
   * Register the reject callback of the pending Promise so that cancel() can
   * unblock the tool handler with an error.
   */
  setReject(sessionId: string, reject: (reason: Error) => void): void {
    this.rejects.set(sessionId, reject);
  }

  /**
   * Cancel a pending session (e.g. panel closed without submitting, timeout).
   * Unblocks the waiting tool handler so MCP can return an error to the agent.
   */
  cancel(sessionId: string, reason = 'Review cancelled'): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== null) return;

    session.completedAt = new Date();
    session.resolve = null;

    const reject = this.rejects.get(sessionId);
    if (reject) {
      reject(new Error(reason));
      this.rejects.delete(sessionId);
    }
  }

  pending(): ReviewSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.status === null,
    );
  }
}

export const sessionStore = new SessionStore();
