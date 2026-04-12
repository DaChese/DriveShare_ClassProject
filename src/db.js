/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Opens the SQLite database used by DriveShare.
 */

// =============================================
// IMPORTS
// =============================================

import sqlite3 from "sqlite3";
import { open } from "sqlite";

// =============================================
// DATABASE CONNECTION
// =============================================

export async function openDb() {
  const db = await open({ filename: "./driveshare.sqlite", driver: sqlite3.Database });

  // Foreign keys need to stay on so related rows cannot drift out of sync.
  await db.exec("PRAGMA foreign_keys = ON;");
  return db;
}
