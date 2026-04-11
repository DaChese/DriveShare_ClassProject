
// =============================================
// FILE: PasswordRecoveryChain.js
// Chain of Responsibility for password recovery
// Created: 2024-12-19
// Updated: 2024-12-19
// =============================================

import bcrypt from "bcryptjs";

// Handler for individual security questions in chain
class QuestionHandler {
  // Initialize for specific question index
  constructor(qIndex) {
    this.qIndex = qIndex;
    this.next = null;
  }

  // Set next handler in chain
  setNext(h) {
    this.next = h;
    return h;
  }

  // Validate this question and pass to next if successful
  // Business rules: all security questions must be answered correctly in sequence
  // Edge cases: missing security question, wrong answer, incomplete answers
  async handle(db, userId, providedAnswers) {
    // Get stored answer hash for this question
    const row = await db.get(
      "SELECT answer_hash FROM security_questions WHERE user_id = ? AND q_index = ?",
      [userId, this.qIndex]
    );

    // Check if question exists for user
    if (!row) {
      return { ok: false, error: "Missing security question." };
    }

    // Get provided answer (default empty if not provided)
    const provided = String(providedAnswers[this.qIndex] ?? "");

    // Verify answer against stored hash
    const ok = bcrypt.compareSync(provided, row.answer_hash);
    if (!ok) {
      return { ok: false, error: `Security question ${this.qIndex} failed.` };
    }

    // Answer correct - continue to next handler
    if (this.next) {
      return await this.next.handle(db, userId, providedAnswers);
    }

    // All questions passed
    return { ok: true };
  }
}

// Build complete password recovery chain
// Creates 3 handlers linked in sequence
export function buildRecoveryChain() {
  // Create handlers for each question
  const q1 = new QuestionHandler(1);
  const q2 = new QuestionHandler(2);
  const q3 = new QuestionHandler(3);

  // Chain them together: q1 -> q2 -> q3
  q1.setNext(q2).setNext(q3);

  // Return start of chain
  return q1;
}
