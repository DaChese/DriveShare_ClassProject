
/**
 * PaymentProxy - Proxy Pattern Implementation
 *
 * Provides a protective layer around payment processing with security checks,
 * validation, and logging before delegating to the real payment service.
 *
 * Design Pattern: Proxy (Protection Proxy)
 * - Controls access to the real payment service
 * - Adds pre-processing validation and security checks
 * - Provides logging and monitoring capabilities
 * - Maintains same interface as the real service
 *
 * Usage: Used in booking payment endpoints to ensure secure,
 * validated payment processing with proper authorization checks.
 */

/**
 * RealPaymentService - The actual payment processing implementation
 * Handles the core payment logic of transferring money between users
 */
export class RealPaymentService {
  /**
   * Process a payment between two users
   * @param {Database} db - SQLite database instance
   * @param {number} bookingId - ID of the booking being paid for
   * @param {number} payerId - ID of the user making payment
   * @param {number} payeeId - ID of the user receiving payment
   * @param {number} amountCents - Payment amount in cents
   * @returns {Promise<Object>} Result object with ok status
   */
  async pay(db, bookingId, payerId, payeeId, amountCents) {
    // Debit payer's account
    await db.run("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?", [amountCents, payerId]);

    // Credit payee's account
    await db.run("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?", [amountCents, payeeId]);

    // Record the payment transaction
    await db.run(
      "INSERT INTO payments(booking_id, payer_id, payee_id, amount_cents) VALUES(?,?,?,?)",
      [bookingId, payerId, payeeId, amountCents]
    );

    // Update booking status to confirmed
    await db.run("UPDATE bookings SET status='confirmed' WHERE id = ?", [bookingId]);

    return { ok: true };
  }
}

/**
 * PaymentProxy - Protection proxy for payment operations
 * Adds security, validation, and logging layers around payment processing
 */
export class PaymentProxy {
  /**
   * Initialize proxy with reference to real payment service
   * @param {RealPaymentService} realService - The actual payment processor
   */
  constructor(realService) {
    /** @private Reference to the real payment service */
    this.real = realService;
  }

  /**
   * Process payment with security checks and validation
   * @param {Database} db - SQLite database instance
   * @param {number} sessionUserId - ID of logged-in user from session
   * @param {number} bookingId - ID of the booking being paid for
   * @param {number} payerId - ID of the user making payment
   * @param {number} payeeId - ID of the user receiving payment
   * @param {number} amountCents - Payment amount in cents
   * @returns {Promise<Object>} Result object with ok/error status
   */
  async pay(db, sessionUserId, bookingId, payerId, payeeId, amountCents) {
    // Security check: Ensure user is logged in
    if (!sessionUserId) {
      return { ok: false, error: "Not logged in." };
    }

    // Authorization check: User can only pay from their own account
    if (sessionUserId !== payerId) {
      return { ok: false, error: "You can only pay from your own account." };
    }

    // Input validation: Ensure valid payment amount
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return { ok: false, error: "Invalid payment amount." };
    }

    // All checks passed - delegate to real payment service
    return await this.real.pay(db, bookingId, payerId, payeeId, amountCents);
  }
}
