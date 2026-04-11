import express from "express";
import { requireAuth } from "../middleware/auth.js";
import emailService from "../services/emailService.js";

export default function messageRoutes(db) {
  const r = express.Router();

  // Get a thread for a car between current user and another user
  // GET /api/messages/thread?carId=1&otherUserId=2
  r.get("/thread", requireAuth, async (req, res) => {
    try {
      const carId = Number(req.query.carId);
      const otherUserId = Number(req.query.otherUserId);

      if (!Number.isFinite(carId) || carId <= 0 || !Number.isFinite(otherUserId) || otherUserId <= 0) {
        return res.status(400).json({ ok: false, error: "Need valid carId and otherUserId." });
      }

      const car = await db.get("SELECT id, owner_id FROM cars WHERE id = ?", [carId]);
      if (!car) return res.status(404).json({ ok: false, error: "Car not found." });

      const other = await db.get("SELECT id FROM users WHERE id = ?", [otherUserId]);
      if (!other) return res.status(404).json({ ok: false, error: "User not found." });

      const me = req.userId;
      const ownerId = car.owner_id;

      // Conversation is always owner <-> renter for a car.
      // If I'm the owner, the other user is the renter.
      // If I'm not the owner, I must be the renter and the other user must be the owner.
      let renterId;
      if (me === ownerId) {
        renterId = otherUserId;
      } else {
        renterId = me;
        if (otherUserId !== ownerId) {
          return res.status(403).json({ ok: false, error: "Renter can only message the owner for this car." });
        }
      }

      const rows = await db.all(
        `SELECT m.id, m.sender_id, m.body, m.created_at, m.is_read
         FROM messages m
         WHERE m.car_id = ?
           AND m.owner_id = ?
           AND m.renter_id = ?
         ORDER BY m.id ASC`,
        [carId, ownerId, renterId]
      );

      return res.json({ ok: true, messages: rows || [] });
    } catch (e) {
      console.error("messages thread failed:", e);
      return res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  // Send message (in-app messaging)
  // Payload: { carId, toUserId, body }
  r.post("/", requireAuth, async (req, res) => {
    try {
      const { carId, toUserId, body } = req.body || {};

      const cid = Number(carId);
      const toId = Number(toUserId);
      const msg = String(body || "").trim();

      if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(toId) || toId <= 0 || !msg) {
        return res.status(400).json({ ok: false, error: "Need valid carId, toUserId, and body." });
      }

      const car = await db.get("SELECT id, owner_id FROM cars WHERE id = ?", [cid]);
      if (!car) return res.status(404).json({ ok: false, error: "Car not found." });

      const receiver = await db.get("SELECT id FROM users WHERE id = ?", [toId]);
      if (!receiver) return res.status(404).json({ ok: false, error: "User not found." });

      const ownerId = car.owner_id;

      // Determine renter participant and enforce owner<->renter messaging
      let renterId;
      if (req.userId === ownerId) {
        // owner sending -> must be sending to renter
        if (toId === ownerId) return res.status(400).json({ ok: false, error: "Can't message yourself." });
        renterId = toId;
      } else {
        // renter sending -> must be sending to owner
        renterId = req.userId;
        if (toId !== ownerId) {
          return res.status(403).json({ ok: false, error: "Renter can only message the owner for this car." });
        }
      }

      await db.run(
        "INSERT INTO messages(car_id, owner_id, renter_id, sender_id, body) VALUES(?,?,?,?,?)",
        [cid, ownerId, renterId, req.userId, msg]
      );

      // Get user details for email notification
      const sender = await db.get("SELECT display_name FROM users WHERE id = ?", [req.userId]);
      const recipient = await db.get("SELECT display_name, email FROM users WHERE id = ?", [toId]);
      const carDetails = await db.get("SELECT title, make, model, year FROM cars WHERE id = ?", [cid]);

      // notify receiver (in-app)
      await db.run(
        "INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
        [toId, "message", `New message about car #${cid}.`]
      );

      // Send email notification
      await emailService.sendMessageNotification(recipient.email, sender.display_name, carDetails);

      return res.json({ ok: true });
    } catch (e) {
      if (e && e.code === "SQLITE_CONSTRAINT") {
        return res.status(400).json({ ok: false, error: "Invalid car/user id (FK constraint)." });
      }
      console.error("messages POST failed:", e);
      return res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  // Mark message as read
  // POST /api/messages/:id/read
  r.post("/:id/read", requireAuth, async (req, res) => {
    try {
      const messageId = Number(req.params.id);

      if (!Number.isFinite(messageId) || messageId <= 0) {
        return res.status(400).json({ ok: false, error: "Invalid message ID." });
      }

      // Check if user is part of this message thread
      const message = await db.get(
        `SELECT m.id, m.car_id, m.owner_id, m.renter_id
         FROM messages m
         WHERE m.id = ?`,
        [messageId]
      );

      if (!message) {
        return res.status(404).json({ ok: false, error: "Message not found." });
      }

      // User must be either the owner or renter in this conversation
      const userId = req.userId;
      if (userId !== message.owner_id && userId !== message.renter_id) {
        return res.status(403).json({ ok: false, error: "Not allowed to mark this message as read." });
      }

      // Mark as read (only if not sent by the current user)
      if (message.sender_id !== userId) {
        await db.run("UPDATE messages SET is_read = 1 WHERE id = ?", [messageId]);
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error("mark message read failed:", e);
      return res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  return r;
}
