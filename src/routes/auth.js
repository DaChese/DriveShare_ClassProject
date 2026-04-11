
// =============================================
// FILE: auth.js
// Authentication routes (register, login, logout, profile, recovery)
// Created: 2024-12-19
// Updated: 2024-12-19
// =============================================

import express from "express";
import bcrypt from "bcryptjs";
import SessionManager from "../patterns/SessionManager.js";
import { buildRecoveryChain } from "../patterns/PasswordRecoveryChain.js";

export default function authRoutes(db) {
  const r = express.Router();

  // =============================================
  // REGISTER ENDPOINT
  // =============================================

  // POST /auth/register
  // Creates new user account with security questions
  // Business rules: email unique, 3 security questions required
  // DB side-effects: inserts user, inserts 3 security questions, creates session
  r.post("/register", async (req, res) => {
    const { email, password, displayName, questions } = req.body || {};
    if (!email || !password || !displayName) return res.status(400).json({ ok: false, error: "Missing fields." });
    if (!questions || !Array.isArray(questions) || questions.length !== 3) {
      return res.status(400).json({ ok: false, error: "Need 3 security questions." });
    }

    const password_hash = bcrypt.hashSync(String(password), 10);

    try {
      const result = await db.run(
        "INSERT INTO users(email, password_hash, display_name) VALUES(?,?,?)",
        [String(email).toLowerCase(), password_hash, String(displayName)]
      );
      const userId = result.lastID;

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

      const sid = SessionManager.instance().createSession(userId);
      res.cookie("sid", sid, { httpOnly: true });
      return res.json({ ok: true, userId });
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Email already used." });
    }
  });

  // =============================================
  // LOGIN ENDPOINT
  // =============================================

  // POST /auth/login
  // Validates credentials and creates session
  // Business rules: valid email/password required
  // DB side-effects: creates session on success
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
  // LOGOUT ENDPOINT
  // =============================================

  // POST /auth/logout
  // Destroys user session
  // DB side-effects: removes session
  r.post("/logout", (req, res) => {
    const sid = req.cookies.sid;
    if (sid) SessionManager.instance().destroySession(sid);
    res.clearCookie("sid");
    return res.json({ ok: true });
  });

  // =============================================
  // PROFILE ENDPOINT
  // =============================================

  // GET /auth/me
  // Returns current user profile info
  // Business rules: must be logged in
  r.get("/me", async (req, res) => {
    const sid = req.cookies.sid;
    const userId = sid ? SessionManager.instance().getUserId(sid) : null;
    if (!userId) return res.json({ ok: false });

    const user = await db.get("SELECT id, email, display_name, balance_cents FROM users WHERE id = ?", [userId]);
    return res.json({ ok: true, user });
  });

  // =============================================
  // PASSWORD RECOVERY ENDPOINT
  // =============================================

  // POST /auth/recover
  // Password recovery via security questions
  // Business rules: all 3 questions must be answered correctly
  // DB side-effects: updates password hash if newPassword provided
  // Edge cases: user not found, wrong answers, missing newPassword
  r.post("/recover", async (req, res) => {
    const { email, answers, newPassword } = req.body || {};
    const user = await db.get("SELECT id FROM users WHERE email = ?", [String(email).toLowerCase()]);
    if (!user) return res.status(404).json({ ok: false, error: "User not found." });

    const chain = buildRecoveryChain();
    const result = await chain.handle(db, user.id, answers || {});
    if (!result.ok) return res.status(401).json(result);

    if (!newPassword) return res.json({ ok: true, message: "Answers verified. Provide newPassword to reset." });

    const password_hash = bcrypt.hashSync(String(newPassword), 10);
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, user.id]);
    return res.json({ ok: true, message: "Password reset." });
  });

  return r;
}
