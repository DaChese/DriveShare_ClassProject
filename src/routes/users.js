// =============================================
// FILE: users.js
// User profile routes (get user info)
// Created: 2024-12-19
// Updated: 2024-12-19
// =============================================

import express from "express";
import { requireAuth } from "../middleware/auth.js";

export default function userRoutes(db) {
  const r = express.Router();

  // =============================================
  // GET USER PROFILE ENDPOINT
  // =============================================

  // GET /api/users/:id
  // Get basic user profile information
  // Business rules: authenticated user
  // Edge cases: user not found
  r.get("/:id", requireAuth, async (req, res) => {
    const uid = Number(req.params.id);
    const u = await db.get("SELECT id, display_name FROM users WHERE id = ?", [uid]);
    if (!u) return res.status(404).json({ ok: false, error: "User not found." });
    return res.json({ ok: true, user: u });
  });

  return r;
}