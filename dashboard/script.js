/* ===============================
   GLOBAL HELPERS
================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("saved-history-container")) {
    console.log("Memanggil loadRiwayat...");
    loadRiwayat();
  }
});

console.log("script.js LOADED");
function showLoading() {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = "flex";
}
function hideLoading() {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = "none";
}
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    // try parse JSON, otherwise return text
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, data: text };
    }
  } catch (err) {
    return { ok: false, status: 0, error: err };
  }
}

/* ===============================
   DASHBOARD: latest sensor + list
   (index.html)
================================ */

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".btn-rekomendasi");
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      console.log("goRekomendasi DIPANGGIL");

      try {
        const res = await fetch("/api/latest-sensor");

        // FIX: handle 404 gracefully
        if (res.status === 404) {
          alert("Belum ada data sensor. Pastikan perangkat sudah mengirim data.");
          return;
        }
        if (!res.ok) {
          alert("Gagal mengambil data sensor.");
          return;
        }

        const data = await res.json();

        console.log("Latest sensor:", data);

        if (!data || !data.id_sensor_data) {
          alert("Belum ada data sensor untuk dianalisis.");
          return;
        }

        window.location.href = `/analisis.html?id=${data.id_sensor_data}`;
      } catch (err) {
        console.error("Fetch error:", err);
        alert("Gagal mengambil data sensor.");
      }
    });
  });
});

window.goRekomendasi = async function () {
  console.log("goRekomendasi DIPANGGIL");

  try {
    const res = await fetch("/api/latest-sensor");

    // FIX: handle 404 gracefully
    if (res.status === 404) {
      alert("Belum ada data sensor. Pastikan perangkat sudah mengirim data.");
      return;
    }
    if (!res.ok) {
      alert("Gagal mengambil data sensor.");
      return;
    }

    const data = await res.json();

    console.log("Latest sensor:", data);

    if (!data || !data.id_sensor_data) {
      alert("Belum ada data sensor untuk dianalisis.");
      return;
    }

    window.location.href = `/analisis.html?id=${data.id_sensor_data}`;
  } catch (err) {
    console.error(err);
  }
};

const API_BASE = window.location.origin;
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${WS_PROTOCOL}//${window.location.hostname}:8080`;

async function muatData() {
  const elTemp = document.getElementById("val-suhu");
  const elHum = document.getElementById("val-kelembaban");
  const elPres = document.getElementById("val-tekanan");
  const elSoil = document.getElementById("val-kelembaban-tanah");

  // skip if page doesn't have those elements
  if (!elTemp && !elHum && !elPres && !elSoil) return;

  const resp = await safeFetch(`${API_BASE}/api/latest-sensor`);
  if (!resp.ok) {
    if (resp.status === 404) {
      // FIX: silent return, no console.error spam — sensor belum ada data
      if (elTemp) elTemp.innerText = "--";
      if (elHum) elHum.innerText = "--";
      if (elPres) elPres.innerText = "--";
      if (elSoil) elSoil.innerText = "--";
      return;
    }
    console.error("Gagal muat latest sensor:", resp);
    return;
  }
  const data = resp.data;
  
  let ketinggian = pressureToAltitude(data.tekanan);
  let formatted = ketinggian.toFixed(2);

  if (elTemp) elTemp.innerText = (data.suhu ?? "--") + "°C";
  if (elHum) elHum.innerText = (data.kelembaban ?? "--") + "%";
  if (elPres) elPres.innerText = (formatted?? "--") + " m";
  if (elSoil) elSoil.innerText = ((data.kelembaban_tanah ?? data.kesuburan_tanah) ?? "--") + " %";
}

// FIX: WebSocket hanya diinisialisasi di halaman dashboard (ada live-data-table)
let ws = null;
if (document.getElementById("live-data-table")) {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("WebSocket connected:", WS_URL);
  };

  ws.onerror = (err) => {
    console.warn("WebSocket error — pastikan server WS berjalan di port 8080:", err);
  };

  ws.onclose = () => {
    console.warn("WebSocket ditutup.");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      let ketinggian = pressureToAltitude(data.tekanan);
      let formatted = ketinggian.toFixed(2);

      const elTemp = document.getElementById("val-suhu");
      const elHum = document.getElementById("val-kelembaban");
      const elPres = document.getElementById("val-tekanan");
      const elSoil = document.getElementById("val-kelembaban-tanah");

      if (elTemp) elTemp.innerText = (data.suhu ?? "--") + "°C";
      if (elHum) elHum.innerText = (data.kelembaban ?? "--") + "%";
      if (elPres) elPres.innerText = (formatted ?? "--") + " m";
      if (elSoil) elSoil.innerText = ((data.kelembaban_tanah ?? data.kesuburan_tanah) ?? "--") + " %";

      // reload tabel jika ada
      loadSensorList();
    } catch (err) {
      console.error("WebSocket message parse error:", err);
    }
  };
}

async function loadSensorList() {
  const tbody = document.getElementById("live-data-table");
  if (!tbody) return;

  const resp = await safeFetch(`${API_BASE}/api/list-data`);
  if (!resp.ok) {
    console.error("Gagal ambil list-data:", resp);
    return;
  }
  const data = resp.data;
  tbody.innerHTML = "";

  (Array.isArray(data) ? data : []).forEach(row => {
    const tr = document.createElement("tr");
    let ketinggian = pressureToAltitude(row.tekanan);
    let formatted = ketinggian.toFixed(2);

    tr.innerHTML = `
      <td>${new Date(row.reading_timestamp).toLocaleString()}</td>
      <td>${row.suhu ?? "-"} °C</td>
      <td>${row.kelembaban ?? "-"} %</td>
      <td>${formatted ?? "-"} m</td>
      <td>${(row.kelembaban_tanah ?? row.kesuburan_tanah) ?? "-"} %</td>
      <td><button class="btn-primary" onclick="lihatDetail(${row.id_sensor_data})">Lihat</button></td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===============================
   SENSOR DETAIL + ANALYSIS UI
   (analisis.html / sensor-detail)
================================ */
async function loadSensorDetail() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const resp = await safeFetch(`${API_BASE}/api/sensor-data/${id}`);
  if (!resp.ok) {
    console.error("Gagal ambil sensor detail:", resp);
    return;
  }
  const data = resp.data;

  let ketinggian = pressureToAltitude(data.tekanan);
  let formatted = ketinggian.toFixed(2);
  // header data
  const rTemp = document.getElementById("r-temp");
  const rHum = document.getElementById("r-humid");
  const rMdpl = document.getElementById("r-mdpl");
  const rSoil = document.getElementById("r-soil");

  if (rTemp) rTemp.innerText = (data.suhu ?? "--") + " °C";
  if (rHum) rHum.innerText = (data.kelembaban ?? "--") + " %";
  if (rMdpl) rMdpl.innerText = (formatted ?? "--") + " m MDPL";
  if (rSoil) rSoil.innerText = ((data.kelembaban_tanah ?? data.kesuburan_tanah) ?? "--") + " %";

  const container = document.getElementById("Custom");
  if (!container) return;

  const btnAnalisis = document.getElementById("btn-analyze");
  
  // FIX: gunakan onclick agar tidak menumpuk
  btnAnalisis.onclick = () => analisisAI(data.id_sensor_data);

  const iklimInput = document.getElementById("iklim");
  const lokasiInput = document.getElementById("lokasi");

  if (data.analisis === 1) {
    if (iklimInput) {
      iklimInput.value = data.iklim || "Tropis";
      iklimInput.disabled = true;  // kunci
      iklimInput.style.backgroundColor = "#eee";
      iklimInput.style.cursor = "not-allowed";
    }

    if (lokasiInput) {
      lokasiInput.value = data.lokasi || "-";
      lokasiInput.disabled = true; // kunci
      lokasiInput.style.backgroundColor = "#eee";
      lokasiInput.style.cursor = "not-allowed";
    }
    container.innerHTML = `
      <input id="customNama" class="form-input" placeholder="Nama Tanaman..." />
      <button class="btn-primary btn-lg" id="btn-add-custom">Analisa Custom Tanaman</button>
    `;

    const btnCustom = document.getElementById("btn-add-custom");

    // juga gunakan onclick untuk custom
    btnCustom.onclick = () => tambahCustom();
  }
}


/* ===============================
   ANALISIS AI (POST /api/analisis/:id)
================================ */
async function analisisAI(id) {
  try {
    showLoading();

    // get fields (IDs from the new UI)
    const iklimEl = document.getElementById("in-climate") || document.getElementById("iklim");
    const lokasiEl = document.getElementById("lokasi");
    const jumlahEl = document.getElementById("jumlah");
    const iklimValue = iklimEl ? iklimEl.value : "";
    const lokasiValue = lokasiEl ? lokasiEl.value : "-";
    const jumlahValue = jumlahEl ? jumlahEl.value : "1";


    // categories: checkbox group, optional — if your endpoint accepts array
    const kategoriEls = [...document.querySelectorAll('.checkbox-group input:checked')];
    const kategoriList = kategoriEls.map(cb => cb.value);

    if (!iklimValue) { hideLoading(); return alert("Pilih iklim terlebih dahulu."); }
    if (kategoriList.length === 0) { hideLoading(); return alert("Pilih minimal satu kategori."); }
    if (jumlahValue < 1 || jumlahValue > 6) { hideLoading(); return alert("Jumlah tidak boleh kurang dari 1 atau lebih dari 6"); }


    // disable analyze button to prevent double-click
    const btn = document.getElementById("btn-analyze");
    if (btn) btn.disabled = true;

    const resp = await safeFetch(`${API_BASE}/api/analisis/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kategori: kategoriList, lokasi: lokasiValue, iklim: iklimValue , jumlah: jumlahValue})
    });

    hideLoading();
    if (!resp.ok) {
      alert("Gagal analisis: " + (resp.data?.error || resp.status));
      if (btn) btn.disabled = false;
      return;
    }
    console.log("RUN analisisAI");
    alert("Analisis selesai! Rekomendasi AI tersimpan.");
    // refresh UI: list rekomendasi + detail header
    await listRekomendasi();
    await loadSensorDetail();
  } catch (err) {
    hideLoading();
    console.error(err);
    alert("Terjadi kesalahan saat analisis.");
  } finally {
    const btn = document.getElementById("btn-analyze");
    if (btn) btn.disabled = false;
  }
}

/* ===============================
   TAMBAH CUSTOM TANAMAN (POST /api/custom-tanaman)
================================ */
async function tambahCustom() {
  showLoading();
  try {
    const sensorId = new URLSearchParams(window.location.search).get("id");
    const namaEl = document.getElementById("customNama");
    if (!namaEl) { hideLoading(); return alert("Input custom tidak ditemukan."); }
    const nama = namaEl.value.trim();
    if (!nama) { hideLoading(); return alert("Nama tanaman tidak boleh kosong."); }

    // disable button while processing
    const btn = document.getElementById("btn-add-custom");
    if (btn) btn.disabled = true;

    const resp = await safeFetch(`${API_BASE}/api/custom-tanaman`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensor_data_id: sensorId, nama_tanaman: nama })
    });
    
    if (resp.status === 409) {
      alert("Tanaman ini sudah ada di daftar. Silakan pilih nama lain.");
      return; 
    }
    if (!resp.ok) {
      alert("Gagal menambah tanaman: " + (resp.data?.error || resp.status));
      return;
    }

    alert(resp.data?.message || "Berhasil!");
    await listRekomendasi();


  } catch (err) {
    console.error(err);
    alert("Terjadi error saat menambah custom.");
  } finally {
    hideLoading();
    const btn = document.getElementById("btn-add-custom");
    if (btn) btn.disabled = false;
  }
}

/* ===============================
   LIST REKOMENDASI (GET /api/list-rekomendasi/:id)
   -> renderResults untuk UI baru (analisis.html)
================================ */
async function listRekomendasi() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const resp = await safeFetch(`${API_BASE}/api/list-rekomendasi/${id}`);
  if (!resp.ok) {
    console.error("Gagal ambil list rekomendasi:", resp);
    return;
  }
  const data = Array.isArray(resp.data) ? resp.data : [];

  const results = data.map(row => ({
    id: row.id_tanaman,
    name: row.nama_tanaman,
    kategori: row.kategori,
    score: row.skor,
    kesimpulan: row.kesimpulan
  }));

  renderResults(results);
}

function renderResults(results) {
  const container = document.getElementById('results-container');
  const wrapper = document.getElementById('recommendation-results');
  if (!container || !wrapper) return;

  container.innerHTML = "";
  wrapper.style.display = results.length ? "block" : "none";

  results.forEach((r, idx) => {
    // Untuk item > 3, medal tidak perlu
    const medal = idx < 3 ? ["🥇","🥈","🥉"][idx] : "🌱";
    const color = idx < 3 ? ["gold","silver","bronze"][idx] : "normal";

    const card = document.createElement("div");
    card.className = `rec-card ${color}`;
    card.innerHTML = `
      <div class="rec-left">
        <div class="medal-icon">${medal}</div>
        <div class="rec-info">
          <h4>${r.name} (${r.kategori})</h4>
          <div class="tags-container"><span class="tag success">Match: ${r.score}%</span></div>
          <p class="kesimpulan">${r.kesimpulan}</p>
        </div>
      </div>
      <div class="rec-right">
        <button class="btn-detail" onclick="showDetail(${r.id})">Lihat Detail <i class="fas fa-arrow-right"></i></button>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ===============================
   DETAIL REKOMENDASI PAGE
   (ai-rekomendasi-detail.html)
   expects endpoint /api/rekomendasi-detail/:id returning single object
================================ */
async function loadRekomendasiDetail() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const resp = await safeFetch(`${API_BASE}/api/rekomendasi-detail/${id}`);
  if (!resp.ok) {
    console.error("Gagal ambil rekom detail:", resp);
    return;
  }
  // backend should return single object (rows[0])
  const data = Array.isArray(resp.data) && resp.data.length ? resp.data[0] : resp.data;

  if (!data) {
    console.error("Data detail kosong:", resp);
    return;
  }

  const profit = data.profit_1000m2 ?? "-";
  const el = document.getElementById("detail-box");
  if (!el) return;

  el.innerHTML = `
    <h2>${data.nama_tanaman}</h2>
    <p><b>Skor Kecocokan:</b> ${data.skor ?? "-"}</p>
    <p><b>Suhu Optimal:</b> ${data.suhu_optimal ?? "-"} °C</p>
    <p><b>Kelembaban Optimal:</b> ${data.kelembaban_optimal ?? "-"} %</p>
    <p><b>Ketinggian Optimal:</b> ${data.ketinggian_optimal ?? "-"}</p>
    <p><b>Waktu Panen:</b> ${data.waktu_panen ?? "-"}</p>
    <p><b>Tingkat Kesulitan:</b> ${data.tingkat_kesulitan ?? "-"}</p>
    <p><b>Perawatan:</b> ${data.perawatan ?? "-"}</p>
    <p><b>Musim Tanam:</b> ${data.musim_tanam ?? "-"}</p>
    <p><b>Harga Pasar:</b> ${data.harga_pasar ?? "-"}</p>
    <p><b>Profit 1000m2:</b> ${profit}</p>
    <p><b>ROI:</b> ${data.ROI ?? "-"}</p>
    <p><b>Permintaan Pasar:</b> ${data.permintaan_pasar ?? "-"}</p>
    <p><b>Tips Budidaya:</b> ${data.tips_budidaya ?? "-"}</p>
    <p><b>Kesimpulan:</b> ${data.kesimpulan ?? "-"}</p>
    <button onclick="window.history.back()">Kembali</button>
  `;
}

/* ===============================
   NAV & UTILS
================================ */
function lihatDetail(id) { window.location.href = "analisis.html?id=" + id; }
//function showDetail(id) { window.location.href = "ai-rekomendasi-detail.html?id=" + id; }
function showDetail(id) {
  createDetailModal(); // pastikan modal ada

  // fetch data
  safeFetch(`${API_BASE}/api/rekomendasi-detail/${id}`).then(resp => {
    const data = resp.ok ? resp.data : null;

    document.getElementById('m-icon').innerText = '🌱';
    document.getElementById('m-title').innerText = data?.nama_tanaman ?? "Data tidak ditemukan";
    document.getElementById('m-score-badge').innerText = `${data?.skor ?? "-"}%`;
    document.getElementById('m-category').innerText = data ? `Kategori: ${data.kategori ?? "-"}` : "-";
    document.getElementById('m-climate').innerText = data ? `Iklim: ${data.iklim_aktual ?? "-"}` : "-";

    document.getElementById('opt-temp').innerText = data ? `: ${data.suhu_optimal ?? "-"} °C` : "-";
    document.getElementById('opt-soil').innerText = data ? `: ${data.kelembaban_optimal ?? "-"} %` : "-";
    document.getElementById('opt-humid').innerText = data ? `: ${data.kelembaban_optimal ?? "-"} %` : "-";
    document.getElementById('opt-alt').innerText = data ? `: ${data.ketinggian_optimal ?? "-"} m` : "-";

    // Card 2: Pertumbuhan
    document.getElementById('d-harvest').innerText = data ? `${data.waktu_panen ?? "-"}` : "-";
    document.getElementById('d-diff').innerText = data ? `${data.tingkat_kesulitan ?? "-"}` : "-";
    document.getElementById('d-season').innerText = data ? `${data.musim_tanam ?? "-"}` : "-";

    // Card 3: Ekonomi
    document.getElementById('d-price').innerText = data ? `${data.harga_pasar ?? "-"}` : "-";
    document.getElementById('d-profit').innerText = data ? `${data.profit_1000m2 ?? "-"}` : "-";
    document.getElementById('d-roi').innerText = data ? `${data.ROI ?? "-"}` : "-";

    // Card 4 & 5: Tips & AI
    document.getElementById('d-tips-text').innerText = data ? `${data.tips_budidaya ?? "-"}` : "-";
    document.getElementById('d-ai-reason').innerText = data ? `${data.kesimpulan ?? "-"}` : "-";

    if(data.simpan === 1){
      document.getElementById('simpan').className = "btn-danger";
      document.getElementById('simpan').innerText = "Hapus Riwayat";
    }
    document.getElementById('simpan').onclick = () => simpanTanaman(id);


    document.getElementById('detailModal').style.display = 'flex';
  }).catch(err => console.error(err));
}

function closeModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.style.display = 'none';
}
function createDetailModal() {
  // if (document.getElementById("detailModal")) return; // sudah ada

  const modal = document.createElement("div");
  modal.id = "detailModal";
  modal.className = "modal-overlay";
  modal.style.display = "none"; // awalnya hidden
  modal.innerHTML = `
    <div class="modal-content detail-modern">
      <div class="modal-header-modern">
        <div class="header-icon" id="m-icon">🥬</div>
        <div class="header-info">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h2 id="m-title">Nama Tanaman</h2>
            <div class="match-badge" id="m-score-badge">--%</div>
          </div>
          <div class="sub-info">
            <span id="m-category">Kategori: -</span>
            <span id="m-climate">Iklim: -</span>
          </div>
        </div>
      </div>

      <div class="modal-body">
        <div class="detail-card card-green">
          <h4>📊 KONDISI OPTIMAL</h4>
          <div class="detail-grid-4">
            <div class="d-item"><span class="lbl">🌡️ Suhu</span><span class="val" id="opt-temp">--</span></div>
            <div class="d-item"><span class="lbl">💧 Tanah</span><span class="val" id="opt-soil">--</span></div>
            <div class="d-item"><span class="lbl">🌫️ Udara</span><span class="val" id="opt-humid">--</span></div>
            <div class="d-item"><span class="lbl">📍 MDPL</span><span class="val" id="opt-alt">--</span></div>
          </div>
        </div>

        <div class="detail-card card-blue">
            <h4>⏱️ WAKTU PERTUMBUHAN</h4>
            <ul class="detail-list">
                <li><span>🌱 Waktu Panen:</span> <strong id="d-harvest">--</strong></li>
                <li><span>📈 Kesulitan:</span> <strong id="d-diff">--</strong></li>
                <li><span>🗓️ Musim:</span> <strong id="d-season">--</strong></li>
            </ul>
        </div>

        <div class="detail-card card-gold">
            <h4>💰 ESTIMASI EKONOMI</h4>
            <ul class="detail-list">
                <li><span>💵 Harga Pasar:</span> <strong id="d-price">--</strong></li>
                <li><span>📊 Profit/1000m²:</span> <strong id="d-profit">--</strong></li>
                <li><span>🎯 ROI:</span> <strong id="d-roi" class="text-green">--</strong></li>
            </ul>
        </div>

        <div class="detail-card card-orange">
            <h4>🌱 PERAWATAN & TIPS</h4>
            <p id="d-tips-text" style="font-size:13px; line-height:1.6; color:#555;">--</p>
        </div>

        <div class="detail-card card-dark">
            <h4 style=" color:#fff;">🤖 KESIMPULAN AI</h4>
            <p id="d-ai-reason" style="font-size:13px; font-style:italic; color:#fff;">--</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeModal()">← Kembali</button>
          <button class="btn-primary" onclick="" id="simpan">💾 Simpan ke Riwayat</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function simpanTanaman(id) {
    fetch(`${API_BASE}/api/simpan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
          if(result.simpan === 1)
          {
            alert("Berhasil disimpan ke riwayat!");
            closeModal();
            window.location.href = `riwayat.html?`;
            loadRiwayat();
          }
          else
          {
            alert("Berhasil dihapus dari riwayat!");
            closeModal();
            loadRiwayat();

          }
        } else {
            alert("Gagal menyimpan");
        }
    })
    .catch(err => console.error(err));
    closeModal();
}

function renderSavedHistory(groups) {
    const container = document.getElementById("saved-history-container");
    const msg = document.getElementById("empty-history-msg");
    if (!container || !msg) return;

    container.innerHTML = "";

    if (!groups || groups.length === 0) {
        msg.style.display = "block";
        return;
    }

    msg.style.display = "none";

    groups.forEach(group => {
        let html = `
        <div class="history-group">

            <div class="history-group-header">📊 Sensor Data #${group.id_sensor_data}</div>
            <div class="history-group-timestamp">
                ${new Date(group.reading_timestamp).toLocaleString()}
            </div>

            <div class="sensor-row">
                <span>🌡️ ${group.suhu}°C</span>
                <span>💧 ${group.kelembaban}%</span>
                <span>🌫️ ${group.tekanan} hPa</span>
                <span>🌍 ${group.iklim}</span>
                <span>📍 ${group.lokasi ?? "-"}</span>
            </div>

            <div style="margin-top: 12px; font-weight:600; font-size:13px; color:#374151;">
                Rekomendasi Tersimpan:
            </div>
        `;

        group.tanaman.forEach(item => {
            html += `
            <div class="history-plant" onclick="showDetail(${item.id_tanaman})">
                <div class="plant-info">
                    <span style="font-size:20px;">🌱</span>
                    <div>
                        <strong>${item.nama_tanaman}</strong>
                        <span style="font-size:11px; color:#6b7280;">ID: ${item.id_tanaman}</span>
                    </div>
                </div>

                <span class="match-badge">${item.skor ?? "?"}% Match</span>
            </div>`;
        });

        html += `</div>`;
        container.innerHTML += html;
    });
}


function loadRiwayat() {
  console.log("loadRiwayat DIPANGGIL");
  fetch("/api/riwayat")
    .then(res => res.json())
    .then(res => {
      console.log("Riwayat:", res);

      if (res.success) {
        renderSavedHistory(res.data);
      }
    })
    .catch(err => console.error("Gagal load riwayat:", err));
}


document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", function(e) {
        const current = window.location.pathname.split("/").pop();
        const target = this.getAttribute("href");

        if (current === target) {
            e.preventDefault();  // mencegah reload
            console.log("Sudah di halaman ini");
        }
    });
});

function clearSavedHistory() {
    if (!confirm("Yakin ingin menghapus semua riwayat?")) return;

    fetch(`${API_BASE}/api/hapus-semua`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            alert("Semua riwayat telah dihapus!");

            // Jika halaman punya komponen riwayat, refresh tampilan
            if (document.getElementById("saved-history-container")) {
                loadRiwayat();
            }
        }
    })
    .catch(err => console.error(err));
}

function pressureToAltitude(pressureHpa, seaLevelPressure = 1013.25) {
    // Tekanan dalam hPa, default tekanan permukaan laut 1013.25 hPa
    return 44330 * (1 - Math.pow(pressureHpa / seaLevelPressure, 0.1903));
}

/* ===============================
   AUTO INIT (runs on every page)
   decides which functions to call
================================ */
(function init() {
  // hide loading overlay initially
  hideLoading();

  // call dashboard functions if elements exist
  if (document.getElementById("live-data-table")) {
    muatData();
    loadSensorList();
    // refresh periodically
    setInterval(muatData, 5000);
  }

  // analysis page (has #recommendation-results wrapper or #analisisOrCustom)
  if (document.getElementById("recommendation-results") || document.getElementById("analisisOrCustom")) {
    loadSensorDetail();
    listRekomendasi();
  }

  // rekom detail page (has #detail-box)
  if (document.getElementById("detail-box")) {
    loadRekomendasiDetail();
  }
})();