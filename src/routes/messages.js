import express from "express";
import { requireAuth } from "../middleware/auth.js";

export default function messageRoutes(db) {
  const r = express.Router();

  // Get a thread for a car between current user and another user
  r.get("/thread", requireAuth, async (req, res) => {
    const carId = Number(req.query.carId);
    const otherUserId = Number(req.query.otherUserId);

    if (!carId || !otherUserId) {
      return res.status(400).json({ ok: false, error: "Need carId and otherUserId." });
    }

    const rows = await db.all(
      `SELECT m.id, m.sender_id, m.body, m.created_at
       FROM messages m
       WHERE m.car_id = ?
         AND ((m.sender_id = ? AND (m.owner_id = ? OR m.renter_id = ?))
           OR (m.sender_id = ? AND (m.owner_id = ? OR m.renter_id = ?)))
       ORDER BY m.id ASC`,
      [carId, req.userId, req.userId, otherUserId, otherUserId, req.userId, otherUserId]
    );

    return res.json({ ok: true, messages: rows });
  });

  // Send message (in-app messaging)
  // Payload: { carId, toUserId, body }
  r.post("/", requireAuth, async (req, res) => {
    const { carId, toUserId, body } = req.body || {};
    if (!carId || !toUserId || !body) {
      return res.status(400).json({ ok: false, error: "Need carId, toUserId, body." });
    }

    const cid = Number(carId);
    const toId = Number(toUserId);

    const car = await db.get("SELECT owner_id FROM cars WHERE id = ?", [cid]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });

    const ownerId = car.owner_id;
    const renterId = (req.userId === ownerId) ? toId : req.userId;

    await db.run(
      "INSERT INTO messages(car_id, owner_id, renter_id, sender_id, body) VALUES(?,?,?,?,?)",
      [cid, ownerId, renterId, req.userId, String(body)]
    );

    // notify receiver
    await db.run(
      "INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [toId, "message", `New message about car #${cid}.`]
    );

    return res.json({ ok: true });
  });

  return r;
}
