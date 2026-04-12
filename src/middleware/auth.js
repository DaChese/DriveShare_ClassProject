/*
 * Author: Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Blocks protected routes unless the user has a valid session.
 */

// =============================================
// IMPORTS
// =============================================

import SessionManager from "../patterns/SessionManager.js";

// =============================================
// AUTH MIDDLEWARE
// =============================================

export function requireAuth(req, res, next) {
  const sid = req.cookies.sid;
  const userId = sid ? SessionManager.instance().getUserId(sid) : null;

  if (!userId) return res.status(401).json({ ok: false, error: "Not logged in." });

  req.userId = userId;
  next();
}
