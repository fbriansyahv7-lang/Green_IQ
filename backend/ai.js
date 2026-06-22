// backend/ai.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// simple backoff sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Try to extract a JSON array/object from noisy text
function extractJSON(text) {
  // try direct parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // find first { or [ and last } or ]
    const startObj = text.indexOf("{");
    const startArr = text.indexOf("[");
    const start = (startArr !== -1 && (startArr < startObj || startObj === -1)) ? startArr : startObj;

    const endObj = text.lastIndexOf("}");
    const endArr = text.lastIndexOf("]");
    const end = (endArr !== -1 && (endArr > endObj || endObj === -1)) ? endArr : endObj;

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Cannot locate JSON fragment in AI output");
    }
    const candidate = text.slice(start, end + 1);

    // Clean common markdown fences
    const cleaned = candidate.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(cleaned);
  }
}

// wrapper to call model.generateContent with retry/backoff
async function callModelWithRetry(prompt, options = {}) {
  const maxRetries = options.maxRetries ?? 4;
  let attempt = 0;
  let lastErr;

  while (attempt <= maxRetries) {
    try {
      const model = genAI.getGenerativeModel({
        model: options.model || "gemini-2.5-flash",
        responseMimeType: options.responseMimeType || "application/json"
      });

      const result = await model.generateContent(prompt);
      // .response.text() returns string
      const raw = result.response.text();
      return raw;
    } catch (err) {
      lastErr = err;
      attempt++;
      // If status 503 or transient, back off and retry
      const waitMs = 500 * Math.pow(2, attempt); // exponential backoff
      console.warn(`Model call failed (attempt ${attempt}) — retrying in ${waitMs}ms:`, err.message || err);
      await sleep(waitMs);
    }
  }
  // if exhausted
  throw lastErr;
}

/**
 * generateAIRekomendasi
 * - sensor: object from DB {suhu, kelembaban, tekanan, kelembaban_tanah, lokasi, iklim, ...}
 * - kategori: array or string (we'll stringify if array)
 * returns parsed JSON array (3 items expected)
 */
export async function generateAIRekomendasi(sensor, kategori, existingList = [], jumlah) {
  const kategoriStr = Array.isArray(kategori) ? kategori.join(", ") : String(kategori || "-");

  const prompt = `
  PENTING:
  - Jawab HANYA dengan JSON (array) tanpa penjelasan teks tambahan.
  - Jangan gunakan kode blok (no \`\`\`), jangan tulis "Berikut..." atau kalimat pembuka.
  - Jika sebuah nilai tidak tersedia, isi dengan 0 untuk angka atau "-" untuk string.
  - Output format: Array of objects (see example).

  Data sensor:
  - Suhu: ${sensor.suhu ?? 0}
  - Kelembaban udara: ${sensor.kelembaban ?? 0}
  - Tekanan (hPa): ${sensor.tekanan ?? 0} catatan: pastikan convert hPa ke MDPL waktu dimasukkan ke ketinggian optimal (MDPL)
  - Kelembaban Tanah: ${sensor.kelembaban_tanah ?? 0}
  - Iklim: ${sensor.iklim ?? "-"}
  - Lokasi: ${sensor.lokasi ?? "-"}

  Kategori Yang Boleh Digunakan: ${kategoriStr}. Pastikan awali huruf besar biar konsisten

  Daftar tanaman yang SUDAH ADA dan TIDAK BOLEH diulangi:
  ${existingList.join(", ")}

  Pastikan AI TIDAK mengembalikan nama TANAMAN yang ada di daftar tersebut.

  Berikan *TEPAT* ${jumlah} rekomendasi tanaman. 
  Jumlah ini adalah TOTAL keseluruhan, bukan per kategori.

  Output harus:
  - array dengan panjang PERSIS = ${jumlah}
  - tidak boleh lebih, tidak boleh kurang
  - AI WAJIB mematuhi jumlah ini

  Jika kamu ragu, pilih tanaman yang paling relevan dan batasi sampai jumlah tersebut saja.

  Berikan rekomendasi teratas dalam format JSON seperti:
  [
    {
      "nama":"string",
      "kategori":"string",
      "skor": 0,
      "optimal": { "suhu":0, "kelembaban":0, "ketinggian":0, "kelembaban_tanah":0 },
      "panen":"string",
      "kesulitan":"string",
      "perawatan":"string",
      "musim":"string",
      "harga":0,
      "profit":0,
      "permintaan":"string",
      "tips":"string",
      "kesimpulan":"string"
    }
  ]
  `.trim();

  const raw = await callModelWithRetry(prompt, { maxRetries: 4, responseMimeType: "application/json" });
  const parsed = extractJSON(raw);

  // Ensure we return an array
  if (!Array.isArray(parsed)) {
    throw new Error("AI output is not an array");
  }
  return parsed;
}

/**
 * generateAICustomRekomendasi
 * - for a single custom plant name
 * returns an array (single item expected)
 */
export async function generateAICustomRekomendasi(sensor, nama_tanaman) {
  const prompt = `
  PENTING:
  - Keluarkan HANYA JSON array (tanpa teks).
  - Tentukan kategori tanaman (Buah, Sayuran, Pangan, Tanaman Hias). Pastikan awali huruf besar biar konsisten

  Data Sensor:
  - Suhu: ${sensor.suhu ?? 0}
  - Kelembaban udara: ${sensor.kelembaban ?? 0}
  - Tekanan (hPa): ${sensor.tekanan ?? 0}
  - Kelembaban Tanah: ${sensor.kelembaban_tanah ?? 0}
  - Iklim: ${sensor.iklim ?? "-"}

  Analisis untuk tanaman: ${nama_tanaman}

  Format:
  [
    {
      "nama":"${nama_tanaman}",
      "kategori":"-",
      "skor":0,
      "optimal":{
        "suhu":0,
        "kelembaban":0,
        "ketinggian":0,
        "kelembaban_tanah":0
      },
      "panen":"-",
      "kesulitan":"-",
      "perawatan":"-",
      "musim":"-",
      "harga":0,
      "profit":0,
      "ROI":0,
      "permintaan":"-",
      "tips":"-",
      "kesimpulan":"-"
    }
  ]
`.trim();

  const raw = await callModelWithRetry(prompt, { maxRetries: 4, responseMimeType: "application/json" });
  const parsed = extractJSON(raw);
  if (!Array.isArray(parsed)) throw new Error("AI custom output not array");
  return parsed;
}
