/*
 * Author: Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Sends watch notifications when a car matches a renter's saved rules.
 */

// =============================================
// IMPORTS
// =============================================

import { hasOverlap } from "../services/availability.js";

// =============================================
// WATCH NOTIFIER
// =============================================

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
    // skip this watcher if the current car price is still above their target ///
    if (w.max_price_per_day_cents != null && car.price_per_day_cents != null) {
      if (car.price_per_day_cents > w.max_price_per_day_cents) continue;
    }

    // For date-based watches, only notify when the listing is active and the watched window is open.
    if (w.watch_start_date && w.watch_end_date) {
      if (!car.active) continue;

      const overlapped = await hasOverlap(db, carId, w.watch_start_date, w.watch_end_date);
      if (overlapped) continue;
    }

    // this creates one in-app notification for each watcher that matches. ///////
    await db.run(
      "INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [w.user_id, "watch", eventText]
    );
  }
}
