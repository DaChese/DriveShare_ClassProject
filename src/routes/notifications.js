import express from "express";
import { requireAuth } from "../middleware/auth.js";

export default function notificationRoutes(db) {
  const r = express.Router();

  r.get("/", requireAuth, async (req, res) => {
    const rows = await db.all(
      "SELECT id, type, text, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100",
      [req.userId]
    );
    return res.json({ ok: true, notifications: rows });
  });

  r.post("/:id/read", requireAuth, async (req, res) => {
    const nid = Number(req.params.id);
    await db.run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [nid, req.userId]);
    return res.json({ ok: true });
  });

  return r;
}
