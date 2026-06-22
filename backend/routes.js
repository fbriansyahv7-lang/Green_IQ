import express from "express";
import { db } from "./db.js";
import { generateAIRekomendasi, generateAICustomRekomendasi } from "./ai.js";

export const router = express.Router();

// ── GET /api/latest-sensor ──────────────────────────────────
// Dashboard: ambil data sensor terbaru (semua perangkat, 1 row)
router.get("/latest-sensor", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM sensor_data ORDER BY reading_timestamp DESC LIMIT 1`
    );
    if (rows.length === 0) return res.status(404).json({ error: "Belum ada data sensor" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil latest sensor" });
  }
});

// ── GET /api/list-data ──────────────────────────────────────
// Dashboard: tabel live data (50 terbaru)
router.get("/list-data", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM sensor_data ORDER BY reading_timestamp DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil list data" });
  }
});

// ── GET /api/sensor-data/:id ────────────────────────────────
// Analisis page: detail satu baris sensor
router.get("/sensor-data/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM sensor_data WHERE id_sensor_data = ? LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Data tidak ditemukan" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil sensor data" });
  }
});

// ── POST /api/analisis/:id ──────────────────────────────────
// Analisis page: trigger AI rekomendasi untuk sensor_data_id tertentu
// Body: { kategori: [...], lokasi, iklim, jumlah }
router.post("/analisis/:id", async (req, res) => {
  try {
    const sensor_data_id = req.params.id;
    const { kategori, lokasi, iklim, jumlah } = req.body;

    // Ambil data sensor
    const [rows] = await db.query(
      `SELECT * FROM sensor_data WHERE id_sensor_data = ? LIMIT 1`,
      [sensor_data_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Sensor data tidak ditemukan" });

    const raw = rows[0];

    // Update lokasi & iklim ke sensor_data, tandai sudah dianalisis
    await db.query(
      `UPDATE sensor_data SET lokasi = ?, iklim = ?, analisis = 1 WHERE id_sensor_data = ?`,
      [lokasi || null, iklim || null, sensor_data_id]
    );

    const sensor = {
      suhu: raw.suhu,
      kelembaban: raw.kelembaban,
      tekanan: raw.tekanan,
      kelembaban_tanah: raw.kesuburan_tanah,
      lokasi: lokasi || raw.lokasi,
      iklim: iklim || raw.iklim,
    };

    // Ambil tanaman yang sudah ada biar tidak duplikat
    const [existing] = await db.query(
      `SELECT nama_tanaman FROM ai_rekomendasi_tanaman WHERE sensor_data_id = ?`,
      [sensor_data_id]
    );
    const existingList = existing.map(r => r.nama_tanaman);

    const jumlahInt = Math.min(parseInt(jumlah) || 3, 6);
    const hasil = await generateAIRekomendasi(sensor, kategori, existingList, jumlahInt);

    // Simpan hasil ke DB
    for (const t of hasil) {
      const [inserted] = await db.query(
        `INSERT INTO ai_rekomendasi_tanaman (sensor_data_id, nama_tanaman, kategori)
         VALUES (?, ?, ?)`,
        [sensor_data_id, t.nama, t.kategori]
      );
      const id_tanaman = inserted.insertId;
      await db.query(
        `INSERT INTO detail (
          id_tanaman, skor, suhu_optimal, kelembaban_optimal,
          ketinggian_optimal, kelembaban_tanah_optimal, waktu_panen,
          tingkat_kesulitan, perawatan, musim_tanam, harga_pasar,
          profit_1000m2, ROI, permintaan_pasar, tips_budidaya, kesimpulan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_tanaman,
          t.skor ?? 0,
          t.optimal?.suhu ?? 0,
          t.optimal?.kelembaban ?? 0,
          t.optimal?.ketinggian ?? 0,
          t.optimal?.kelembaban_tanah ?? 0,
          t.panen ?? "-",
          t.kesulitan ?? "-",
          t.perawatan ?? "-",
          t.musim ?? "-",
          t.harga ?? 0,
          t.profit ?? 0,
          t.ROI ?? 0,
          t.permintaan ?? "-",
          t.tips ?? "-",
          t.kesimpulan ?? "-",
        ]
      );
    }

    res.json({ success: true, jumlah: hasil.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal analisis AI", detail: err.message });
  }
});

// ── POST /api/custom-tanaman ────────────────────────────────
// Body: { sensor_data_id, nama_tanaman }
router.post("/custom-tanaman", async (req, res) => {
  try {
    const { sensor_data_id, nama_tanaman } = req.body;
    if (!sensor_data_id || !nama_tanaman)
      return res.status(400).json({ error: "sensor_data_id dan nama_tanaman wajib diisi" });

    // Cek duplikat
    const [dup] = await db.query(
      `SELECT id_tanaman FROM ai_rekomendasi_tanaman
       WHERE sensor_data_id = ? AND nama_tanaman = ? LIMIT 1`,
      [sensor_data_id, nama_tanaman]
    );
    if (dup.length > 0) return res.status(409).json({ error: "Tanaman sudah ada di daftar" });

    // Ambil data sensor
    const [rows] = await db.query(
      `SELECT * FROM sensor_data WHERE id_sensor_data = ? LIMIT 1`,
      [sensor_data_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Sensor data tidak ditemukan" });

    const raw = rows[0];
    const sensor = {
      suhu: raw.suhu,
      kelembaban: raw.kelembaban,
      tekanan: raw.tekanan,
      kelembaban_tanah: raw.kesuburan_tanah,
      lokasi: raw.lokasi,
      iklim: raw.iklim,
    };

    const hasil = await generateAICustomRekomendasi(sensor, nama_tanaman);
    const t = hasil[0];

    const [inserted] = await db.query(
      `INSERT INTO ai_rekomendasi_tanaman (sensor_data_id, nama_tanaman, kategori)
       VALUES (?, ?, ?)`,
      [sensor_data_id, t.nama, t.kategori]
    );
    const id_tanaman = inserted.insertId;

    await db.query(
      `INSERT INTO detail (
        id_tanaman, skor, suhu_optimal, kelembaban_optimal,
        ketinggian_optimal, kelembaban_tanah_optimal, waktu_panen,
        tingkat_kesulitan, perawatan, musim_tanam, harga_pasar,
        profit_1000m2, ROI, permintaan_pasar, tips_budidaya, kesimpulan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_tanaman,
        t.skor ?? 0,
        t.optimal?.suhu ?? 0,
        t.optimal?.kelembaban ?? 0,
        t.optimal?.ketinggian ?? 0,
        t.optimal?.kelembaban_tanah ?? 0,
        t.panen ?? "-",
        t.kesulitan ?? "-",
        t.perawatan ?? "-",
        t.musim ?? "-",
        t.harga ?? 0,
        t.profit ?? 0,
        t.ROI ?? 0,
        t.permintaan ?? "-",
        t.tips ?? "-",
        t.kesimpulan ?? "-",
      ]
    );

    res.json({ success: true, message: `${nama_tanaman} berhasil ditambahkan!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal tambah custom tanaman", detail: err.message });
  }
});

// ── GET /api/list-rekomendasi/:sensor_data_id ───────────────
// Analisis page: list rekomendasi + skor untuk satu sesi sensor
router.get("/list-rekomendasi/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id_tanaman, r.nama_tanaman, r.kategori, r.simpan,
              d.skor, d.kesimpulan
       FROM ai_rekomendasi_tanaman r
       LEFT JOIN detail d ON d.id_tanaman = r.id_tanaman
       WHERE r.sensor_data_id = ?
       ORDER BY d.skor DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil list rekomendasi" });
  }
});

// ── GET /api/rekomendasi-detail/:id_tanaman ─────────────────
// Modal detail: semua kolom dari join rekomendasi + detail + sensor
router.get("/rekomendasi-detail/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, d.*, s.iklim AS iklim_aktual, s.lokasi AS lokasi_aktual
       FROM ai_rekomendasi_tanaman r
       LEFT JOIN detail d ON d.id_tanaman = r.id_tanaman
       LEFT JOIN sensor_data s ON s.id_sensor_data = r.sensor_data_id
       WHERE r.id_tanaman = ? LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Detail tidak ditemukan" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil detail rekomendasi" });
  }
});

// ── POST /api/simpan ────────────────────────────────────────
// Toggle simpan/hapus tanaman ke riwayat
// Body: { id } → id_tanaman
router.post("/simpan", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id wajib diisi" });

    const [rows] = await db.query(
      `SELECT simpan FROM ai_rekomendasi_tanaman WHERE id_tanaman = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Tanaman tidak ditemukan" });

    const newSimpan = rows[0].simpan ? 0 : 1;
    await db.query(
      `UPDATE ai_rekomendasi_tanaman SET simpan = ? WHERE id_tanaman = ?`,
      [newSimpan, id]
    );

    res.json({ success: true, simpan: newSimpan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal toggle simpan" });
  }
});

// ── GET /api/riwayat ────────────────────────────────────────
// Riwayat page: semua sensor_data yang punya tanaman tersimpan (simpan=1)
// Dikelompokkan per sensor_data_id
router.get("/riwayat", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id_sensor_data, s.suhu, s.kelembaban, s.tekanan,
              s.kesuburan_tanah, s.iklim, s.lokasi, s.reading_timestamp,
              r.id_tanaman, r.nama_tanaman, r.kategori,
              d.skor
       FROM sensor_data s
       JOIN ai_rekomendasi_tanaman r ON r.sensor_data_id = s.id_sensor_data
       LEFT JOIN detail d ON d.id_tanaman = r.id_tanaman
       WHERE r.simpan = 1
       ORDER BY s.reading_timestamp DESC, d.skor DESC`
    );

    // Kelompokkan per sensor_data_id
    const grouped = [];
    const map = {};
    for (const row of rows) {
      if (!map[row.id_sensor_data]) {
        map[row.id_sensor_data] = {
          id_sensor_data: row.id_sensor_data,
          suhu: row.suhu,
          kelembaban: row.kelembaban,
          tekanan: row.tekanan,
          kesuburan_tanah: row.kesuburan_tanah,
          iklim: row.iklim,
          lokasi: row.lokasi,
          reading_timestamp: row.reading_timestamp,
          tanaman: []
        };
        grouped.push(map[row.id_sensor_data]);
      }
      map[row.id_sensor_data].tanaman.push({
        id_tanaman: row.id_tanaman,
        nama_tanaman: row.nama_tanaman,
        kategori: row.kategori,
        skor: row.skor
      });
    }

    res.json({ success: true, data: grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil riwayat" });
  }
});

// ── POST /api/hapus-semua ───────────────────────────────────
// Hapus semua riwayat (set simpan=0 semua)
router.post("/hapus-semua", async (req, res) => {
  try {
    await db.query(`UPDATE ai_rekomendasi_tanaman SET simpan = 0 WHERE simpan = 1`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal hapus semua riwayat" });
  }
});

// ── GET /api/perangkat ──────────────────────────────────────
router.get("/perangkat", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM perangkat ORDER BY id_perangkat");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data perangkat" });
  }
});
