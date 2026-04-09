
export class RealPaymentService {
  async pay(db, bookingId, payerId, payeeId, amountCents) {
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

export class PaymentProxy {
  constructor(realService) {
    this.real = realService;
  }

  async pay(db, sessionUserId, bookingId, payerId, payeeId, amountCents) {
    if (!sessionUserId) return { ok: false, error: "Not logged in." };
    if (sessionUserId !== payerId) return { ok: false, error: "You can only pay from your own account." };
    if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, error: "Invalid payment amount." };
    return await this.real.pay(db, bookingId, payerId, payeeId, amountCents);
  }
}
