/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Handles registration, login, logout, profile lookup, and password recovery.
 */

// =============================================
// IMPORTS
// =============================================

import express from "express";
import bcrypt from "bcryptjs";
import SessionManager from "../patterns/SessionManager.js";
import { buildRecoveryChain } from "../patterns/PasswordRecoveryChain.js";

// =============================================
// AUTH ROUTES
// =============================================

export default function authRoutes(db) {
  const r = express.Router();

  // =============================================
  // REGISTER
  // =============================================

  // POST /auth/register
  // Expects email, password, displayName, and exactly 3 security questions.
  r.post("/register", async (req, res) => {
    const { email, password, displayName, questions } = req.body || {};
    if (!email || !password || !displayName) return res.status(400).json({ ok: false, error: "Missing fields." });
    if (!questions || !Array.isArray(questions) || questions.length !== 3) {
      return res.status(400).json({ ok: false, error: "Need 3 security questions." });
    }

    const password_hash = bcrypt.hashSync(String(password), 10);

    try {
      // DB side-effect: creates the user row first so the security questions can point to it.
      const result = await db.run(
        "INSERT INTO users(email, password_hash, display_name) VALUES(?,?,?)",
        [String(email).toLowerCase(), password_hash, String(displayName)]
      );
      const userId = result.lastID;

      // Business rule: all 3 security questions must be saved during registration.
      for (let i = 0; i < 3; i++) {
        const q = questions[i];
        const qIndex = i + 1;
        if (!q || !q.question || !q.answer) return res.status(400).json({ ok: false, error: "Bad question entry." });
        const answer_hash = bcrypt.hashSync(String(q.answer), 10);
        await db.run(
          "INSERT INTO security_questions(user_id, q_index, question_text, answer_hash) VALUES(?,?,?,?)",
          [userId, qIndex, String(q.question), answer_hash]
        );
      }

      // DB side-effect: creates a login session right after successful registration.
      const sid = SessionManager.instance().createSession(userId);
      res.cookie("sid", sid, { httpOnly: true });
      return res.json({ ok: true, userId });
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Email already used." });
    }
  });

  // =============================================
  // LOGIN
  // =============================================

  // POST /auth/login
  // Expects email and password, then returns a session cookie on success.
  r.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    const row = await db.get("SELECT id, password_hash FROM users WHERE email = ?", [String(email).toLowerCase()]);
    if (!row) return res.status(401).json({ ok: false, error: "Bad login." });

    const ok = bcrypt.compareSync(String(password), row.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "Bad login." });

    const sid = SessionManager.instance().createSession(row.id);
    res.cookie("sid", sid, { httpOnly: true });
    return res.json({ ok: true });
  });

  // =============================================
  // LOGOUT
  // =============================================

  // POST /auth/logout
  // Clears the current login session if one exists.
  r.post("/logout", (req, res) => {
    const sid = req.cookies.sid;
    if (sid) SessionManager.instance().destroySession(sid);
    res.clearCookie("sid");
    return res.json({ ok: true });
  });

  // =============================================
  // CURRENT USER
  // =============================================

  // GET /auth/me
  // Returns the logged-in user's profile summary.
  r.get("/me", async (req, res) => {
    const sid = req.cookies.sid;
    const userId = sid ? SessionManager.instance().getUserId(sid) : null;
    if (!userId) return res.json({ ok: false });

    const user = await db.get("SELECT id, email, display_name, balance_cents FROM users WHERE id = ?", [userId]);
    return res.json({ ok: true, user });
  });

  // =============================================
  // RECOVER PASSWORD
  // =============================================

  // POST /auth/recover
  // Expects email, answers, and optional newPassword.
  r.post("/recover", async (req, res) => {
    const { email, answers, newPassword } = req.body || {};
    const user = await db.get("SELECT id FROM users WHERE email = ?", [String(email).toLowerCase()]);
    if (!user) return res.status(404).json({ ok: false, error: "User not found." });

    // Business rule: all 3 answers must pass the recovery chain before reset is allowed.
    const chain = buildRecoveryChain();
    const result = await chain.handle(db, user.id, answers || {});
    if (!result.ok) return res.status(401).json(result);

    // Edge case: this lets the UI verify answers first before sending the new password.
    if (!newPassword) return res.json({ ok: true, message: "Answers verified. Provide newPassword to reset." });

    // DB side-effect: replaces the stored password hash after recovery succeeds.
    const password_hash = bcrypt.hashSync(String(newPassword), 10);
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, user.id]);
    return res.json({ ok: true, message: "Password reset." });
  });

  return r;
}
