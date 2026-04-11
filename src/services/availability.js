
// =============================================
// AVAILABILITY SERVICE
// Car availability checking utilities
// Updated: 2024-12-19
// =============================================

// Check if a date range overlaps with bookings or blocks //
// Works by checking: is new booking's start before existing end? AND new end after existing start? ////
// Heads up: checks both pending/confirmed bookings and manual availability blocks //////
// Watch for: multiple overlaps, edge dates //
export async function hasOverlap(db, carId, startDate, endDate) {
  // overlap rule: (newStart < existingEnd) AND (newEnd > existingStart)
  const overlapBooking = await db.get(
    `SELECT 1 FROM bookings
     WHERE car_id = ?
       AND status IN ('pending','confirmed')
       AND (? < end_date) AND (? > start_date)
     LIMIT 1`,
    [carId, startDate, endDate]
  );
  if (overlapBooking) return true;

  const overlapBlock = await db.get(
    `SELECT 1 FROM availability_blocks
     WHERE car_id = ?
       AND (? < end_date) AND (? > start_date)
     LIMIT 1`,
    [carId, startDate, endDate]
  );
  return !!overlapBlock;
}

// Get all bookings and blocks for a car ////
// Pull both active bookings (pending/confirmed) and owner-set availability blocks //////  
// Returns: { bookings: [...], blocks: [...] }, sorted by date so we can see the timeline //
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
