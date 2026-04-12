/**
 * Menjalankan file .sql di folder migrations secara berurutan.
 * Mencatat versi di tabel schema_migrations (dibuat otomatis).
 *
 * Usage: npm run migrate
 * Pastikan .env sudah berisi kredensial DB (sama seperti server).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME || "appointment_pasien",
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(191) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [appliedRows] = await conn.query("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.version));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("Tidak ada file migrasi di", MIGRATIONS_DIR);
    await conn.end();
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log("[skip]", file);
      continue;
    }
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    await conn.beginTransaction();
    try {
      await conn.query(sql);
      await conn.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
      await conn.commit();
      console.log("[ok]  ", file);
    } catch (e) {
      await conn.rollback();
      console.error("[fail]", file, e.message);
      process.exitCode = 1;
      await conn.end();
      return;
    }
  }

  await conn.end();
  console.log("Migrasi selesai.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
