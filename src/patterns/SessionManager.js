
/**
 * SessionManager - Singleton Pattern Implementation
 *
 * Manages user sessions across the application using a centralized in-memory store.
 * Ensures only one instance exists throughout the application lifecycle.
 *
 * Design Pattern: Singleton
 * - Guarantees single instance of session management
 * - Provides global access point for session operations
 * - Thread-safe instance creation
 *
 * Usage: Authentication middleware and protected routes rely on this
 * for maintaining user login state across requests.
 */

import { v4 as uuidv4 } from "uuid";

/**
 * SessionManager class implementing the Singleton design pattern
 * Handles creation, retrieval, and destruction of user sessions
 */
class SessionManager {
  /** @private Singleton instance storage */
  static _instance = null;

  /**
   * Get the singleton instance of SessionManager
   * @returns {SessionManager} The single SessionManager instance
   */
  static instance() {
    if (!SessionManager._instance) {
      SessionManager._instance = new SessionManager();
    }
    return SessionManager._instance;
  }

  /**
   * Private constructor to prevent direct instantiation
   * Initializes the sessions Map for storing session data
   */
  constructor() {
    // Prevent multiple instances via new keyword
    if (SessionManager._instance) {
      return SessionManager._instance;
    }

    /** @private Map storing sessionId -> userId mappings */
    this.sessions = new Map();

    SessionManager._instance = this;
  }

  /**
   * Create a new session for a user
   * @param {number} userId - The ID of the user to create session for
   * @returns {string} Unique session ID (UUID)
   */
  createSession(userId) {
    const sid = uuidv4();
    this.sessions.set(sid, userId);
    return sid;
  }

  /**
   * Retrieve user ID associated with a session
   * @param {string} sessionId - The session ID to look up
   * @returns {number|null} User ID if session exists, null otherwise
   */
  getUserId(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Destroy a user session (logout)
   * @param {string} sessionId - The session ID to remove
   */
  destroySession(sessionId) {
    this.sessions.delete(sessionId);
  }
}

export default SessionManager;
