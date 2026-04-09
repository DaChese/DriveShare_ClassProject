import express from "express";
import { requireAuth } from "../middleware/auth.js";
import CarListingBuilder from "../patterns/CarListingBuilder.js";
import { notifyWatchers } from "../patterns/WatchNotifier.js";
import { hasOverlap, listBlocksAndBookings } from "../services/availability.js";

export default function carRoutes(db) {
  const r = express.Router();

  // Search (Location + date range + optional max price)
  r.get("/search", async (req, res) => {
    const { location, start, end, maxPrice } = req.query || {};
    const loc = String(location || "").trim();
    const startDate = String(start || "").trim();
    const endDate = String(end || "").trim();

    if (!loc || !startDate || !endDate) {
      return res.status(400).json({ ok: false, error: "Need location, start, end." });
    }

    const params = [loc];
    let maxPriceClause = "";
    if (maxPrice != null && String(maxPrice).trim() !== "") {
      maxPriceClause = " AND c.price_per_day_cents <= ? ";
      params.push(Math.round(Number(maxPrice) * 100));
    }

    // overlap params
    params.push(startDate, endDate, startDate, endDate);

    // Exclude cars with overlapping pending/confirmed bookings OR manual blocks
    const rows = await db.all(
      `
      SELECT c.*
      FROM cars c
      WHERE c.active = 1
        AND c.pickup_location = ?
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

    const car = await db.get("SELECT id, owner_id, price_per_day_cents FROM cars WHERE id = ?", [carId]);
    if (!car) return res.status(404).json({ ok: false, error: "Car not found." });
    if (car.owner_id !== req.userId) return res.status(403).json({ ok: false, error: "Not owner." });
    if (!startDate || !endDate) return res.status(400).json({ ok: false, error: "Need startDate and endDate." });

    await db.run(
      "INSERT INTO availability_blocks(car_id, start_date, end_date, reason) VALUES(?,?,?,?)",
      [carId, String(startDate), String(endDate), reason ? String(reason) : null]
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
  r.post("/", requireAuth, async (req, res) => {
    const { title, make, model, year, mileage, pickupLocation, pricePerDay } = req.body || {};
    if (!title || !make || !model || !year || mileage == null || !pickupLocation || pricePerDay == null) {
      return res.status(400).json({ ok: false, error: "Missing fields." });
    }

    const builder = new CarListingBuilder(req.userId)
      .title(String(title))
      .make(String(make))
      .model(String(model))
      .year(Number(year))
      .mileage(Number(mileage))
      .pickupLocation(String(pickupLocation))
      .pricePerDayCents(Math.round(Number(pricePerDay) * 100));

    const car = builder.build();

    const result = await db.run(
      `INSERT INTO cars(owner_id,title,make,model,year,mileage,pickup_location,price_per_day_cents,active,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [car.owner_id, car.title, car.make, car.model, car.year, car.mileage, car.pickup_location, car.price_per_day_cents, car.active, car.updated_at]
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

    const cents = Math.round(Number(pricePerDay) * 100);
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

  // Watch a car (Observer subscription) - now supports max price + desired dates
  r.post("/:id/watch", requireAuth, async (req, res) => {
    const carId = Number(req.params.id);
    const { maxPricePerDay, watchStartDate, watchEndDate } = req.body || {};

    const cents =
      maxPricePerDay == null || String(maxPricePerDay).trim() === ""
        ? null
        : Math.round(Number(maxPricePerDay) * 100);

    const ws = watchStartDate && String(watchStartDate).trim() !== "" ? String(watchStartDate).trim() : null;
    const we = watchEndDate && String(watchEndDate).trim() !== "" ? String(watchEndDate).trim() : null;

    await db.run(
      `INSERT OR REPLACE INTO watches(user_id, car_id, max_price_per_day_cents, watch_start_date, watch_end_date)
       VALUES(?,?,?,?,?)`,
      [req.userId, carId, cents, ws, we]
    );

    return res.json({ ok: true });
  });

  return r;
}
