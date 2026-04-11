import { openDb } from "../src/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureColumn(db, table, colName, colTypeSql) {
  const info = await db.all(`PRAGMA table_info(${table});`);
  const exists = info.some((c) => c.name === colName);
  if (!exists) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colTypeSql};`);
    console.log(`Added column ${table}.${colName}`);
  }
}

async function main() {
  const db = await openDb();
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  await db.exec(schema);

  // light migrations (so you don't have to delete the sqlite file)
  await ensureColumn(db, "watches", "watch_start_date", "TEXT");
  await ensureColumn(db, "watches", "watch_end_date", "TEXT");
  await ensureColumn(db, "messages", "is_read", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "reviews", "reviewee_type", "TEXT NOT NULL DEFAULT 'user'");

  console.log("DB initialized / migrated.");
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
