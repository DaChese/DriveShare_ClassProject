
class CarListingBuilder {
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
      active: 1
    };
  }

  title(v) { this.data.title = v; return this; }
  make(v) { this.data.make = v; return this; }
  model(v) { this.data.model = v; return this; }
  year(v) { this.data.year = v; return this; }
  mileage(v) { this.data.mileage = v; return this; }
  pickupLocation(v) { this.data.pickup_location = v; return this; }
  pricePerDayCents(v) { this.data.price_per_day_cents = v; return this; }
  active(v) { this.data.active = v ? 1 : 0; return this; }

  build() {
    return { ...this.data, updated_at: new Date().toISOString() };
  }
}

export default CarListingBuilder;
