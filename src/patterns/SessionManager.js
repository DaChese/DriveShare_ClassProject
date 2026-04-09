
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
    this.sessions = new Map();
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
