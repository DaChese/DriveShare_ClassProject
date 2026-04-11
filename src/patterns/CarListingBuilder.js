
// =============================================
// FILE: CarListingBuilder.js
// Builder pattern for car listing objects
// Created: 2024-12-19
// Updated: 2024-12-19
// =============================================

// Builder pattern for car listings
// Used in car creation endpoints to build objects with optional fields
class CarListingBuilder {
  // Initialize with required owner ID
  constructor(ownerId) {
    this.data = {
      owner_id: ownerId,
      title: "",
      make: "",
      model: "",
      year: 0,
      mileage: 0,
      pickup_location: "",
      price_per_day_cents: 0,
      active: 1 // Default active
    };
  }

  // Set car title
  title(v) { this.data.title = v; return this; }

  // Set car make
  make(v) { this.data.make = v; return this; }

  // Set car model
  model(v) { this.data.model = v; return this; }

  // Set manufacturing year
  year(v) { this.data.year = v; return this; }

  // Set current mileage
  mileage(v) { this.data.mileage = v; return this; }

  // Set pickup location
  pickupLocation(v) { this.data.pickup_location = v; return this; }

  // Set daily price in cents
  pricePerDayCents(v) { this.data.price_per_day_cents = v; return this; }

  // Set active status (boolean to int conversion)
  active(v) { this.data.active = v ? 1 : 0; return this; }

  // Build final object with timestamp
  // DB side-effect: adds updated_at timestamp on creation
  build() {
    return {
      ...this.data,
      updated_at: new Date().toISOString()
    };
  }
}

export default CarListingBuilder;
