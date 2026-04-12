/*
 * Author: Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Handles inbox conversations and messages between owners and renters.
 */

// =============================================
// IMPORTS
// =============================================

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import emailService from "../services/emailService.js";

// =============================================
// MESSAGE HELPERS
// =============================================

async function ownerCanMessageRenter(db, carId, ownerId, renterId) {
  // Owners can only message renters tied to this car by a booking or existing thread.
  const priorBooking = await db.get(
    `SELECT 1
     FROM bookings b
     JOIN cars c ON c.id = b.car_id
     WHERE b.car_id = ?
       AND c.owner_id = ?
       AND b.renter_id = ?
     LIMIT 1`,
    [carId, ownerId, renterId]
  );
  if (priorBooking) return true;

  const priorMessage = await db.get(
    `SELECT 1
     FROM messages
     WHERE car_id = ?
       AND owner_id = ?
       AND renter_id = ?
     LIMIT 1`,
    [carId, ownerId, renterId]
  );
  return Boolean(priorMessage);
}

// =============================================
// MESSAGE ROUTES
// =============================================

export default function messageRoutes(db) {
  const r = express.Router();

  // =============================================
  // LIST CONVERSATIONS
  // =============================================

  // GET /api/messages/conversations
  // Returns the current user's inbox with unread counts and latest message previews.
  r.get("/conversations", requireAuth, async (req, res) => {
    try {
      const me = req.userId;
      const rows = await db.all(
        `WITH convo AS (
           SELECT
             m.car_id,
             m.owner_id,
             m.renter_id,
             MAX(m.id) AS latest_id,
             SUM(CASE WHEN m.sender_id != ? AND m.is_read = 0 THEN 1 ELSE 0 END) AS unread_count
           FROM messages m
           WHERE m.owner_id = ? OR m.renter_id = ?
           GROUP BY m.car_id, m.owner_id, m.renter_id
         )
         SELECT
           c.car_id,
           c.owner_id,
           c.renter_id,
           c.unread_count,
           lm.id AS latest_message_id,
           lm.body AS latest_body,
           lm.created_at AS latest_created_at,
           lm.sender_id AS latest_sender_id,
           car.title,
           car.make,
           car.model,
           car.year,
           u.id AS other_user_id,
           u.display_name AS other_user_name
         FROM convo c
         JOIN messages lm ON lm.id = c.latest_id
         JOIN cars car ON car.id = c.car_id
         JOIN users u
           ON u.id = CASE
             WHEN c.owner_id = ? THEN c.renter_id
             ELSE c.owner_id
           END
         ORDER BY lm.id DESC`,
        [me, me, me, me]
      );

      return res.json({ ok: true, conversations: rows || [] });
    } catch (e) {
      console.error("messages conversations failed:", e);
      return res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  // =============================================
  // LOAD THREAD
  // =============================================

  // GET /api/messages/thread
  // Expects carId and otherUserId, then returns one full owner/renter thread.
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

      let renterId;
      if (me === ownerId) {
        renterId = otherUserId;
        const allowed = await ownerCanMessageRenter(db, carId, ownerId, renterId);
        if (!allowed) {
          return res.status(403).json({ ok: false, error: "Owner can only message renters with a booking or existing thread for this car." });
        }
      } else {
        renterId = me;
        if (otherUserId !== ownerId) {
          return res.status(403).json({ ok: false, error: "Renter can only message the owner for this car." });
        }
      }

      const rows = await db.all(
        `SELECT m.id, m.sender_id, m.body, m.created_at, m.is_read, m.owner_id, m.renter_id
         FROM messages m
         WHERE m.car_id = ?
           AND m.owner_id = ?
           AND m.renter_id = ?
         ORDER BY m.id ASC`,
        [carId, ownerId, renterId]
      );

      return res.json({ ok: true, messages: rows || [], owner_id: ownerId, renter_id: renterId });
    } catch (e) {
      console.error("messages thread failed:", e);
      return res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  // =============================================
  // SEND MESSAGE
  // =============================================

  // POST /api/messages/
  // Expects carId, toUserId, and body.
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

      let renterId;
      if (req.userId === ownerId) {
        if (toId === ownerId) return res.status(400).json({ ok: false, error: "Can't message yourself." });
        renterId = toId;

        // Owners can only start or continue valid owner-renter threads for this car.
        const allowed = await ownerCanMessageRenter(db, cid, ownerId, renterId);
        if (!allowed) {
          return res.status(403).json({ ok: false, error: "Owner can only message renters with a booking or existing thread for this car." });
        }
      } else {
        renterId = req.userId;
        if (toId !== ownerId) {
          return res.status(403).json({ ok: false, error: "Renter can only message the owner for this car." });
        }
      }

      // Saves the message row inside the owner/renter conversation.
      await db.run(
        "INSERT INTO messages(car_id, owner_id, renter_id, sender_id, body) VALUES(?,?,?,?,?)",
        [cid, ownerId, renterId, req.userId, msg]
      );

      const sender = await db.get("SELECT display_name FROM users WHERE id = ?", [req.userId]);
      const recipient = await db.get("SELECT display_name, email FROM users WHERE id = ?", [toId]);
      const carDetails = await db.get("SELECT title, make, model, year FROM cars WHERE id = ?", [cid]);

      // Creates a message notification with enough data for the UI to reopen the thread.
      const notifText = `car_id:${cid}|from_user:${req.userId}|sender_name:${sender.display_name}|car_name:${carDetails.title || `${carDetails.year} ${carDetails.make} ${carDetails.model}`}`;
      await db.run(
        "INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
        [toId, "message", notifText]
      );

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

  // =============================================
  // MARK MESSAGE READ
  // =============================================

  // POST /api/messages/:id/read
  // Marks one received message as read.
  r.post("/:id/read", requireAuth, async (req, res) => {
    try {
      const messageId = Number(req.params.id);

      if (!Number.isFinite(messageId) || messageId <= 0) {
        return res.status(400).json({ ok: false, error: "Invalid message ID." });
      }

      const message = await db.get(
        `SELECT m.id, m.car_id, m.owner_id, m.renter_id, m.sender_id
         FROM messages m
         WHERE m.id = ?`,
        [messageId]
      );

      if (!message) {
        return res.status(404).json({ ok: false, error: "Message not found." });
      }

      if (req.userId !== message.owner_id && req.userId !== message.renter_id) {
        return res.status(403).json({ ok: false, error: "Not allowed to mark this message as read." });
      }

      // Only mark messages as read when they came from the other person.
      if (message.sender_id !== req.userId) {
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
