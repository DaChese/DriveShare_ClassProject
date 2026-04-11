// =============================================
// FILE: notifications.js
// Notification management routes (list, mark as read)
// Created: 2024-12-19
// Updated: 2024-12-19
// =============================================

import express from "express";
import { requireAuth } from "../middleware/auth.js";

export default function notificationRoutes(db) {
  const r = express.Router();

  // =============================================
  // GET NOTIFICATIONS ENDPOINT
  // =============================================

  // GET /api/notifications/
  // Get user's notifications (latest 100)
  // Business rules: authenticated user
  // Returns notifications ordered by ID desc (most recent first)
  r.get("/", requireAuth, async (req, res) => {
    const rows = await db.all(
      "SELECT id, type, text, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100",
      [req.userId]
    );
    return res.json({ ok: true, notifications: rows });
  });

  // =============================================
  // MARK NOTIFICATION READ ENDPOINT
  // =============================================

  // POST /api/notifications/:id/read
  // Mark specific notification as read
  // Business rules: authenticated user, notification belongs to user
  // DB side-effects: updates is_read flag
  r.post("/:id/read", requireAuth, async (req, res) => {
    const nid = Number(req.params.id);
    await db.run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [nid, req.userId]);
    return res.json({ ok: true });
  });

  return r;
}
