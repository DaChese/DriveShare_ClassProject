/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Provides endpoints for fetching user profile information. 
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";

export default function userRoutes(db) {
  const r = express.Router();

  // =============================================
  // GET USER PROFILE ENDPOINT
  // =============================================

  // GET /api/users/:id
  // Get basic user profile information
  // Login is required.
  // Returns 404 if the user does not exist.
  r.get("/:id", requireAuth, async (req, res) => {
    const uid = Number(req.params.id);
    const u = await db.get("SELECT id, display_name FROM users WHERE id = ?", [uid]);
    if (!u) return res.status(404).json({ ok: false, error: "User not found." });
    return res.json({ ok: true, user: u });
  });

  return r;
}
