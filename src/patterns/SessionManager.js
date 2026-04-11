
/*
 * Author:
 * Created on: April 11, 2026
 * Last updated: April 11, 2026
 * Purpose: Singleton session manager for user authentication state
 */

// =============================================
// SINGLETON SESSION MANAGER
// =============================================

import { v4 as uuidv4 } from "uuid";

class SessionManager {
  static _instance = null;

  static instance() {
    if (!SessionManager._instance) {
      SessionManager._instance = new SessionManager();
    }
    return SessionManager._instance;
  }

  constructor() {
    if (SessionManager._instance) {
      return SessionManager._instance;
    }

    this.sessions = new Map();

    SessionManager._instance = this;
  }

  createSession(userId) {
    const sid = uuidv4();
    this.sessions.set(sid, userId);
    return sid;
  }

  getUserId(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  destroySession(sessionId) {
    this.sessions.delete(sessionId);
  }
}

export default SessionManager;
