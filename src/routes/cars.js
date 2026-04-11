// =============================================
// FILE: cars.js
// Car management routes (browse, search, create, update, availability)
// Created: 2024-12-19
// Updated: 2024-12-19
// =============================================

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import CarListingBuilder from "../patterns/CarListingBuilder.js";
import { notifyWatchers } from "../patterns/WatchNotifier.js";
import { listBlocksAndBookings } from "../services/availability.js";
import SearchMediator from "../patterns/SearchMediator.js";

// Date normalization utilities
function normalizeISODate(s) {
  const t = String(s || "").trim();
  // Accept "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS..." and keep just the date part
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

function isValidISODate(s) {
  const d = normalizeISODate(s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return !Number.isNaN(Date.parse(d));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = normalizeISODate(aStart);
  const ae = normalizeISODate(aEnd);
  const bs = normalizeISODate(bStart);
  const be = normalizeISODate(bEnd);
  // same logic you used in SQL: (start < otherEnd) && (end > otherStart)
  return as < be && ae > bs;
}

function toCentsFromDollars(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n)) return null;
  if (n < 0) return null;
  return Math.round(n * 100);
}

export default function carRoutes(db) {
  const r = express.Router();
  const searchMediator = new SearchMediator(db); // Mediator for search operations

  // =============================================
  // BROWSE CARS ENDPOINT
  // =============================================

  // GET /api/cars/browse?location=detroit&maxPrice=120&limit=12
  // Browse cars without date filtering (for homepage/library)
  // Business rules: optional location filter, optional price filter, pagination
  r.get("/browse", async (req, res) => {
    const { location, maxPrice, limit } = req.query || {};

    // Prepare criteria for mediator
    const criteria = {
      location: String(location || "").trim(),
      maxPrice: maxPrice != null ? Number(maxPrice) : null,
      limit: Math.max(1, Math.min(50, Number(limit || 12) || 12))
    };

    // Validate criteria
    const validation = searchMediator.validateCriteria(criteria);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: validation.error });
    }

    // Execute browse using mediator
    const cars = await searchMediator.browseCars(criteria);
    return res.json({ ok: true, cars });
  });

  // =============================================
  // SEARCH CARS ENDPOINT
  // =============================================

  // GET /api/cars/search?location=detroit&start=2024-01-01&end=2024-01-05&maxPrice=120
  // Search cars with location + date range + optional price filter
  // Business rules: location required, valid date range, optional price filter
  // Edge cases: invalid dates, end before start, location missing
  r.get("/search", async (req, res) => {
    const { location, start, end, maxPrice } = req.query || {};

    // Prepare criteria for mediator
    const criteria = {
      location: String(location || "").trim(),
      startDate: normalizeISODate(start),
      endDate: normalizeISODate(end),
      maxPrice: maxPrice != null ? Number(maxPrice) : null,
      requireLocation: true // Location required for search
    };

    // Validate criteria using mediator
    const validation = searchMediator.validateCriteria(criteria);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: validation.error });
    }

    // Execute search using mediator
    const cars = await searchMediator.searchCars(criteria);
    return res.json({ ok: true, cars });
  });

  // =============================================
  // OWNER CAR LISTING ENDPOINT
  // =============================================

  // GET /api/cars/mine/list
  // List cars owned by current user
  // Business rules: must be authenticated
  r.get("/mine/list", requireAuth, async (req, res) => {
    const rows = await db.all(
      `SELECT * FROM cars
       WHERE owner_id = ?
       ORDER BY datetime(updated_at) DESC, id DESC`,
      [req.userId]
    );
    return res.json({ ok: true, cars: rows });
  });

  // =============================================
  // GET CAR DETAILS ENDPOINT
  // =============================================

  // GET /api/cars/:id
  // Get detailed car information with owner name
  // Edge cases: car not found
  r.get("/:id", async (req, res) => {
    const carId = Number(req.params.id);
    const row = await db.get(
      `SELECT c.*,
              u.display_name AS owner_name
       FROM cars c
       JOIN users u ON u.id = c.owner_id
       WHERE c.id = ?`,
      [carId]
    );
    if (!row) return res.status(404).json({ ok: false, error: "Car not found." });
    return res.json({ ok: true, car: row });
  });

  // =============================================
  // CAR CALENDAR ENDPOINT
  // =============================================

  // GET /api/cars/:id/calendar
  // Get availability calendar (bookings + blocks)
  // Edge cases: car not found
  r.get("/:id/calendar", async (req, res) => {
    const carId = Number(req.params.id);
    const car = await db.get("SELECT id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });

    const data = await listBlocksAndBookings(db, carId);
    return res.json({ ok: true, ...data });
  });

  // =============================================
  // ADD AVAILABILITY BLOCK ENDPOINT
  // =============================================

  // POST /api/cars/:id/blocks
  // Owner adds manual unavailable block
  // Business rules: owner only, valid date range, no overlaps with existing bookings/blocks
  // DB side-effects: inserts availability block, notifies watchers
  // Edge cases: not owner, invalid dates, overlaps
  r.post("/:id/blocks", requireAuth, async (req, res) => {
    const carId = Number(req.params.id);
    const { startDate, endDate, reason } = req.body || {};

    const car = await db.get("SELECT id, owner_id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });
    if (car.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Not owner." });

    const s = normalizeISODate(startDate);
    const e = normalizeISODate(endDate);
    if (!s || !e) return res.status(400).json({ ok: false, error: "Need startDate and endDate." });
    if (!isValidISODate(s) || !isValidISODate(e)) {
      return res.status(400).json({ ok: false, error: "Dates must be YYYY-MM-DD." });
    }
    if (Date.parse(e) <= Date.parse(s)) {
      return res.status(400).json({ ok: false, error: "endDate must be after startDate." });
    }

    // Prevent creating a block that overlaps an existing booking/block
    const current = await listBlocksAndBookings(db, carId);

    for (const b of current.bookings || []) {
      if (b.status && !["pending", "confirmed"].includes(b.status)) continue;
      if (overlaps(s, e, b.start_date, b.end_date)) {
        return res.status(409).json({
          ok: false,
          error: "That block overlaps an existing booking.",
        });
      }
    }

    for (const b of current.blocks || []) {
      if (overlaps(s, e, b.start_date, b.end_date)) {
        return res.status(409).json({
          ok: false,
          error: "That block overlaps an existing block.",
        });
      }
    }

    await db.run(
      "INSERT INTO availability_blocks(car_id, start_date, end_date, reason) VALUES(?,?,?,?)",
      [carId, s, e, reason ? String(reason) : null]
    );

    await notifyWatchers(db, carId, `Availability updated for car #${carId}.`);
    return res.json({ ok: true });
  });

  // =============================================
  // DELETE AVAILABILITY BLOCK ENDPOINT
  // =============================================

  // POST /api/cars/:id/blocks/:blockId/delete
  // Owner deletes availability block
  // Business rules: owner only
  // DB side-effects: deletes block, notifies watchers
  r.post("/:id/blocks/:blockId/delete", requireAuth, async (req, res) => {
    const carId = Number(req.params.id);
    const blockId = Number(req.params.blockId);

    const car = await db.get("SELECT id, owner_id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });
    if (car.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Not owner." });

    await db.run("DELETE FROM availability_blocks WHERE id = ? AND car_id = ?", [blockId, carId]);

    await notifyWatchers(db, carId, `Availability updated for car #${carId}.`);
    return res.json({ ok: true });
  });

  // =============================================
  // CREATE CAR LISTING ENDPOINT
  // =============================================

  // POST /api/cars/
  // Owner creates new car listing using Builder pattern
  // Business rules: authenticated user, valid car data, defaults to active
  // DB side-effects: inserts car listing
  // Edge cases: missing fields, invalid data
  r.post("/", requireAuth, async (req, res) => {
    const { title, make, model, year, mileage, pickupLocation, pricePerDay } = req.body || {};
    if (!title || !make || !model || !year || mileage == null || !pickupLocation || pricePerDay == null) {
      return res.status(400).json({ ok: false, error: "Missing fields." });
    }

    const y = Number(year);
    const mi = Number(mileage);
    const cents = toCentsFromDollars(pricePerDay);

    if (!Number.isFinite(y) || y < 1900) return res.status(400).json({ ok: false, error: "Invalid year." });
    if (!Number.isFinite(mi) || mi < 0) return res.status(400).json({ ok: false, error: "Invalid mileage." });
    if (cents == null) return res.status(400).json({ ok: false, error: "Invalid pricePerDay." });

    const builder = new CarListingBuilder(req.userId)
      .title(String(title).trim())
      .make(String(make).trim())
      .model(String(model).trim())
      .year(y)
      .mileage(mi)
      .pickupLocation(String(pickupLocation).trim())
      .pricePerDayCents(cents);

    const car = builder.build();

    const result = await db.run(
      `INSERT INTO cars(owner_id,title,make,model,year,mileage,pickup_location,price_per_day_cents,active,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        car.owner_id,
        car.title,
        car.make,
        car.model,
        car.year,
        car.mileage,
        car.pickup_location,
        car.price_per_day_cents,
        1, // force active by default
        car.updated_at,
      ]
    );

    return res.json({ ok: true, carId: result.lastID });
  });

  // =============================================
  // UPDATE PRICE ENDPOINT
  // =============================================

  // POST /api/cars/:id/price
  // Owner updates car daily price
  // Business rules: owner only, valid price
  // DB side-effects: updates price, notifies watchers (Observer pattern)
  r.post("/:id/price", requireAuth, async (req, res) => {
    const carId = Number(req.params.id);
    const { pricePerDay } = req.body || {};
    const car = await db.get("SELECT id, owner_id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });
    if (car.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Not owner." });

    const cents = toCentsFromDollars(pricePerDay);
    if (cents == null) return res.status(400).json({ ok: false, error: "Invalid pricePerDay." });

    await db.run("UPDATE cars SET price_per_day_cents = ?, updated_at = datetime('now') WHERE id = ?", [cents, carId]);

    await notifyWatchers(db, carId, `Price drop/update: car #${carId} is now $${(cents / 100).toFixed(2)}/day`);
    return res.json({ ok: true });
  });

  // =============================================
  // TOGGLE ACTIVE STATUS ENDPOINT
  // =============================================

  // POST /api/cars/:id/active
  // Owner toggles car listing active/inactive
  // Business rules: owner only
  // DB side-effects: updates active status, notifies watchers
  r.post("/:id/active", requireAuth, async (req, res) => {
    const carId = Number(req.params.id);
    const { active } = req.body || {};
    const car = await db.get("SELECT id, owner_id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });
    if (car.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Not owner." });

    const val = active ? 1 : 0;
    await db.run("UPDATE cars SET active = ?, updated_at = datetime('now') WHERE id = ?", [val, carId]);

    await notifyWatchers(db, carId, `Listing status changed for car #${carId}.`);
    return res.json({ ok: true });
  });

  // =============================================
  // WATCH CAR ENDPOINT
  // =============================================

  // POST /api/cars/:id/watch
  // User subscribes to car watch notifications (Observer pattern)
  // Business rules: authenticated user, optional price/date filters
  // DB side-effects: inserts/updates watch subscription
  // Edge cases: invalid price, invalid dates, end before start
  r.post("/:id/watch", requireAuth, async (req, res) => {
    const carId = Number(req.params.id);
    const { maxPricePerDay, watchStartDate, watchEndDate } = req.body || {};

    const car = await db.get("SELECT id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });

    const cents =
      maxPricePerDay == null || String(maxPricePerDay).trim() === ""
        ? null
        : toCentsFromDollars(maxPricePerDay);

    if (maxPricePerDay != null && String(maxPricePerDay).trim() !== "" && cents == null) {
      return res.status(400).json({ ok: false, error: "Invalid maxPricePerDay." });
    }

    const ws = watchStartDate && String(watchStartDate).trim() !== "" ? normalizeISODate(watchStartDate) : null;
    const we = watchEndDate && String(watchEndDate).trim() !== "" ? normalizeISODate(watchEndDate) : null;

    if (ws && !isValidISODate(ws)) return res.status(400).json({ ok: false, error: "Invalid watchStartDate." });
    if (we && !isValidISODate(we)) return res.status(400).json({ ok: false, error: "Invalid watchEndDate." });
    if (ws && we && Date.parse(we) <= Date.parse(ws)) {
      return res.status(400).json({ ok: false, error: "watchEndDate must be after watchStartDate." });
    }

    await db.run(
      `INSERT OR REPLACE INTO watches(user_id, car_id, max_price_per_day_cents, watch_start_date, watch_end_date)
       VALUES(?,?,?,?,?)`,
      [req.userId, carId, cents, ws, we]
    );

    return res.json({ ok: true });
  });

  return r;
}