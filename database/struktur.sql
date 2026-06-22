CREATE TABLE IF NOT EXISTS perangkat (
  id_perangkat INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_data (
    id_sensor_data INT AUTO_INCREMENT PRIMARY KEY,
    id_perangkat INT NOT NULL,
    suhu FLOAT NOT NULL,
    kelembaban FLOAT NOT NULL,
    tekanan FLOAT NOT NULL,
    kesuburan_tanah FLOAT NOT NULL,
    lokasi VARCHAR(255) NULL,
    iklim VARCHAR(100) NULL,
    meta JSON NULL,
    reading_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analisis boolean DEFAULT FALSE,

    FOREIGN KEY (id_perangkat) REFERENCES perangkat(id_perangkat)
      ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_rekomendasi_tanaman (
    id_tanaman INT AUTO_INCREMENT PRIMARY KEY,
    sensor_data_id INT NOT NULL,
    nama_tanaman VARCHAR(100) NOT NULL,
    kategori VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


    FOREIGN KEY (sensor_data_id) REFERENCES sensor_data(id_sensor_data)
      ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS detail (
    id_detail INT AUTO_INCREMENT PRIMARY KEY,
    id_tanaman INT NOT NULL,
    skor FLOAT NOT NULL,

    -- kondisi optimal
    suhu_optimal FLOAT NOT NULL,
    kelembaban_optimal FLOAT NOT NULL,
    -- kelembaban_tanah_optimal disimpan sebagai kolom terpisah
    kelembaban_tanah_optimal FLOAT NOT NULL,
    ketinggian_optimal FLOAT NOT NULL,

    -- informasi pertumbuhan
    waktu_panen VARCHAR(100) NOT NULL,
    tingkat_kesulitan VARCHAR(100) NOT NULL,
    perawatan VARCHAR(255) NOT NULL,
    musim_tanam VARCHAR(100) NOT NULL,

    -- Estimasi Ekonomi
    harga_pasar FLOAT NOT NULL,
    profit_1000m2 FLOAT NULL,
    ROI FLOAT NOT NULL,
    permintaan_pasar VARCHAR(255) NOT NULL,

    -- tips budidaya
    tips_budidaya TEXT NOT NULL,

    kesimpulan TEXT NOT NULL,

    FOREIGN KEY (id_tanaman) REFERENCES ai_rekomendasi_tanaman(id_tanaman)
      ON DELETE CASCADE
);
