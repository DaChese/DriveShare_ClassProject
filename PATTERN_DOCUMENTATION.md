# DriveShare Pattern Documentation

## 1. Singleton Pattern

### DriveShare class
- `src/patterns/SessionManager.js`

### What it does
`SessionManager` stores login sessions in one shared in-memory map. Auth routes and auth middleware both use the same instance so session lookups stay consistent across the app.

### Pattern role mapping
- Singleton: `SessionManager`
- Shared instance access: `SessionManager.instance()`
- Clients:
  - `src/routes/auth.js`
  - `src/middleware/auth.js`

### Class diagram

```
+----------------------+
| SessionManager       |
+----------------------+
| - _instance          |
| - sessions : Map     |
+----------------------+
| + instance()         |
| + createSession()    |
| + getUserId()        |
| + destroySession()   |
+----------------------+
          ^
          |
   used by routes
   and middleware
```

### Why it works
- There should only be one shared session store.
- The app should not create separate session maps in different files.
- The `instance()` method keeps that shared access point.

## 2. Observer Pattern

### DriveShare file
- `src/patterns/WatchNotifier.js`

### What it does
DriveShare lets renters create watch records for a car. A watch can include:
- a target max price
- a watched date range

When a car changes in a way that matters, the app calls `notifyWatchers(...)`. That function checks each watch and creates notifications for the users whose conditions are now satisfied.

### Pattern role mapping
- Subject / observed thing: a car listing and its state
- Observer registration: rows in the `watches` table
- Observer handling logic: `notifyWatchers(...)`
- Notification result: rows in the `notifications` table
- Trigger points:
  - price updates in `src/routes/cars.js`
  - availability changes in `src/routes/cars.js`
  - booking cancellation in `src/routes/bookings.js`

### Simple class diagram

```text
+----------------------+
| Car Listing          |
+----------------------+
| id                   |
| price                |
| active               |
+----------------------+
          |
          | state changes trigger
          v
+----------------------+
| notifyWatchers()     |
+----------------------+
| checks watch rules   |
| creates notifications|
+----------------------+
          ^
          |
+----------------------+
| Watch rows           |
+----------------------+
| user_id              |
| car_id               |
| max_price            |
| watch dates          |
+----------------------+
```

### Why it works
- Renters subscribe to updates without being tightly coupled to car update logic.
- The app can notify zero, one, or many watchers when a car changes.
- Car routes do not need to know how every watcher is stored or evaluated.

## 3. Mediator Pattern

### DriveShare class
- `src/patterns/SearchMediator.js`

### What it does
`SearchMediator` centralizes car browse and search rules. Instead of spreading search logic across many routes or UI files, the app sends filter criteria into one mediator that coordinates:
- location filtering
- date filtering
- max price filtering
- overlap filtering against bookings and availability blocks
- validation of search input

The renter search UI feeds several inputs into the same coordinated search flow, and the mediator keeps those rules together instead of spreading them across routes and pages.

### Pattern role mapping
- Mediator: `SearchMediator`
- Colleagues / coordinated inputs:
  - location
  - start date
  - end date
  - max price
  - result limit
- Clients:
  - `src/routes/cars.js`
  - renter browse/search UI in `public/index.html` and `public/renter.html`

### Simple class diagram

```text
 location ----\
 start date ---\
 end date ------> SearchMediator ----> SQL query / results
 max price ----/
 browse mode --/
```

### Why it works
- Search rules live in one place.
- Route handlers do not each rebuild the same filtering logic.
- The app has one central object deciding how search inputs work together.

## 4. Builder Pattern

### DriveShare class
- `src/patterns/CarListingBuilder.js`

### What it does
Owners create car listings through route logic that uses `CarListingBuilder`. The builder starts with base defaults, then fills in the car data step by step before returning the final listing object to insert into the database.

### Pattern role mapping
- Builder: `CarListingBuilder`
- Product: the finished car listing object
- Client: `src/routes/cars.js`
- Build steps:
  - `title(...)`
  - `make(...)`
  - `model(...)`
  - `year(...)`
  - `mileage(...)`
  - `pickupLocation(...)`
  - `pricePerDayCents(...)`
  - `active(...)`
  - `build()`

### Simple class diagram

```text
+--------------------------+
| CarListingBuilder        |
+--------------------------+
| - data                   |
+--------------------------+
| + title()                |
| + make()                 |
| + model()                |
| + year()                 |
| + mileage()              |
| + pickupLocation()       |
| + pricePerDayCents()     |
| + active()               |
| + build()                |
+--------------------------+
            |
            v
+--------------------------+
| Car listing object       |
+--------------------------+
```

### Why it works
- Car listings are assembled in a readable step-by-step way.
- The builder keeps listing construction cleaner than building a large raw object in the route.
- It supports optional or default values without making the route harder to read.

## 5. Proxy Pattern

### DriveShare classes
- `src/patterns/PaymentProxy.js`
  - `PaymentProxy`
  - `RealPaymentService`

### What it does
DriveShare uses a simulated payment system. The booking route does not talk directly to the real payment service. Instead, it calls `PaymentProxy`, which first checks:
- the user is logged in
- the logged-in user is the payer
- the amount is valid

If those checks pass, the proxy forwards the call to `RealPaymentService`, which:
- subtracts money from the renter
- adds money to the owner
- inserts a payment row
- confirms the booking

### Pattern role mapping
- Subject: payment behavior exposed through `pay(...)`
- Proxy: `PaymentProxy`
- Real Subject: `RealPaymentService`
- Client: `src/routes/bookings.js`

### Simple class diagram

```text
+----------------------+
| bookings route       |
+----------------------+
          |
          v
+----------------------+
| PaymentProxy         |
+----------------------+
| + pay(...)           |
+----------------------+
          |
          v
+----------------------+
| RealPaymentService   |
+----------------------+
| + pay(...)           |
+----------------------+
```

### Why it works
- The proxy controls access before payment logic runs.
- Security and validation stay outside the real payment implementation.
- It simulates a safer payment interaction without using a real provider.

## 6. Chain of Responsibility

### DriveShare file
- `src/patterns/PasswordRecoveryChain.js`

### What it does
Password recovery is built as a chain of three handlers. Each handler checks one question index. If the current answer is correct, the request moves to the next handler. If any answer fails, the whole recovery flow stops.

### Pattern role mapping
- Handler: `QuestionHandler`
- Concrete handlers: three `QuestionHandler` objects for question 1, 2, and 3
- Chain builder: `buildRecoveryChain()`
- Client: `src/routes/auth.js`
- Request: the `answers` object sent during recovery

### Simple class diagram

```text
+----------------------+
| QuestionHandler (1)  |
+----------------------+
| + handle(...)        |
| + setNext(...)       |
+----------------------+
          |
          v
+----------------------+
| QuestionHandler (2)  |
+----------------------+
          |
          v
+----------------------+
| QuestionHandler (3)  |
+----------------------+
```

### Why it works
- Each question is handled by one handler object.
- The request moves from one handler to the next.
- The flow stops immediately when one handler fails.


## Where the Patterns Connect to Features

### Authentication
- `SessionManager` supports login/logout/session lookup.
- `PasswordRecoveryChain` supports recovery with 3 security questions.

### Search and Booking
- `SearchMediator` controls browse/search filtering.
- `PaymentProxy` confirms pending bookings after payment.

### Owner Listing Management
- `CarListingBuilder` creates listing objects before saving.

### Watch and Notifications
- `WatchNotifier` checks watches and creates notifications when a watched car changes.

## Related Files

- `README.md`
- `src/routes/auth.js`
- `src/routes/cars.js`
- `src/routes/bookings.js`
- `src/routes/messages.js`
- `src/routes/notifications.js`
