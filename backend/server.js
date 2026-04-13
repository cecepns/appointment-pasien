require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const PORT = Number(process.env.PORT) || 4000;
const UPLOAD_DIR = path.join(__dirname, "uploads-appointment-pasien");
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-ganti-di-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME || "appointment_pasien",
  waitForConnections: true,
  connectionLimit: 10,
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = path.extname(file.originalname || "").slice(0, 12) || "";
    cb(null, `${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (!ok) return cb(new Error("Hanya gambar JPEG, PNG, GIF, atau WebP"));
    cb(null, true);
  },
});

const appointmentUpload = upload.fields([
  { name: "signature", maxCount: 1 },
  { name: "transfer_proof", maxCount: 1 },
]);

async function ensureAppointmentColumns() {
  try {
    await pool.execute(
      "ALTER TABLE appointments ADD COLUMN admin_note TEXT NULL COMMENT 'Catatan admin untuk hasil treatment' AFTER transfer_proof_path"
    );
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
}

function adminMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    const id = Number(payload.sub);
    if (!id || !payload.username) return res.status(401).json({ error: "Unauthorized" });
    req.admin = { id, username: String(payload.username) };
    next();
  } catch {
    return res.status(401).json({ error: "Token tidak valid atau kadaluarsa" });
  }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    fallthrough: false,
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const username = String((req.body || {}).username || "").trim();
    const password = String((req.body || {}).password || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi" });
    }
    const [rows] = await pool.execute(
      "SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1",
      [username]
    );
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: "Username atau password salah" });
    }
    const row = rows[0];
    const token = jwt.sign({ sub: String(row.id), username: row.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    res.json({ token, username: row.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gagal login" });
  }
});

app.patch("/api/admin/password", adminMiddleware, async (req, res) => {
  try {
    const current_password = String((req.body || {}).current_password || "");
    const new_password = String((req.body || {}).new_password || "");
    if (!current_password || !new_password) {
      return res.status(400).json({ error: "Password lama dan baru wajib diisi" });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: "Password baru minimal 8 karakter" });
    }
    const [rows] = await pool.execute("SELECT password_hash FROM admins WHERE id = ? LIMIT 1", [
      req.admin.id,
    ]);
    if (!rows.length || !(await bcrypt.compare(current_password, rows[0].password_hash))) {
      return res.status(400).json({ error: "Password saat ini salah" });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await pool.execute("UPDATE admins SET password_hash = ? WHERE id = ?", [hash, req.admin.id]);
    res.json({ ok: true, message: "Password berhasil diubah" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gagal mengubah password" });
  }
});

app.post("/api/appointments", (req, res) => {
  appointmentUpload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload gagal" });
    }
    try {
      const {
        full_name,
        appointment_datetime,
        homecare_address,
        allergy_history,
        phone_number,
        treatment,
      } = req.body;

      if (!full_name || !appointment_datetime || !homecare_address || !phone_number || !treatment) {
        return res.status(400).json({ error: "Data wajib belum lengkap" });
      }

      const sigFile = req.files?.signature?.[0];
      if (!sigFile) {
        return res.status(400).json({ error: "Tanda tangan persetujuan wajib diisi" });
      }

      const transferFile = req.files?.transfer_proof?.[0];
      const signature_path = sigFile.filename;
      const transfer_proof_path = transferFile ? transferFile.filename : null;

      const [result] = await pool.execute(
        `INSERT INTO appointments
        (full_name, appointment_datetime, homecare_address, allergy_history, phone_number, treatment, signature_path, transfer_proof_path, admin_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(full_name).trim(),
          appointment_datetime,
          String(homecare_address).trim(),
          allergy_history ? String(allergy_history).trim() : null,
          String(phone_number).trim(),
          String(treatment).trim(),
          signature_path,
          transfer_proof_path,
          null,
        ]
      );

      res.status(201).json({
        id: result.insertId,
        message: "Appointment berhasil dikirim. Harap kirim bukti transfer jika belum dilampirkan.",
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Gagal menyimpan data" });
    }
  });
});

app.get("/api/appointments", adminMiddleware, async (req, res) => {
  try {
    const status = req.query.status;
    const search = String(req.query.search || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 10));
    const offset = (page - 1) * limit;

    const whereParts = [];
    const params = [];

    if (status && ["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      whereParts.push("status = ?");
      params.push(status);
    }

    if (search) {
      const term = `%${search}%`;
      whereParts.push(
        `(full_name LIKE ? OR phone_number LIKE ? OR homecare_address LIKE ? OR treatment LIKE ? OR IFNULL(allergy_history,'') LIKE ? OR IFNULL(admin_note,'') LIKE ?)`
      );
      params.push(term, term, term, term, term, term);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS cnt FROM appointments ${whereClause}`;
    const [countRows] = await pool.execute(countSql, params);
    const total = Number(countRows[0]?.cnt) || 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const listSql = `SELECT id, full_name, appointment_datetime, homecare_address, allergy_history,
      phone_number, treatment, transfer_proof_path, admin_note, status, created_at
      FROM appointments ${whereClause}
      ORDER BY appointment_datetime DESC, id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await pool.execute(listSql, [...params, limit, offset]);

    res.json({
      data: rows,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gagal mengambil data" });
  }
});

app.get("/api/appointments/stats", adminMiddleware, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT status, COUNT(*) AS count FROM appointments GROUP BY status`
    );
    const map = { pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
    for (const r of rows) map[r.status] = Number(r.count);
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM appointments`);
    res.json({ ...map, total: Number(total) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gagal statistik" });
  }
});

app.get("/api/appointments/:id", adminMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID tidak valid" });
    const [rows] = await pool.execute(
      `SELECT * FROM appointments WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Tidak ditemukan" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gagal mengambil detail" });
  }
});

app.patch("/api/appointments/:id", adminMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID tidak valid" });

    const body = req.body || {};
    const updates = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      if (!["pending", "confirmed", "cancelled", "completed"].includes(body.status)) {
        return res.status(400).json({ error: "Status tidak valid" });
      }
      updates.push("status = ?");
      params.push(body.status);
    }

    if (Object.prototype.hasOwnProperty.call(body, "full_name")) {
      const v = String(body.full_name || "").trim();
      if (!v) return res.status(400).json({ error: "Nama wajib diisi" });
      updates.push("full_name = ?");
      params.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, "appointment_datetime")) {
      const v = String(body.appointment_datetime || "").trim();
      if (!v) return res.status(400).json({ error: "Tanggal appointment wajib diisi" });
      updates.push("appointment_datetime = ?");
      params.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, "homecare_address")) {
      const v = String(body.homecare_address || "").trim();
      if (!v) return res.status(400).json({ error: "Alamat homecare wajib diisi" });
      updates.push("homecare_address = ?");
      params.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, "allergy_history")) {
      const v = String(body.allergy_history || "").trim();
      updates.push("allergy_history = ?");
      params.push(v || null);
    }

    if (Object.prototype.hasOwnProperty.call(body, "phone_number")) {
      const v = String(body.phone_number || "").trim();
      if (!v) return res.status(400).json({ error: "Nomor aktif wajib diisi" });
      updates.push("phone_number = ?");
      params.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, "treatment")) {
      const v = String(body.treatment || "").trim();
      if (!v) return res.status(400).json({ error: "Treatment wajib diisi" });
      updates.push("treatment = ?");
      params.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(body, "admin_note")) {
      const v = String(body.admin_note || "").trim();
      updates.push("admin_note = ?");
      params.push(v || null);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "Tidak ada data untuk diperbarui" });
    }

    params.push(id);
    const [r] = await pool.execute(`UPDATE appointments SET ${updates.join(", ")} WHERE id = ?`, params);
    if (r.affectedRows === 0) return res.status(404).json({ error: "Tidak ditemukan" });
    const [rows] = await pool.execute(`SELECT * FROM appointments WHERE id = ? LIMIT 1`, [id]);
    res.json({ ok: true, data: rows[0] || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gagal memperbarui" });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

async function start() {
  try {
    await ensureAppointmentColumns();
    app.listen(PORT, () => {
      console.log(`API appointment listening on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error("Gagal menyiapkan schema:", e);
    process.exit(1);
  }
}

start();
