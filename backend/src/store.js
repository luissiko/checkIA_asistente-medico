import { randomUUID, randomBytes, createHash } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest('hex');
export class SessionStore {
  constructor({ ttlMs = 30 * 60 * 1000, now = () => Date.now(), maxSessions = 1000 } = {}) {
    this.sessions = new Map(); this.ttlMs = ttlMs; this.now = now; this.maxSessions = maxSessions;
  }
  purge() { for (const [id, s] of this.sessions) if (s.expiresAt <= this.now()) this.sessions.delete(id); }
  create() {
    this.purge();
    if (this.sessions.size >= this.maxSessions) throw Object.assign(new Error('capacity'), { status: 503 });
    const id = randomUUID(), token = randomBytes(32).toString('hex');
    const session = { id, tokenHash: digest(token), createdAt: this.now(), expiresAt: this.now() + this.ttlMs,
      status: 'open', messages: [], clinicalState: { schemaVersion: 1, facts: [], pendingQuestions: [], assessment: null } };
    this.sessions.set(id, session); return { session: this.public(session), token };
  }
  access(id, token) {
    this.purge(); const session = this.sessions.get(id);
    if (!session || typeof token !== 'string' || token.length > 256 || digest(token) !== session.tokenHash)
      throw Object.assign(new Error('access'), { status: 404 });
    return session;
  }
  public(s) { const { tokenHash, ...rest } = s; return structuredClone(rest); }
}
