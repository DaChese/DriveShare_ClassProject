/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Handles booking creation, payment, cancellation, history, and reviews.
 */

// =============================================
// IMPORTS
// =============================================

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { PaymentProxy, RealPaymentService } from "../patterns/PaymentProxy.js";
import { notifyWatchers } from "../patterns/WatchNotifier.js";
import emailService from "../services/emailService.js";

// =============================================
// BOOKING ROUTES
// =============================================

export default function bookingRoutes(db) {
  const r = express.Router();
  const payment = new PaymentProxy(new RealPaymentService());

  // =============================================
  // CREATE BOOKING
  // =============================================

  // POST /api/bookings/
  // Expects carId, startDate, and endDate.
  r.post("/", requireAuth, async (req, res) => {
    const { carId, startDate, endDate } = req.body || {};
    const cid = Number(carId);
    if (!cid || !startDate || !endDate) return res.status(400).json({ ok: false, error: "Missing fields." });

    // Business rule: a car cannot have overlapping pending or confirmed bookings.
    const overlap = await db.get(
      `SELECT 1 FROM bookings
       WHERE car_id = ?
         AND status IN ('pending','confirmed')
         AND (? < end_date) AND (? > start_date)
       LIMIT 1`,
      [cid, startDate, endDate]
    );
    if (overlap) return res.status(409).json({ ok: false, error: "Car already booked for that range." });

    // Business rule: owner availability blocks also prevent booking.
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

    const days = Math.max(1, Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / (1000 * 60 * 60 * 24)));
    const total = days * car.price_per_day_cents;

    // DB side-effect: creates a pending booking first, then payment confirms it later.
    const result = await db.run(
      "INSERT INTO bookings(car_id, renter_id, start_date, end_date, status, total_cents) VALUES(?,?,?,?,?,?)",
      [cid, req.userId, startDate, endDate, "pending", total]
    );

    const bookingId = result.lastID;
    const renter = await db.get("SELECT display_name, email FROM users WHERE id = ?", [req.userId]);
    const owner = await db.get("SELECT display_name, email FROM users WHERE id = ?", [car.owner_id]);
    const carDetails = await db.get("SELECT title, make, model, year FROM cars WHERE id = ?", [cid]);

    // DB side-effect: creates an in-app notification for the owner.
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [car.owner_id, "booking", `New booking request for car #${cid} (booking #${bookingId}).`]
    );

    const booking = { id: bookingId, start_date: startDate, end_date: endDate, total_cents: total };
    await emailService.sendBookingRequest(owner.email, renter.display_name, booking, carDetails);

    return res.json({ ok: true, bookingId, totalCents: total, status: "pending" });
  });

  // =============================================
  // CANCEL BOOKING
  // =============================================

  // POST /api/bookings/:id/cancel
  // Allows either the renter or owner to cancel a booking.
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

    // DB side-effect: marks the booking cancelled and notifies both sides.
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

  // =============================================
  // PAY BOOKING
  // =============================================

  // POST /api/bookings/:id/pay
  // Confirms a pending booking through the payment proxy.
  r.post("/:id/pay", requireAuth, async (req, res) => {
    const bookingId = Number(req.params.id);
    const booking = await db.get(
      "SELECT b.id, b.status, b.renter_id, b.car_id, b.total_cents, c.owner_id FROM bookings b JOIN cars c ON c.id=b.car_id WHERE b.id = ?",
      [bookingId]
    );
    if (!booking) return res.status(404).json({ ok: false, error: "Booking not found." });
    if (booking.status === "confirmed") return res.json({ ok: true, message: "Booking already confirmed." });
    if (booking.status === "cancelled") return res.status(400).json({ ok: false, error: "Cancelled bookings cannot be paid." });

    // Business rule: only the renter pays, and the proxy checks that before money moves.
    const rPay = await payment.pay(db, req.userId, bookingId, booking.renter_id, booking.owner_id, booking.total_cents);
    if (!rPay.ok) return res.status(400).json(rPay);

    const renter = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.renter_id]);
    const owner = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.owner_id]);
    const carDetails = await db.get("SELECT title, make, model, year FROM cars WHERE id = ?", [booking.car_id]);

    // DB side-effect: adds payment notifications after balances and booking status are updated.
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [booking.owner_id, "payment", `Booking #${bookingId} was paid.`]
    );
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [booking.renter_id, "payment", `You paid booking #${bookingId}.`]
    );

    await emailService.sendPaymentNotification(owner.email, renter.display_name, booking, carDetails);
    await emailService.sendBookingConfirmation(renter.email, owner.display_name, booking, carDetails);

    return res.json({ ok: true });
  });

  // =============================================
  // BOOKING HISTORY
  // =============================================

  // GET /api/bookings/history
  // Returns both renter and owner history for the logged-in user.
  r.get("/history", requireAuth, async (req, res) => {
    const userId = req.userId;

    const renterBookings = await db.all(
      `SELECT b.id,
              b.car_id,
              b.start_date,
              b.end_date,
              b.status,
              b.total_cents,
              c.title,
              c.make,
              c.model,
              c.year,
              c.pickup_location,
              u.id AS owner_id,
              u.display_name AS owner_name,
              r.id AS my_review_id,
              r.rating AS my_rating,
              r.comment AS my_comment,
              r.reviewee_type AS my_review_type
       FROM bookings b
       JOIN cars c ON c.id = b.car_id
       JOIN users u ON u.id = c.owner_id
       LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = ?
       WHERE b.renter_id = ?
       ORDER BY datetime(b.start_date) DESC, b.id DESC`,
      [userId, userId]
    );

    const ownerBookings = await db.all(
      `SELECT b.id,
              b.car_id,
              b.start_date,
              b.end_date,
              b.status,
              b.total_cents,
              c.title,
              c.make,
              c.model,
              c.year,
              c.pickup_location,
              u.id AS renter_id,
              u.display_name AS renter_name,
              r.id AS my_review_id,
              r.rating AS my_rating,
              r.comment AS my_comment,
              r.reviewee_type AS my_review_type
       FROM bookings b
       JOIN cars c ON c.id = b.car_id
       JOIN users u ON u.id = b.renter_id
       LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = ?
       WHERE c.owner_id = ?
       ORDER BY datetime(b.start_date) DESC, b.id DESC`,
      [userId, userId]
    );

    return res.json({ ok: true, renterBookings, ownerBookings });
  });

  // =============================================
  // REVIEW BOOKING
  // =============================================

  // POST /api/bookings/:id/review
  // Lets the renter review the car or the owner review the renter.
  r.post("/:id/review", requireAuth, async (req, res) => {
    const bookingId = Number(req.params.id);
    const { rating, comment } = req.body || {};
    const userId = req.userId;

    const booking = await db.get(
      `SELECT b.id, b.car_id, b.renter_id, c.owner_id
       FROM bookings b
       JOIN cars c ON c.id = b.car_id
       WHERE b.id = ?`,
      [bookingId]
    );
    if (!booking) return res.status(404).json({ ok: false, error: "Booking not found." });

    let revieweeType, revieweeId;
    if (booking.renter_id === userId) {
      revieweeType = "car";
      revieweeId = booking.car_id;
    } else if (booking.owner_id === userId) {
      revieweeType = "user";
      revieweeId = booking.renter_id;
    } else {
      return res.status(403).json({ ok: false, error: "Not allowed." });
    }

    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ ok: false, error: "Rating must be an integer between 1 and 5." });
    }

    const normalizedComment = comment ? String(comment).trim() : null;

    // DB side-effect: creates or updates one review per booking/reviewer pair.
    await db.run(
      `INSERT INTO reviews(booking_id, reviewer_id, reviewee_type, reviewee_id, rating, comment)
       VALUES(?,?,?,?,?,?)
       ON CONFLICT(booking_id, reviewer_id) DO UPDATE SET
         reviewee_type = excluded.reviewee_type,
         reviewee_id = excluded.reviewee_id,
         rating = excluded.rating,
         comment = excluded.comment,
         created_at = excluded.created_at`,
      [bookingId, userId, revieweeType, revieweeId, score, normalizedComment]
    );

    let notifyUserId, revieweeName, revieweeEmail;
    if (revieweeType === "car") {
      const owner = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.owner_id]);
      notifyUserId = booking.owner_id;
      revieweeName = "your car";
      revieweeEmail = owner.email;
    } else {
      const renter = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.renter_id]);
      notifyUserId = booking.renter_id;
      revieweeName = renter.display_name;
      revieweeEmail = renter.email;
    }

    const reviewer = await db.get("SELECT display_name FROM users WHERE id = ?", [userId]);

    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [notifyUserId, "review", `New review from ${reviewer.display_name} for ${revieweeName} (booking #${bookingId}).`]
    );

    const review = { rating: score, comment: normalizedComment };
    await emailService.sendReviewNotification(revieweeEmail, reviewer.display_name, review, booking);

    return res.json({ ok: true });
  });

  return r;
}
