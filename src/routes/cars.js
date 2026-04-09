import express from "express";
import { requireAuth } from "../middleware/auth.js";
import CarListingBuilder from "../patterns/CarListingBuilder.js";
import { notifyWatchers } from "../patterns/WatchNotifier.js";
import { listBlocksAndBookings } from "../services/availability.js";

function isValidISODate(s) {
  // super basic YYYY-MM-DD check + Date.parse sanity
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  return !Number.isNaN(Date.parse(s));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  // same logic you used in SQL: (start < otherEnd) && (end > otherStart)
  return String(aStart) < String(bEnd) && String(aEnd) > String(bStart);
}

function toCentsFromDollars(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n)) return null;
  if (n < 0) return null;
  return Math.round(n * 100);
}

export default function carRoutes(db) {
  const r = express.Router();

  // Browse (no date filtering) - useful for homepage / "nearby" library
  // GET /api/cars/browse?location=detroit&maxPrice=120&limit=12
  r.get("/browse", async (req, res) => {
    const { location, maxPrice, limit } = req.query || {};
    const loc = String(location || "").trim();

    const lim = Math.max(1, Math.min(50, Number(limit || 12) || 12));

    let where = "WHERE c.active = 1";
    const params = [];

    if (loc) {
      where += " AND c.pickup_location LIKE ? COLLATE NOCASE";
      params.push(`%${loc}%`);
    }

    if (maxPrice != null && String(maxPrice).trim() !== "") {
      const cents = toCentsFromDollars(maxPrice);
      if (cents == null) {
        return res.status(400).json({ ok: false, error: "Invalid maxPrice." });
      }
      where += " AND c.price_per_day_cents <= ?";
      params.push(cents);
    }

    const rows = await db.all(
      `
      SELECT c.*
      FROM cars c
      ${where}
      ORDER BY c.price_per_day_cents ASC
      LIMIT ?
      `,
      [...params, lim]
    );

    return res.json({ ok: true, cars: rows });
  });

  // Search (Location + date range + optional max price)
  // FIXES:
  //  - location is now "contains" match (case-insensitive)
  //  - validates dates
  r.get("/search", async (req, res) => {
    const { location, start, end, maxPrice } = req.query || {};
    const loc = String(location || "").trim();
    const startDate = String(start || "").trim();
    const endDate = String(end || "").trim();

    if (!loc || !startDate || !endDate) {
      return res.status(400).json({ ok: false, error: "Need location, start, end." });
    }

    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      return res.status(400).json({ ok: false, error: "Dates must be YYYY-MM-DD." });
    }

    if (Date.parse(endDate) <= Date.parse(startDate)) {
      return res.status(400).json({ ok: false, error: "end must be after start." });
    }

    const likeLoc = `%${loc}%`;
    const params = [likeLoc];

    let maxPriceClause = "";
    if (maxPrice != null && String(maxPrice).trim() !== "") {
      const cents = toCentsFromDollars(maxPrice);
      if (cents == null) {
        return res.status(400).json({ ok: false, error: "Invalid maxPrice." });
      }
      maxPriceClause = " AND c.price_per_day_cents <= ? ";
      params.push(cents);
    }

    // overlap params
    params.push(startDate, endDate, startDate, endDate);

    // Exclude cars with overlapping pending/confirmed bookings OR manual blocks
    const rows = await db.all(
      `
      SELECT c.*
      FROM cars c
      WHERE c.active = 1
        AND c.pickup_location LIKE ? COLLATE NOCASE
        ${maxPriceClause}
        AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.car_id = c.id
            AND b.status IN ('pending','confirmed')
            AND (? < b.end_date) AND (? > b.start_date)
        )
        AND NOT EXISTS (
          SELECT 1 FROM availability_blocks ab
          WHERE ab.car_id = c.id
            AND (? < ab.end_date) AND (? > ab.start_date)
        )
      ORDER BY c.price_per_day_cents ASC
      `,
      params
    );

    return res.json({ ok: true, cars: rows });
  });

  // Owner: list my cars
  r.get("/mine/list", requireAuth, async (req, res) => {
    const rows = await db.all(
      `SELECT * FROM cars
       WHERE owner_id = ?
       ORDER BY datetime(updated_at) DESC, id DESC`,
      [req.userId]
    );
    return res.json({ ok: true, cars: rows });
  });

  // Get one car (details page)
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

  // Calendar data (bookings + blocks)
  r.get("/:id/calendar", async (req, res) => {
    const carId = Number(req.params.id);
    const car = await db.get("SELECT id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });

    const data = await listBlocksAndBookings(db, carId);
    return res.json({ ok: true, ...data });
  });

  // Owner: add manual unavailable block
  r.post("/:id/blocks", requireAuth, async (req, res) => {
    const carId = Number(req.params.id);
    const { startDate, endDate, reason } = req.body || {};

    const car = await db.get("SELECT id, owner_id FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });
    if (car.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Not owner." });

    const s = String(startDate || "").trim();
    const e = String(endDate || "").trim();
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

  // Owner: delete block
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

  // Create a car listing (Owner) - Builder
  // FIX: default new listings to active=1 so they actually show up in search
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

  // Update price (Owner) + notify watchers (Observer)
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

  // Toggle active (Owner)
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

  // Watch a car (Observer subscription) - supports max price + desired dates
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

    const ws = watchStartDate && String(watchStartDate).trim() !== "" ? String(watchStartDate).trim() : null;
    const we = watchEndDate && String(watchEndDate).trim() !== "" ? String(watchEndDate).trim() : null;

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