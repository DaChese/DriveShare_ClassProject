// =============================================
// FILE: devSeed.js
// Development seeding routes (demo car data)
// Created: 2024-12-19
// Updated: 2026-04-11
// =============================================

import express from "express";
import { requireAuth } from "../middleware/auth.js";

const DEV_SEED_TAG = "demo-cars-v1";

const DEMO_CARS = [
  { title: "2022 Honda Civic Sport", make: "Honda", model: "Civic", year: 2022, mileage: 32000, pickup_location: "Dearborn, MI", price_per_day_cents: 6500 },
  { title: "2021 Toyota Corolla LE", make: "Toyota", model: "Corolla", year: 2021, mileage: 41000, pickup_location: "Dearborn, MI", price_per_day_cents: 5900 },
  { title: "2019 Mazda 3 Touring", make: "Mazda", model: "3", year: 2019, mileage: 52000, pickup_location: "Dearborn, MI", price_per_day_cents: 5600 },
  { title: "2018 Nissan Altima SV", make: "Nissan", model: "Altima", year: 2018, mileage: 70000, pickup_location: "Dearborn, MI", price_per_day_cents: 5200 },
  { title: "2020 Hyundai Elantra SEL", make: "Hyundai", model: "Elantra", year: 2020, mileage: 46000, pickup_location: "Dearborn, MI", price_per_day_cents: 6100 },
  { title: "2021 BMW 330i", make: "BMW", model: "330i", year: 2021, mileage: 30000, pickup_location: "Dearborn, MI", price_per_day_cents: 13500 },
  { title: "2020 Ford Escape SE", make: "Ford", model: "Escape", year: 2020, mileage: 52000, pickup_location: "Detroit, MI", price_per_day_cents: 7200 },
  { title: "2019 Jeep Grand Cherokee", make: "Jeep", model: "Grand Cherokee", year: 2019, mileage: 61000, pickup_location: "Detroit, MI", price_per_day_cents: 8900 },
  { title: "2023 Tesla Model 3", make: "Tesla", model: "Model 3", year: 2023, mileage: 12000, pickup_location: "Detroit, MI", price_per_day_cents: 11500 },
  { title: "2017 Chevrolet Malibu LT", make: "Chevrolet", model: "Malibu", year: 2017, mileage: 78000, pickup_location: "Detroit, MI", price_per_day_cents: 4800 },
  { title: "2022 Subaru Forester Premium", make: "Subaru", model: "Forester", year: 2022, mileage: 26000, pickup_location: "Detroit, MI", price_per_day_cents: 9400 },
  { title: "2020 Kia Sportage LX", make: "Kia", model: "Sportage", year: 2020, mileage: 54000, pickup_location: "Detroit, MI", price_per_day_cents: 6900 },
  { title: "2022 Subaru Outback Premium", make: "Subaru", model: "Outback", year: 2022, mileage: 28000, pickup_location: "Ann Arbor, MI", price_per_day_cents: 9200 },
  { title: "2021 Volkswagen Jetta SE", make: "Volkswagen", model: "Jetta", year: 2021, mileage: 36000, pickup_location: "Ann Arbor, MI", price_per_day_cents: 6700 },
  { title: "2023 Tesla Model Y", make: "Tesla", model: "Model Y", year: 2023, mileage: 14000, pickup_location: "Ann Arbor, MI", price_per_day_cents: 13500 },
  { title: "2020 Audi A4 Premium", make: "Audi", model: "A4", year: 2020, mileage: 34000, pickup_location: "Royal Oak, MI", price_per_day_cents: 12800 },
  { title: "2019 Ford F-150 XLT", make: "Ford", model: "F-150", year: 2019, mileage: 62000, pickup_location: "Southfield, MI", price_per_day_cents: 9800 },
  { title: "2021 Toyota RAV4 XLE", make: "Toyota", model: "RAV4", year: 2021, mileage: 29000, pickup_location: "Dearborn, MI", price_per_day_cents: 9900 },
];

function normalizeSeedList(body) {
  const limit = Math.max(1, Math.min(100, Number(body.limit || DEMO_CARS.length) || DEMO_CARS.length));
  const locations = Array.isArray(body.locations) ? body.locations.map((s) => String(s).trim()).filter(Boolean) : null;

  let list = [...DEMO_CARS];
  if (locations && locations.length) {
    const set = new Set(locations.map((s) => s.toLowerCase()));
    list = list.filter((c) => set.has(String(c.pickup_location).toLowerCase()));
  }
  return list.slice(0, limit);
}

async function clearSeededCars(db, ownerId) {
  const seededCars = await db.all(
    "SELECT id FROM cars WHERE owner_id = ? AND seed_tag = ?",
    [ownerId, DEV_SEED_TAG]
  );

  let deleted = 0;
  for (const car of seededCars) {
    const result = await db.run("DELETE FROM cars WHERE id = ? AND owner_id = ?", [car.id, ownerId]);
    deleted += result.changes || 0;
  }

  return deleted;
}

export default function devSeedRoutes(db) {
  const r = express.Router();

  // GET /api/dev/seed-status
  // Return which demo cars currently exist for the logged-in owner
  r.get("/seed-status", requireAuth, async (req, res) => {
    const ownerId = req.userId;
    const rows = await db.all(
      `SELECT id, title, pickup_location, price_per_day_cents, seed_tag
       FROM cars
       WHERE owner_id = ? AND seed_tag = ?
       ORDER BY id ASC`,
      [ownerId, DEV_SEED_TAG]
    );

    return res.json({ ok: true, seedTag: DEV_SEED_TAG, count: rows.length, cars: rows });
  });

  // POST /api/dev/seed-cars
  // Optional body: { limit, locations, clearExisting }
  r.post("/seed-cars", requireAuth, async (req, res) => {
    const ownerId = req.userId;
    const now = new Date().toISOString();
    const body = req.body || {};
    const clearExisting = Boolean(body.clearExisting);
    const list = normalizeSeedList(body);

    let cleared = 0;
    if (clearExisting) {
      cleared = await clearSeededCars(db, ownerId);
    }

    const insertedIds = [];
    let skipped = 0;

    for (const c of list) {
      const existing = await db.get(
        "SELECT id FROM cars WHERE owner_id = ? AND title = ? AND pickup_location = ? LIMIT 1",
        [ownerId, c.title, c.pickup_location]
      );
      if (existing) {
        skipped++;
        continue;
      }

      const result = await db.run(
        `INSERT INTO cars(owner_id,title,make,model,year,mileage,pickup_location,price_per_day_cents,seed_tag,active,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [ownerId, c.title, c.make, c.model, c.year, c.mileage, c.pickup_location, c.price_per_day_cents, DEV_SEED_TAG, 1, now]
      );
      insertedIds.push(result.lastID);
    }

    return res.json({
      ok: true,
      seedTag: DEV_SEED_TAG,
      inserted: insertedIds.length,
      skipped,
      cleared,
      carIds: insertedIds
    });
  });

  // POST /api/dev/clear-seeded-cars
  // Remove only the logged-in owner's demo-seeded cars
  r.post("/clear-seeded-cars", requireAuth, async (req, res) => {
    const deleted = await clearSeededCars(db, req.userId);
    return res.json({ ok: true, seedTag: DEV_SEED_TAG, deleted });
  });

  // POST /api/dev/reset-seeded-cars
  // Clear then reseed the selected demo inventory
  r.post("/reset-seeded-cars", requireAuth, async (req, res) => {
    const ownerId = req.userId;
    const now = new Date().toISOString();
    const body = req.body || {};
    const list = normalizeSeedList(body);
    const deleted = await clearSeededCars(db, ownerId);
    const insertedIds = [];

    for (const c of list) {
      const result = await db.run(
        `INSERT INTO cars(owner_id,title,make,model,year,mileage,pickup_location,price_per_day_cents,seed_tag,active,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [ownerId, c.title, c.make, c.model, c.year, c.mileage, c.pickup_location, c.price_per_day_cents, DEV_SEED_TAG, 1, now]
      );
      insertedIds.push(result.lastID);
    }

    return res.json({
      ok: true,
      seedTag: DEV_SEED_TAG,
      deleted,
      inserted: insertedIds.length,
      carIds: insertedIds
    });
  });

  return r;
}
