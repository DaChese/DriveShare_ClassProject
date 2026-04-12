/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Centralizes the car search and browse rules.
 */

// =============================================
// SEARCH MEDIATOR
// =============================================

class SearchMediator {
  constructor(db) {
    this.db = db;
  }

  // Used for renter trip searches with location, dates, and optional price cap.
  async searchCars(criteria) {
    const { location, startDate, endDate, maxPrice, limit = 500 } = criteria;

    let query = `
      SELECT c.*
      FROM cars c
      WHERE c.active = 1
        AND c.price_per_day_cents > 0
    `;
    const params = [];

    if (location) {
      query += " AND c.pickup_location LIKE ? COLLATE NOCASE";
      params.push(`%${location}%`);
    }

    if (maxPrice != null) {
      const cents = Math.round(maxPrice * 100);
      query += " AND c.price_per_day_cents <= ?";
      params.push(cents);
    }

    // Business rule: do not return cars that overlap an active booking or owner block.
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

    query += " ORDER BY c.price_per_day_cents ASC LIMIT ?";
    params.push(Math.min(limit, 500));

    return await this.db.all(query, params);
  }

  // Used when the user is browsing without a full trip search yet.
  async browseCars(criteria) {
    const { location, maxPrice, limit = 500 } = criteria;

    let query = "SELECT c.* FROM cars c WHERE c.active = 1 AND c.price_per_day_cents > 0";
    const params = [];

    if (location) {
      query += " AND c.pickup_location LIKE ? COLLATE NOCASE";
      params.push(`%${location}%`);
    }

    if (maxPrice != null) {
      const cents = Math.round(maxPrice * 100);
      query += " AND c.price_per_day_cents <= ?";
      params.push(cents);
    }

    query += " ORDER BY c.price_per_day_cents ASC LIMIT ?";
    params.push(Math.min(limit, 500));

    return await this.db.all(query, params);
  }

  // Edge-case checks shared by both browse and search endpoints.
  validateCriteria(criteria) {
    const { location, startDate, endDate, maxPrice } = criteria;

    if (!location && criteria.requireLocation) {
      return { ok: false, error: "Location is required." };
    }

    if (startDate && endDate) {
      if (!this.isValidISODate(startDate) || !this.isValidISODate(endDate)) {
        return { ok: false, error: "Dates must be in YYYY-MM-DD format." };
      }

      if (Date.parse(endDate) <= Date.parse(startDate)) {
        return { ok: false, error: "End date must be after start date." };
      }
    }

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
