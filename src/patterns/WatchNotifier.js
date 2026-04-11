
/*
 * Author:
 * Created on: April 11, 2026
 * Last updated: April 11, 2026
 * Purpose: Observer pattern for car watch notifications
 */

// =============================================
// WATCH NOTIFIER (OBSERVER PATTERN)
// =============================================

import { hasOverlap } from "../services/availability.js";

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
    // Price condition check
    if (w.max_price_per_day_cents != null && car.price_per_day_cents != null) {
      if (car.price_per_day_cents > w.max_price_per_day_cents) continue;
    }

    // Date range availability condition check
    if (w.watch_start_date && w.watch_end_date) {
      if (!car.active) continue;

      const overlapped = await hasOverlap(db, carId, w.watch_start_date, w.watch_end_date);
      if (overlapped) continue;
    }

    // Conditions met - create notification for this observer
    await db.run(
      "INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [w.user_id, "watch", eventText]
    );
  }
}
