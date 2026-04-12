/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Checks the three recovery answers in order before allowing a reset.
 */

// =============================================
// IMPORTS
// =============================================

import bcrypt from "bcryptjs";

// =============================================
// QUESTION HANDLER
// =============================================

class QuestionHandler {
  constructor(qIndex) {
    this.qIndex = qIndex;
    this.next = null;
  }

  setNext(h) {
    this.next = h;
    return h;
  }

  async handle(db, userId, providedAnswers) {
    const row = await db.get(
      "SELECT answer_hash FROM security_questions WHERE user_id = ? AND q_index = ?",
      [userId, this.qIndex]
    );

    // Stop the recovery flow if the stored question is missing.
    if (!row) {
      return { ok: false, error: "Missing security question." };
    }

    const provided = String(providedAnswers[this.qIndex] ?? "");
    const ok = bcrypt.compareSync(provided, row.answer_hash);
    if (!ok) {
      return { ok: false, error: `Security question ${this.qIndex} failed.` };
    }

    // Every handler in the chain has to pass before recovery succeeds.
    if (this.next) {
      return await this.next.handle(db, userId, providedAnswers);
    }

    return { ok: true };
  }
}

// =============================================
// CHAIN BUILDER
// =============================================

export function buildRecoveryChain() {
  const q1 = new QuestionHandler(1);
  const q2 = new QuestionHandler(2);
  const q3 = new QuestionHandler(3);

  q1.setNext(q2).setNext(q3);
  return q1;
}
