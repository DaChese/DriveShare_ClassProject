# DriveShare Design Patterns Documentation

## Overview

DriveShare implements six fundamental design patterns as required for the Software Architecture and Design course. Each pattern is carefully integrated into the application architecture to demonstrate real-world usage and best practices.

## 1. Singleton Pattern - SessionManager

### Purpose
The SessionManager ensures that only one instance of session management exists throughout the application lifecycle, providing centralized session state management.

### Implementation
```javascript
class SessionManager {
  constructor() {
    if (SessionManager.instance) {
      return SessionManager.instance;
    }
    this.sessions = new Map();
    SessionManager.instance = this;
  }

  static getInstance() {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }
}
```

### Class Diagram
```
┌─────────────────┐
│  SessionManager │
├─────────────────┤
│  - sessions     │
│  - instance     │
├─────────────────┤
│  + getInstance()│
│  + create()     │
│  + get()        │
│  + destroy()    │
└─────────────────┘
```

### Role Mapping
- **Singleton**: SessionManager class
- **Client**: Authentication middleware and route handlers
- **Usage**: User session management across the application

### Benefits
- **Global Access**: Single point of access to session data
- **Memory Efficiency**: Only one instance exists
- **Thread Safety**: Controlled instantiation prevents race conditions

## 2. Observer Pattern - WatchNotifier

### Purpose
The WatchNotifier implements the Observer pattern to notify users when car listings change according to their watch criteria (price drops, availability changes).

### Implementation
```javascript
export async function notifyWatchers(db, carId, eventText) {
  // Get car details
  const car = await db.get("SELECT price_per_day_cents, active FROM cars WHERE id = ?", [carId]);

  // Get all watchers for this car
  const watches = await db.all("SELECT user_id, max_price_per_day_cents, watch_start_date, watch_end_date FROM watches WHERE car_id = ?", [carId]);

  // Notify each watcher that meets criteria
  for (const watch of watches) {
    if (meetsNotificationCriteria(watch, car)) {
      await db.run("INSERT INTO notifications(user_id, type, text) VALUES(?,?,?)", [watch.user_id, "watch", eventText]);
    }
  }
}
```

### Class Diagram
```
┌─────────────────┐          ┌─────────────────┐
│   WatchNotifier │          │     Watcher     │
├─────────────────┤          ├─────────────────┤
│                 │◄─────────┤  - user_id      │
│  + notifyWatchers() │      │  - criteria     │
└─────────────────┘          └─────────────────┘
                                   │
                                   │
                         ┌─────────────────┐
                         │  Notification   │
                         ├─────────────────┤
                         │  - user_id      │
                         │  - type         │
                         │  - text         │
                         └─────────────────┘
```

### Role Mapping
- **Subject/Observable**: Car listings (price/availability changes)
- **Observer**: Watch records in database
- **Concrete Observer**: User watch preferences
- **Notification**: Database notification records

### Benefits
- **Decoupling**: Car changes don't need to know about watchers
- **Dynamic**: Watchers can be added/removed at runtime
- **Scalable**: Easy to add new notification types

## 3. Mediator Pattern - SearchMediator

### Purpose
The SearchMediator centralizes car search logic, coordinating between different search criteria and database queries to provide unified search results.

### Implementation
```javascript
class SearchMediator {
  constructor(db) {
    this.db = db;
  }

  async searchCars(criteria) {
    let query = "SELECT * FROM cars WHERE active = 1";
    let params = [];

    // Location filtering
    if (criteria.location) {
      query += " AND pickup_location LIKE ?";
      params.push(`%${criteria.location}%`);
    }

    // Date range filtering
    if (criteria.startDate && criteria.endDate) {
      query += ` AND id NOT IN (
        SELECT car_id FROM bookings
        WHERE status IN ('pending','confirmed')
        AND (? < end_date) AND (? > start_date)
      )`;
      params.push(criteria.startDate, criteria.endDate);
    }

    // Price filtering
    if (criteria.maxPrice) {
      query += " AND price_per_day_cents <= ?";
      params.push(criteria.maxPrice * 100);
    }

    return await this.db.all(query, params);
  }
}
```

### Class Diagram
```
┌─────────────────┐          ┌─────────────────┐
│ SearchMediator  │          │   SearchClient  │
├─────────────────┤          ├─────────────────┤
│  - db           │◄─────────┤                 │
├─────────────────┤          └─────────────────┘
│  + searchCars() │                    │
│  + filterByLocation()│               │
│  + filterByDates()   │               │
│  + filterByPrice()   │               │
└─────────────────┘                    │
                              ┌─────────────────┐
                              │   Car Results   │
                              └─────────────────┘
```

### Role Mapping
- **Mediator**: SearchMediator class
- **Colleagues**: Location filter, Date filter, Price filter
- **Client**: Car search API endpoint

### Benefits
- **Centralized Logic**: All search logic in one place
- **Maintainable**: Easy to modify search criteria
- **Extensible**: New filters can be added easily

## 4. Builder Pattern - CarListingBuilder

### Purpose
The CarListingBuilder provides a fluent interface for constructing complex car listing objects with optional parameters and validation.

### Implementation
```javascript
class CarListingBuilder {
  constructor() {
    this.listing = {};
  }

  setBasicInfo(make, model, year) {
    this.listing.make = make;
    this.listing.model = model;
    this.listing.year = year;
    return this;
  }

  setPricing(pricePerDay) {
    this.listing.price_per_day_cents = Math.round(pricePerDay * 100);
    return this;
  }

  setLocation(location) {
    this.listing.pickup_location = location;
    return this;
  }

  setDescription(description) {
    this.listing.description = description;
    return this;
  }

  setFeatures(features) {
    this.listing.features = JSON.stringify(features);
    return this;
  }

  build() {
    // Validation
    if (!this.listing.make || !this.listing.model || !this.listing.year) {
      throw new Error("Make, model, and year are required");
    }
    if (!this.listing.price_per_day_cents) {
      throw new Error("Price is required");
    }
    return this.listing;
  }
}
```

### Class Diagram
```
┌─────────────────────┐
│ CarListingBuilder   │
├─────────────────────┤
│  - listing          │
├─────────────────────┤
│  + setBasicInfo()   │
│  + setPricing()     │
│  + setLocation()    │
│  + setDescription() │
│  + setFeatures()    │
│  + build()          │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│   CarListing        │
├─────────────────────┤
│  - make             │
│  - model            │
│  - year             │
│  - price            │
│  - location         │
│  - description      │
│  - features         │
└─────────────────────┘
```

### Role Mapping
- **Builder**: CarListingBuilder class
- **Concrete Builder**: Methods for setting different car attributes
- **Product**: Car listing object
- **Director**: Car creation API endpoint

### Benefits
- **Complex Construction**: Handles optional parameters elegantly
- **Validation**: Ensures required fields are present
- **Readable**: Fluent interface makes code self-documenting
- **Flexible**: Easy to add new car attributes

## 5. Proxy Pattern - PaymentProxy

### Purpose
The PaymentProxy provides a protective layer around payment processing, adding logging, validation, and security checks before delegating to the real payment service.

### Implementation
```javascript
class PaymentProxy {
  constructor(realPaymentService) {
    this.realService = realPaymentService;
  }

  async pay(db, userId, bookingId, renterId, ownerId, amountCents) {
    // Pre-processing: validation and logging
    console.log(`Processing payment: $${amountCents/100} for booking ${bookingId}`);

    // Security check: ensure user is authorized
    if (userId !== renterId) {
      return { ok: false, error: "Unauthorized payment attempt" };
    }

    // Business rule: minimum payment
    if (amountCents < 100) { // $1 minimum
      return { ok: false, error: "Payment too small" };
    }

    // Delegate to real service
    const result = await this.realService.pay(db, bookingId, amountCents);

    // Post-processing: logging and notifications
    if (result.ok) {
      console.log(`Payment successful for booking ${bookingId}`);
    } else {
      console.error(`Payment failed for booking ${bookingId}: ${result.error}`);
    }

    return result;
  }
}
```

### Class Diagram
```
┌─────────────────┐          ┌─────────────────────┐
│  PaymentProxy   │          │ RealPaymentService │
├─────────────────┤          ├─────────────────────┤
│  - realService  │◄─────────┤                     │
├─────────────────┤          └─────────────────────┘
│  + pay()        │                    │
└─────────────────┘                    │
        ▲                             │
        │                             │
┌─────────────────┐          ┌─────────────────────┐
│   Client        │          │   Payment Result    │
└─────────────────┘          └─────────────────────┘
```

### Role Mapping
- **Proxy**: PaymentProxy class
- **Real Subject**: RealPaymentService class
- **Subject**: PaymentService interface
- **Client**: Booking payment endpoint

### Benefits
- **Security**: Validates payments before processing
- **Logging**: Tracks all payment attempts
- **Flexibility**: Can add caching, rate limiting, etc.
- **Maintainability**: Payment logic separated from business logic

## 6. Chain of Responsibility - PasswordRecoveryChain

### Purpose
The PasswordRecoveryChain implements a sequential validation process for password recovery, where each handler checks a different security question before allowing password reset.

### Implementation
```javascript
class SecurityQuestionHandler {
  constructor(question, nextHandler = null) {
    this.question = question;
    this.nextHandler = nextHandler;
  }

  async handle(db, userId, answers) {
    const userAnswer = await db.get(
      "SELECT answer FROM security_questions WHERE user_id = ? AND question = ?",
      [userId, this.question]
    );

    if (!userAnswer || userAnswer.answer !== answers[this.question]) {
      throw new Error(`Incorrect answer for: ${this.question}`);
    }

    if (this.nextHandler) {
      return await this.nextHandler.handle(db, userId, answers);
    }

    return true; // All questions answered correctly
  }
}

// Usage in recovery route
const chain = new SecurityQuestionHandler("What was your first pet's name?",
  new SecurityQuestionHandler("What city were you born in?",
    new SecurityQuestionHandler("What was your first school?")
  )
);
```

### Class Diagram
```
┌─────────────────────────┐
│ SecurityQuestionHandler │
├─────────────────────────┤
│  - question             │
│  - nextHandler          │
├─────────────────────────┤
│  + handle()             │
└─────────────────────────┘
              ▲
              │
        ┌─────┴─────┐
        │           │
┌─────────────┐ ┌─────────────┐
│ Question 1  │ │ Question 2  │
└─────────────┘ └─────────────┘
        │           │
        └─────┬─────┘
              │
        ┌─────────────┐
        │ Question 3  │
        └─────────────┘
```

### Role Mapping
- **Handler**: SecurityQuestionHandler class
- **Concrete Handler**: Individual question validators
- **Client**: Password recovery endpoint
- **Request**: Security question answers

### Benefits
- **Modular**: Each question is independently validated
- **Extensible**: Easy to add/remove questions
- **Flexible**: Chain can be reconfigured
- **Fail-fast**: Stops at first incorrect answer

## Pattern Integration Summary

### Architectural Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    DriveShare Application                   │
├─────────────────────────────────────────────────────────────┤
│  Routes: auth, bookings, cars, messages, notifications      │
├─────────────────────────────────────────────────────────────┤
│  Patterns:                                                   │
│  • Singleton (SessionManager) - Global session state        │
│  • Observer (WatchNotifier) - Car change notifications      │
│  • Mediator (SearchMediator) - Unified search logic         │
│  • Builder (CarListingBuilder) - Complex object construction│
│  • Proxy (PaymentProxy) - Payment security & logging        │
│  • Chain of Resp (PasswordRecovery) - Sequential validation │
├─────────────────────────────────────────────────────────────┤
│  Services: email, availability, database                    │
└─────────────────────────────────────────────────────────────┘
```

### Pattern Interactions
- **SessionManager** provides user context for all authenticated operations
- **WatchNotifier** triggers notifications that may use **EmailService**
- **SearchMediator** coordinates complex queries for car listings
- **CarListingBuilder** creates objects that **SearchMediator** filters
- **PaymentProxy** secures transactions that trigger **WatchNotifier** updates
- **PasswordRecoveryChain** validates users for **SessionManager** operations

### Quality Attributes Addressed
- **Maintainability**: Each pattern encapsulates specific concerns
- **Extensibility**: New features can leverage existing patterns
- **Testability**: Patterns enable focused unit testing
- **Security**: Proxy pattern adds security layers
- **Performance**: Mediator centralizes expensive operations
- **Usability**: Builder simplifies complex object creation

This comprehensive pattern implementation demonstrates advanced software design principles while maintaining practical usability and maintainability.</content>
<parameter name="filePath">g:\School_STuff\School_DAnk\CIS 476 Software Arch+Design\TermProject\DriveShare_ClassProject\PATTERN_DOCUMENTATION.md