DriveShare (Term Project) - Starter (Node + Express + SQLite)
============================================================

What you get, for FREEE!
- A Express server + SQLite DB
- A web based front end and back end structure
- Pattern stubs wired into real flows:
  - Singleton: SessionManager (server-side sessions)
  - CoR: PasswordRecoveryChain (3 security questions, because we need some security right?)
  - Builder: CarListingBuilder
  - Observer: WatchNotifier (notifies watchers on price changes)
  - Mediator: UIMediator (front-end component coordination)
  - Proxy: PaymentProxy to a "RealPaymentService" mockup

  THE Setup!
1) Install Node 
2) In this folder:
   npm install
   npm run initdb
   npm run dev

Then open:
- http://localhost:3000


New UI pages
- /car.html?id=ID (details + booking + watch)
- /owner.html shows My Cars
- /renter.html shows results as cards

LOG while developing

Step 2 additions 
- Messaging UI:
  - /messages.html (loads thread + sends messages)
  - /api/messages/thread and /api/messages POST
- Watchlist date range:
  - watches now store watch_start_date/watch_end_date
  - notifications only fire when price matches AND date range is actually available
- Availability calendar UI:
  - /api/cars/:id/calendar returns bookings + manual blocks
  - /api/cars/:id/blocks add/delete for owners
  - /car.html shows a 30-day availability grid
- Booking cancel:
  - POST /api/bookings/:id/cancel frees dates and notifies watchers


