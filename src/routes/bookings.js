import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { PaymentProxy, RealPaymentService } from "../patterns/PaymentProxy.js";
import { notifyWatchers } from "../patterns/WatchNotifier.js";

export default function bookingRoutes(db) {
  const r = express.Router();
  const payment = new PaymentProxy(new RealPaymentService());

  // Create booking (must prevent overlap with bookings + blocks)
  r.post("/", requireAuth, async (req, res) => {
    const { carId, startDate, endDate } = req.body || {};
    const cid = Number(carId);
    if (!cid || !startDate || !endDate) return res.status(400).json({ ok: false, error: "Missing fields." });

    const overlap = await db.get(
      `SELECT 1 FROM bookings
       WHERE car_id = ?
         AND status IN ('pending','confirmed')
         AND (? < end_date) AND (? > start_date)
       LIMIT 1`,
      [cid, startDate, endDate]
    );
    if (overlap) return res.status(409).json({ ok: false, error: "Car already booked for that range." });

    const overlapBlock = await db.get(
      `SELECT 1 FROM availability_blocks
       WHERE car_id = ?
         AND (? < end_date) AND (? > start_date)
       LIMIT 1`,
      [cid, startDate, endDate]
    );
    if (overlapBlock) return res.status(409).json({ ok: false, error: "Car is unavailable for that range." });

    const car = await db.get("SELECT owner_id, price_per_day_cents FROM cars WHERE id = ?", [cid]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });

    const days = Math.max(1, Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / (1000*60*60*24)));
    const total = days * car.price_per_day_cents;

    const result = await db.run(
      "INSERT INTO bookings(car_id, renter_id, start_date, end_date, status, total_cents) VALUES(?,?,?,?,?,?)",
      [cid, req.userId, startDate, endDate, "pending", total]
    );

    // notify owner of booking request
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [car.owner_id, "booking", `New booking request for car #${cid} (booking #${result.lastID}).`]
    );

    return res.json({ ok: true, bookingId: result.lastID, totalCents: total });
  });

  // Cancel booking (frees availability)
  r.post("/:id/cancel", requireAuth, async (req, res) => {
    const bookingId = Number(req.params.id);
    const row = await db.get(
      `SELECT b.id, b.car_id, b.renter_id, b.status, c.owner_id
       FROM bookings b JOIN cars c ON c.id=b.car_id
       WHERE b.id = ?`,
      [bookingId]
    );
    if (!row) return res.status(404).json({ ok: false, error: "Booking not found." });

    const allowed = (req.userId === row.renter_id) || (req.userId === row.owner_id);
    if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed." });

    if (row.status === "cancelled") return res.json({ ok: true, message: "Already cancelled." });

    await db.run("UPDATE bookings SET status='cancelled' WHERE id = ?", [bookingId]);

    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [row.owner_id, "booking", `Booking #${bookingId} was cancelled.`]
    );
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [row.renter_id, "booking", `You cancelled booking #${bookingId}.`]
    );

    await notifyWatchers(db, row.car_id, `Car #${row.car_id} may be available now (booking cancelled).`);
    return res.json({ ok: true });
  });

  // Pay booking (Proxy)
  r.post("/:id/pay", requireAuth, async (req, res) => {
    const bookingId = Number(req.params.id);
    const booking = await db.get(
      "SELECT b.id, b.renter_id, b.car_id, b.total_cents, c.owner_id FROM bookings b JOIN cars c ON c.id=b.car_id WHERE b.id = ?",
      [bookingId]
    );
    if (!booking) return res.status(404).json({ ok: false, error: "Booking not found." });

    const rPay = await payment.pay(db, req.userId, bookingId, booking.renter_id, booking.owner_id, booking.total_cents);
    if (!rPay.ok) return res.status(400).json(rPay);

    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [booking.owner_id, "payment", `Booking #${bookingId} was paid.`]
    );
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [booking.renter_id, "payment", `You paid booking #${bookingId}.`]
    );

    return res.json({ ok: true });
  });

  return r;
}
