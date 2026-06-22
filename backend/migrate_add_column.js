import { db } from './db.js';

(async () => {
  try {
    console.log('Running ALTER TABLE to add kelembaban_tanah_optimal...');
    await db.query("ALTER TABLE detail ADD COLUMN kelembaban_tanah_optimal FLOAT NOT NULL DEFAULT 0 AFTER ketinggian_optimal;");
    console.log('ALTER OK');
    process.exit(0);
  } catch (err) {
    console.error('ALTER ERR', err.message || err);
    process.exit(1);
  }
})();
