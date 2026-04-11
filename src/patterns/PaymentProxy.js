
// =============================================
// FILE: PaymentProxy.js
// Proxy pattern - validates payments before they go through //
// Created: 2024-12-19
// Updated: 2024-12-19
// =============================================

// Real payment service - actually moves money around ////
export class RealPaymentService {
  // Okay, let's process the payment between users //////
  // Heads up: updates balances, records transaction, confirms booking //
  async pay(db, bookingId, payerId, payeeId, amountCents) {
    // Debit payer account
    await db.run("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?", [amountCents, payerId]);

    // Credit payee account
    await db.run("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?", [amountCents, payeeId]);

    // Record payment transaction
    await db.run(
      "INSERT INTO payments(booking_id, payer_id, payee_id, amount_cents) VALUES(?,?,?,?)",
      [bookingId, payerId, payeeId, amountCents]
    );

    // Confirm booking status
    await db.run("UPDATE bookings SET status='confirmed' WHERE id = ?", [bookingId]);

    return { ok: true };
  }
}

// Payment proxy - validates before delegating to real service ////
export class PaymentProxy {
  // Initialize with real payment service reference //////
  constructor(realService) {
    this.real = realService;
  }

  // Okay, let's handle payment with security checks first //
  // Check: user logged in, paying from own account, amount is valid ////
  // If anything fails, bounce back with error; otherwise let real service handle it //////
  async pay(db, sessionUserId, bookingId, payerId, payeeId, amountCents) {
    // Security: must be logged in
    if (!sessionUserId) {
      return { ok: false, error: "Not logged in." };
    }

    // Authorization: can only pay from own account
    if (sessionUserId !== payerId) {
      return { ok: false, error: "You can only pay from your own account." };
    }

    // Validation: positive integer amount required
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Invalid payment amount." };
    }

    // All checks passed - delegate to real service
    return await this.real.pay(db, bookingId, payerId, payeeId, amountCents);
  }
}
