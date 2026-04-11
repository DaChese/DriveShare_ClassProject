
/**
 * WatchNotifier - Observer Pattern Implementation
 *
 * Implements the Observer pattern to notify users when car listings change
 * according to their watch criteria (price changes, availability updates).
 *
 * Design Pattern: Observer
 * - Car listings act as the "subject" being observed
 * - Watch records in database serve as "observers"
 * - Notifications are sent when subject state changes meet observer criteria
 *
 * Usage: Called whenever car prices change or availability is modified
 * to alert interested users via in-app notifications.
 */

import { hasOverlap } from "../services/availability.js";

/**
 * Notify all watchers for a specific car when conditions are met
 *
 * This function implements the Observer pattern where:
 * - Subject: Car listing (price_per_day_cents, active status)
 * - Observers: Watch records with user-defined criteria
 * - Notification: Database notification record creation
 *
 * @param {Database} db - SQLite database instance
 * @param {number} carId - ID of the car that changed
 * @param {string} eventText - Description of the change event
 * @returns {Promise<void>}
 */
export async function notifyWatchers(db, carId, eventText) {
  // Get current car state (the "subject" being observed)
  const car = await db.get("SELECT price_per_day_cents, active FROM cars WHERE id = ?", [carId]);
  if (!car) return; // Car no longer exists

  // Get all observers (watch records) for this car
  const watches = await db.all(
    `SELECT w.user_id, w.max_price_per_day_cents, w.watch_start_date, w.watch_end_date
     FROM watches w
     WHERE w.car_id = ?`,
    [carId]
  );

  // Check each observer's criteria and notify if conditions met
  for (const w of watches) {
    // Price condition check
    if (w.max_price_per_day_cents != null && car.price_per_day_cents != null) {
      if (car.price_per_day_cents > w.max_price_per_day_cents) continue; // Price too high
    }

    // Date range availability condition check
    if (w.watch_start_date && w.watch_end_date) {
      // Inactive listings are treated as unavailable
      if (!car.active) continue;

      // Check if car is actually available for the requested dates
      const overlapped = await hasOverlap(db, carId, w.watch_start_date, w.watch_end_date);
      if (overlapped) continue; // Car is booked during requested period
    }

    // Conditions met - create notification for this observer
    await db.run(
      "INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)",
      [w.user_id, "watch", eventText]
    );
  }
}
