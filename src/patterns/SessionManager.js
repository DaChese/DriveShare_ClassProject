/*
 * Author: Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Keeps DriveShare login sessions in one shared place.
 */

// =============================================
// IMPORTS
// =============================================

import { v4 as uuidv4 } from "uuid";

// =============================================
// SESSION MANAGER
// =============================================

class SessionManager {
  static _instance = null;

  // Singleton access point used by auth routes and middleware ////////
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
