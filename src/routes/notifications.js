/*
 * Author: Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Lists notifications and lets a user mark them as read.
 */

// =============================================
// IMPORTS
// =============================================

import express from "express";
import { requireAuth } from "../middleware/auth.js";

// =============================================
// NOTIFICATION ROUTES
// =============================================

export default function notificationRoutes(db) {
  const r = express.Router();

  // =============================================
  // LIST NOTIFICATIONS
  // =============================================

  // GET /api/notifications/
  // Returns the logged-in user's latest 100 notifications.
  r.get("/", requireAuth, async (req, res) => {
    const rows = await db.all(
      "SELECT id, type, text, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100",
      [req.userId]
    );
    return res.json({ ok: true, notifications: rows });
  });

  // =============================================
  // MARK AS READ
  // =============================================

  // POST /api/notifications/:id/read
  // Marks that notification as read for the current user.
  r.post("/:id/read", requireAuth, async (req, res) => {
    const nid = Number(req.params.id);
    await db.run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [nid, req.userId]);
    return res.json({ ok: true });
  });

  return r;
}
