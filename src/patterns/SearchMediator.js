/*
 * Author:
 * Created on: April 11, 2026
 * Last updated: April 11, 2026
 * Purpose: Mediator pattern for coordinating car search operations
 */

// =============================================
// SEARCH MEDIATOR (MEDIATOR PATTERN)
// =============================================

class SearchMediator {
  constructor(db) {
    this.db = db;
  }

  async searchCars(criteria) {
    const { location, startDate, endDate, maxPrice, limit = 500 } = criteria;

    let query = `
      SELECT c.*
      FROM cars c
      WHERE c.active = 1
        AND c.price_per_day_cents > 0
    `;
    const params = [];

    // Apply location filtering
    if (location) {
      query += " AND c.pickup_location LIKE ? COLLATE NOCASE";
      params.push(`%${location}%`);
    }

    // Apply price filtering
    if (maxPrice != null) {
      const cents = Math.round(maxPrice * 100);
      query += " AND c.price_per_day_cents <= ?";
      params.push(cents);
    }

    // Apply date availability filtering
    if (startDate && endDate) {
      query += `
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
      `;
      params.push(startDate, endDate, startDate, endDate);
    }

    // Apply ordering and limit
    query += " ORDER BY c.price_per_day_cents ASC LIMIT ?";
    params.push(Math.min(limit, 500));

    return await this.db.all(query, params);
  }

  async browseCars(criteria) {
    const { location, maxPrice, limit = 500 } = criteria;

    let query = "SELECT c.* FROM cars c WHERE c.active = 1 AND c.price_per_day_cents > 0";
    const params = [];

    // Location filtering
    if (location) {
      query += " AND c.pickup_location LIKE ? COLLATE NOCASE";
      params.push(`%${location}%`);
    }

    // Price filtering
    if (maxPrice != null) {
      const cents = Math.round(maxPrice * 100);
      query += " AND c.price_per_day_cents <= ?";
      params.push(cents);
    }

    query += " ORDER BY c.price_per_day_cents ASC LIMIT ?";
    params.push(Math.min(limit, 500));

    return await this.db.all(query, params);
  }

  validateCriteria(criteria) {
    const { location, startDate, endDate, maxPrice } = criteria;

    // Location is required for search (but optional for browse)
    if (!location && criteria.requireLocation) {
      return { ok: false, error: "Location is required." };
    }

    // Validate dates if provided
    if (startDate && endDate) {
      if (!this.isValidISODate(startDate) || !this.isValidISODate(endDate)) {
        return { ok: false, error: "Dates must be in YYYY-MM-DD format." };
      }

      if (Date.parse(endDate) <= Date.parse(startDate)) {
        return { ok: false, error: "End date must be after start date." };
      }
    }

    // Validate price if provided
    if (maxPrice != null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
      return { ok: false, error: "Invalid maximum price." };
    }

    return { ok: true };
  }

  isValidISODate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    return !Number.isNaN(Date.parse(dateStr));
  }
}

export default SearchMediator;
