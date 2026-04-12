/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Checks whether a car is available for a requested date range.
 */

// =============================================
// OVERLAP CHECKS
// =============================================

export async function hasOverlap(db, carId, startDate, endDate) {
  // Pending and confirmed bookings both block the car.
  const overlapBooking = await db.get(
    `SELECT 1 FROM bookings
     WHERE car_id = ?
       AND status IN ('pending','confirmed')
       AND (? < end_date) AND (? > start_date)
     LIMIT 1`,
    [carId, startDate, endDate]
  );
  if (overlapBooking) return true;

  // Owner availability blocks also count as unavailable dates.
  const overlapBlock = await db.get(
    `SELECT 1 FROM availability_blocks
     WHERE car_id = ?
       AND (? < end_date) AND (? > start_date)
     LIMIT 1`,
    [carId, startDate, endDate]
  );
  return !!overlapBlock;
}

// =============================================
// TIMELINE DATA
// =============================================

export async function listBlocksAndBookings(db, carId) {
  const bookings = await db.all(
    `SELECT id, start_date, end_date, status, total_cents
     FROM bookings
     WHERE car_id = ?
       AND status IN ('pending','confirmed')
     ORDER BY start_date ASC`,
    [carId]
  );

  const blocks = await db.all(
    `SELECT id, start_date, end_date, reason
     FROM availability_blocks
     WHERE car_id = ?
     ORDER BY start_date ASC`,
    [carId]
  );

  return { bookings, blocks };
}
