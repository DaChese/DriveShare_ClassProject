import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { PaymentProxy, RealPaymentService } from "../patterns/PaymentProxy.js";
import { notifyWatchers } from "../patterns/WatchNotifier.js";
import emailService from "../services/emailService.js";

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

    // Get user details for notifications
    const renter = await db.get("SELECT display_name, email FROM users WHERE id = ?", [req.userId]);
    const owner = await db.get("SELECT display_name, email FROM users WHERE id = ?", [car.owner_id]);

    // notify owner of booking request (in-app)
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [car.owner_id, "booking", `New booking request for car #${cid} (booking #${result.lastID}).`]
    );

    // Send email notification to owner
    const booking = { id: result.lastID, start_date: startDate, end_date: endDate, total_cents: total };
    const carDetails = await db.get("SELECT title, make, model, year FROM cars WHERE id = ?", [cid]);
    await emailService.sendBookingRequest(owner.email, renter.display_name, booking, carDetails);

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

    // Get user details for notifications
    const renter = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.renter_id]);
    const owner = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.owner_id]);
    const carDetails = await db.get("SELECT title, make, model, year FROM cars WHERE id = ?", [booking.car_id]);

    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [booking.owner_id, "payment", `Booking #${bookingId} was paid.`]
    );
    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [booking.renter_id, "payment", `You paid booking #${bookingId}.`]
    );

    // Send email notifications
    await emailService.sendPaymentNotification(owner.email, renter.display_name, booking, carDetails);
    await emailService.sendBookingConfirmation(renter.email, owner.display_name, booking, carDetails);

    return res.json({ ok: true });
  });

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
      // Renter reviews the car
      revieweeType = 'car';
      revieweeId = booking.car_id;
    } else if (booking.owner_id === userId) {
      // Owner reviews the renter (person)
      revieweeType = 'user';
      revieweeId = booking.renter_id;
    } else {
      return res.status(403).json({ ok: false, error: "Not allowed." });
    }

    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ ok: false, error: "Rating must be an integer between 1 and 5." });
    }

    const normalizedComment = comment ? String(comment).trim() : null;

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

    // Determine who to notify based on reviewee type
    let notifyUserId, revieweeName, revieweeEmail;
    if (revieweeType === 'car') {
      // Renter reviewed the car - notify the owner
      notifyUserId = booking.owner_id;
      const owner = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.owner_id]);
      revieweeName = "your car";
      revieweeEmail = owner.email;
    } else {
      // Owner reviewed the renter - notify the renter
      notifyUserId = booking.renter_id;
      const renter = await db.get("SELECT display_name, email FROM users WHERE id = ?", [booking.renter_id]);
      revieweeName = renter.display_name;
      revieweeEmail = renter.email;
    }

    const reviewer = await db.get("SELECT display_name FROM users WHERE id = ?", [userId]);

    await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [notifyUserId, "review", `New review from ${reviewer.display_name} for ${revieweeName} (booking #${bookingId}).`]
    );

    // Send email notification for review
    const review = { rating: score, comment: normalizedComment };
    await emailService.sendReviewNotification(revieweeEmail, reviewer.display_name, review, booking);

    return res.json({ ok: true });
  });

  return r;
}
