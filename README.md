# DriveShare

Aldo Medina and Rania Dayekh

DriveShare is a car-sharing web app built with Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript. It focuses on the main owner and renter flows while also showing six design patterns.

## Overview

DriveShare lets:
- owners list cars, manage price and availability, and communicate with renters
- renters browse and search for cars, watch listings, book cars, pay, message owners, and review the experience

The project also uses these design patterns:
- Singleton
- Observer
- Mediator
- Builder
- Proxy
- Chain of Responsibility


### User Registration and Authentication
- Users register with email, password, and display name.
- Registration requires exactly 3 security questions with answers.
- Users can log in, log out, and recover a password by answering those 3 questions.
- Passwords and recovery answers are hashed with `bcryptjs`.

Main files:
- `src/routes/auth.js`
- `src/patterns/SessionManager.js`
- `src/patterns/PasswordRecoveryChain.js`

### Car Listing and Management (Owner)
- Owners can create car listings with:
  - title
  - make/model/year
  - mileage
  - pickup location
  - rental price
- Owners can:
  - view their own listings
  - change listing price
  - toggle active status
  - add and remove availability blocks
- The app prevents overlapping rentals and blocks from colliding with bookings.

Main files:
- `src/routes/cars.js`
- `src/services/availability.js`
- `src/patterns/CarListingBuilder.js`
- `public/owner.html`

### Search and Booking (Renter)
- Renters can browse the full active inventory.
- Renters can search cars by:
  - location
  - start date
  - end date
  - max price
- Renters can watch a car and get notified when:
  - the price drops to their target
  - the car becomes available for the watched date range
- Renters can create a booking for a specific period.
- The booking starts as `pending` and is confirmed after payment.

Main files:
- `src/routes/cars.js`
- `src/routes/bookings.js`
- `src/patterns/SearchMediator.js`
- `src/patterns/WatchNotifier.js`
- `public/index.html`
- `public/renter.html`
- `public/car.html`

### Messaging and Communication
- The app includes an inbox-style message system between owners and renters.
- Conversations are tied to a specific car.
- Owners can only message renters who are actually tied to that car by a booking or an existing valid thread.
- Message notifications are sent in-app and email notifications can also be triggered.

Main files:
- `src/routes/messages.js`
- `src/routes/notifications.js`
- `src/services/emailService.js`
- `public/messages.html`
- `public/notifications.html`

### Payment
- The project uses a simulated payment step.
- A renter clicks a payment button for a pending booking.
- Payment changes balances, records the payment row, confirms the booking, and notifies both parties.

Main files:
- `src/routes/bookings.js`
- `src/patterns/PaymentProxy.js`
- `public/car.html`
- `public/history.html`

### Rental History and Reviews
- Both renters and owners can view booking history.
- The renter can review the car.
- The owner can review the renter.
- Reviews appear in the rental history flow and create notifications.

Main files:
- `src/routes/bookings.js`
- `public/history.html`

## Design Patterns

### 1. Singleton
- Class: `SessionManager`
- One shared session store keeps auth state in one place.
- Auth routes and middleware use the same instance.

### 2. Observer
- Class/function: `notifyWatchers` in `WatchNotifier`
- Renters subscribe to car conditions with watch settings.
- Car changes trigger notifications to matching watchers.

### 3. Mediator
- Class: `SearchMediator`
- Search and browse rules are centralized in one place.
- Location, dates, and price filters are coordinated there.

### 4. Builder
- Class: `CarListingBuilder`
- Owner listing objects are built step by step.
- Optional and standard fields are assembled in one fluent builder.

### 5. Proxy
- Classes: `PaymentProxy` and `RealPaymentService`
- The proxy checks who is paying and validates the amount.
- Then it forwards the payment to the real service.

### 6. Chain of Responsibility
- Classes/functions: `QuestionHandler` and `buildRecoveryChain`
- Each security question is checked in sequence.
- The flow stops as soon as one answer fails.

## Tech Stack

### Backend
- Node.js
- Express
- SQLite
- `bcryptjs`
- `uuid`
- `nodemailer`

### Frontend
- HTML
- CSS
- JavaScript

## Main Pages

- `/` - root
- `/login.html` - login
- `/register.html` - registration
- `/recover.html` - password recovery
- `/owner.html` - owner listing management
- `/renter.html` - renter search page
- `/car.html?id=ID` - car details, booking, watch, and payment flow
- `/messages.html` - inbox and conversation threads
- `/notifications.html` - in-app notifications
- `/history.html` - booking history, payment actions, and reviews

## API Summary

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/recover`

### Cars
- `GET /api/cars/browse`
- `GET /api/cars/search`
- `GET /api/cars/mine/list`
- `GET /api/cars/:id`
- `GET /api/cars/:id/calendar`
- `POST /api/cars/:id/blocks`
- `POST /api/cars/:id/blocks/:blockId/delete`
- `POST /api/cars`
- `POST /api/cars/:id/price`
- `POST /api/cars/:id/active`
- `POST /api/cars/:id/watch`

### Bookings
- `POST /api/bookings`
- `POST /api/bookings/:id/pay`
- `POST /api/bookings/:id/cancel`
- `GET /api/bookings/history`
- `POST /api/bookings/:id/review`

### Messages
- `GET /api/messages/conversations`
- `GET /api/messages/thread`
- `POST /api/messages`
- `POST /api/messages/:id/read`

### Notifications
- `GET /api/notifications`
- `POST /api/notifications/:id/read`

### Other
- `GET /api/users/:id`
- `GET /api/photos/unsplash`
- `GET /api/dev/seed-status`
- `POST /api/dev/seed-cars`
- `POST /api/dev/clear-seeded-cars`
- `POST /api/dev/reset-seeded-cars`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize the database

```bash
npm run initdb
```

This step is important because the project a lightweight schema updates in `scripts/init_db.js`. Running it applies the current schema to an existing `driveshare.sqlite` file.

### 3. Start the server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Demo Data

The project includes dev seed routes to help with demos.

Examples:

```bash
POST /api/dev/seed-cars
POST /api/dev/reset-seeded-cars
GET /api/dev/seed-status
```

These routes create tagged demo cars for the logged-in owner so demo data can be reset without wiping the whole database.

## Security Notes

- Passwords are hashed with `bcryptjs`.
- Recovery answers are hashed with `bcryptjs`.
- Sessions use an in-memory singleton session manager.
- Authenticated routes use middleware checks.
- Owner/renter actions are checked before bookings, payments, and messages are allowed.

## Project Structure

```
DriveShare_ClassProject/
|-- server.js
|-- package.json
|-- README.md
|-- PATTERN_DOCUMENTATION.md
|-- driveshare.sqlite
|-- db/
|   `-- schema.sql
|-- public/
|   |-- index.html
|   |-- owner.html
|   |-- renter.html
|   |-- car.html
|   |-- messages.html
|   |-- notifications.html
|   |-- history.html
|   |-- login.html
|   |-- register.html
|   `-- recover.html
|-- scripts/
|   `-- init_db.js
`-- src/
    |-- db.js
    |-- middleware/
    |   `-- auth.js
    |-- patterns/
    |   |-- SessionManager.js
    |   |-- WatchNotifier.js
    |   |-- SearchMediator.js
    |   |-- CarListingBuilder.js
    |   |-- PaymentProxy.js
    |   `-- PasswordRecoveryChain.js
    |-- routes/
    |   |-- auth.js
    |   |-- bookings.js
    |   |-- cars.js
    |   |-- messages.js
    |   |-- notifications.js
    |   |-- users.js
    |   |-- photos.js
    |   `-- devSeed.js
    `-- services/
        |-- availability.js
        `-- emailService.js
```
