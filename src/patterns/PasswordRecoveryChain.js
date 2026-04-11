
/**
 * PasswordRecoveryChain - Chain of Responsibility Pattern Implementation
 *
 * Implements a sequential validation process for password recovery where
 * each security question handler checks user answers in order.
 *
 * Design Pattern: Chain of Responsibility
 * - Each handler processes one security question
 * - Handlers are linked in a chain for sequential processing
 * - Processing stops at first failure (fail-fast behavior)
 * - Allows dynamic chain configuration and extension
 *
 * Usage: Password recovery endpoint validates user identity through
 * multiple security questions before allowing password reset.
 */

import bcrypt from "bcryptjs";

/**
 * QuestionHandler - Handler in the Chain of Responsibility
 * Validates a single security question answer against stored hash
 */
class QuestionHandler {
  /**
   * Initialize handler for a specific question index
   * @param {number} qIndex - Question index (1, 2, or 3)
   */
  constructor(qIndex) {
    /** @private Question index this handler processes */
    this.qIndex = qIndex;

    /** @private Next handler in the chain */
    this.next = null;
  }

  /**
   * Set the next handler in the chain
   * @param {QuestionHandler} h - Next handler to process
   * @returns {QuestionHandler} The next handler for method chaining
   */
  setNext(h) {
    this.next = h;
    return h;
  }

  /**
   * Handle validation for this question and pass to next handler if successful
   * @param {Database} db - SQLite database instance
   * @param {number} userId - ID of user attempting password recovery
   * @param {Object} providedAnswers - Map of question indices to user answers
   * @returns {Promise<Object>} Result with ok/error status
   */
  async handle(db, userId, providedAnswers) {
    // Retrieve stored answer hash for this question
    const row = await db.get(
      "SELECT answer_hash FROM security_questions WHERE user_id = ? AND q_index = ?",
      [userId, this.qIndex]
    );

    // Check if security question exists for user
    if (!row) {
      return { ok: false, error: "Missing security question." };
    }

    // Get provided answer (default to empty string if not provided)
    const provided = String(providedAnswers[this.qIndex] ?? "");

    // Verify answer against stored hash
    const ok = bcrypt.compareSync(provided, row.answer_hash);
    if (!ok) {
      return { ok: false, error: `Security question ${this.qIndex} failed.` };
    }

    // Answer correct - pass to next handler in chain
    if (this.next) {
      return await this.next.handle(db, userId, providedAnswers);
    }

    // All questions answered correctly
    return { ok: true };
  }
}

/**
 * Build the complete password recovery chain
 * Creates and links three question handlers in sequence
 * @returns {QuestionHandler} First handler in the chain
 */
export function buildRecoveryChain() {
  // Create handlers for each security question
  const q1 = new QuestionHandler(1); // First security question
  const q2 = new QuestionHandler(2); // Second security question
  const q3 = new QuestionHandler(3); // Third security question

  // Chain handlers together: q1 -> q2 -> q3
  q1.setNext(q2).setNext(q3);

  // Return start of chain
  return q1;
}
