/*
 * Author:
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Creates the database schema and applies a column migrations.
 */

// =============================================
// IMPORTS
// =============================================

import { openDb } from "../src/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// =============================================
// PATH SETUP
// =============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================
// MIGRATION HELPERS
// =============================================

async function ensureColumn(db, table, colName, colTypeSql) {
  const info = await db.all(`PRAGMA table_info(${table});`);
  const exists = info.some((c) => c.name === colName);

  // Skip this if the column already exists in an older database file.
  if (!exists) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colTypeSql};`);
    console.log(`Added column ${table}.${colName}`);
  }
}

// =============================================
// MAIN SETUP
// =============================================

async function main() {
  const db = await openDb();
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  await db.exec(schema);

  // Applies lightweight migrations so the sqlite file does not need to be deleted and recreated.
  await ensureColumn(db, "watches", "watch_start_date", "TEXT");
  await ensureColumn(db, "watches", "watch_end_date", "TEXT");
  await ensureColumn(db, "messages", "is_read", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "reviews", "reviewee_type", "TEXT NOT NULL DEFAULT 'user'");
  await ensureColumn(db, "cars", "seed_tag", "TEXT");

  console.log("DB initialized / migrated.");
  await db.close();
}

// =============================================
// SCRIPT START
// =============================================

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
