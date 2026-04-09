
import { hasOverlap } from "../services/availability.js";

// Observer-ish: Watch records are our observers.
// Notify watchers when the car changes (price/availability) AND their conditions match.
export async function notifyWatchers(db, carId, eventText) {
  const car = await db.get("SELECT price_per_day_cents, active FROM cars WHERE id = ?", [carId]);
  if (!car) return;

  const watches = await db.all(
    `SELECT w.user_id, w.max_price_per_day_cents, w.watch_start_date, w.watch_end_date
     FROM watches w
     WHERE w.car_id = ?`,
    [carId]
  );

  for (const w of watches) {
    // price condition
    if (w.max_price_per_day_cents != null && car.price_per_day_cents != null) {
      if (car.price_per_day_cents > w.max_price_per_day_cents) continue;
    }

    // date-range condition (only notify if the car is actually free in that range)
    if (w.watch_start_date && w.watch_end_date) {
      // if the listing is inactive, treat as unavailable
      if (!car.active) continue;

      const overlapped = await hasOverlap(db, carId, w.watch_start_date, w.watch_end_date);
      if (overlapped) continue;
    }

    await db.run(
      "INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [w.user_id, "watch", eventText]
    );
  }
}
