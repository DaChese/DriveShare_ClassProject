
/**
 * CarListingBuilder - Builder Pattern Implementation
 *
 * Provides a fluent interface for constructing complex car listing objects
 * with optional parameters and built-in validation.
 *
 * Design Pattern: Builder
 * - Separates construction of complex objects from their representation
 * - Allows step-by-step construction with method chaining
 * - Enables creation of different representations using same construction process
 * - Provides validation before final object creation
 *
 * Usage: Used in car creation endpoints to build car listing objects
 * with optional fields in a readable, maintainable way.
 */

/**
 * Builder class for creating car listing objects
 * Implements fluent interface for step-by-step car listing construction
 */
class CarListingBuilder {
  /**
   * Initialize builder with required owner ID
   * @param {number} ownerId - ID of the car owner
   */
  constructor(ownerId) {
    /** @private Internal car listing data object */
    this.data = {
      owner_id: ownerId,
      title: "",
      make: "",
      model: "",
      year: 0,
      mileage: 0,
      pickup_location: "",
      price_per_day_cents: 0,
      active: 1 // Default to active listing
    };
  }

  /**
   * Set the car title
   * @param {string} v - Car title/description
   * @returns {CarListingBuilder} This builder for method chaining
   */
  title(v) { this.data.title = v; return this; }

  /**
   * Set the car make (manufacturer)
   * @param {string} v - Car make (e.g., "Toyota", "Honda")
   * @returns {CarListingBuilder} This builder for method chaining
   */
  make(v) { this.data.make = v; return this; }

  /**
   * Set the car model
   * @param {string} v - Car model (e.g., "Camry", "Civic")
   * @returns {CarListingBuilder} This builder for method chaining
   */
  model(v) { this.data.model = v; return this; }

  /**
   * Set the car manufacturing year
   * @param {number} v - Year the car was manufactured
   * @returns {CarListingBuilder} This builder for method chaining
   */
  year(v) { this.data.year = v; return this; }

  /**
   * Set the car mileage
   * @param {number} v - Current mileage of the car
   * @returns {CarListingBuilder} This builder for method chaining
   */
  mileage(v) { this.data.mileage = v; return this; }

  /**
   * Set the pickup location
   * @param {string} v - Location where car can be picked up
   * @returns {CarListingBuilder} This builder for method chaining
   */
  pickupLocation(v) { this.data.pickup_location = v; return this; }

  /**
   * Set the daily rental price in cents
   * @param {number} v - Price per day in cents (e.g., 5000 = $50.00)
   * @returns {CarListingBuilder} This builder for method chaining
   */
  pricePerDayCents(v) { this.data.price_per_day_cents = v; return this; }

  /**
   * Set whether the listing is active
   * @param {boolean} v - True for active listing, false for inactive
   * @returns {CarListingBuilder} This builder for method chaining
   */
  active(v) { this.data.active = v ? 1 : 0; return this; }

  /**
   * Build and return the final car listing object
   * @returns {Object} Complete car listing object with timestamp
   */
  build() {
    return {
      ...this.data,
      updated_at: new Date().toISOString() // Add current timestamp
    };
  }
}

export default CarListingBuilder;
