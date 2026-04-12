/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Validates a booking payment before money is moved.
 */

// =============================================
// REAL PAYMENT SERVICE
// =============================================

export class RealPaymentService {
  async pay(db, bookingId, payerId, payeeId, amountCents) {
    // DB side-effect: subtracts the renter balance, adds the owner balance, records payment, and confirms booking.
    await db.run("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?", [amountCents, payerId]);
    await db.run("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?", [amountCents, payeeId]);

    await db.run(
      "INSERT INTO payments(booking_id, payer_id, payee_id, amount_cents) VALUES(?,?,?,?)",
      [bookingId, payerId, payeeId, amountCents]
    );

    await db.run("UPDATE bookings SET status='confirmed' WHERE id = ?", [bookingId]);
    return { ok: true };
  }
}

// =============================================
// PAYMENT PROXY
// =============================================

export class PaymentProxy {
  constructor(realService) {
    this.real = realService;
  }

  async pay(db, sessionUserId, bookingId, payerId, payeeId, amountCents) {
    // Business rule: only the logged-in payer can pay from their own account.
    if (!sessionUserId) {
      return { ok: false, error: "Not logged in." };
    }

    if (sessionUserId !== payerId) {
      return { ok: false, error: "You can only pay from your own account." };
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Invalid payment amount." };
    }

    return await this.real.pay(db, bookingId, payerId, payeeId, amountCents);
  }
}
