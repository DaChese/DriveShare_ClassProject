
/*
 * Author:
 * Created on: April 11, 2026
 * Last updated: April 11, 2026
 * Purpose: Authentication middleware using SessionManager singleton pattern
 */

// =============================================
// AUTH MIDDLEWARE
// =============================================

import SessionManager from "../patterns/SessionManager.js";

export function requireAuth(req, res, next) {
  const sid = req.cookies.sid;
  const userId = sid ? SessionManager.instance().getUserId(sid) : null;
  if (!userId) return res.status(401).json({ ok: false, error: "Not logged in." });
  req.userId = userId;
  next();
}
