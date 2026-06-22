import mysql from 'mysql2/promise';

async function setup() {
  try {
    const db = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'greeniq',
    });

    // Insert perangkat
    await db.query(
      "INSERT INTO perangkat (label) VALUES ('perangkat1')"
    );
    
    console.log('✅ Perangkat "perangkat1" berhasil ditambahkan ke database!');
    
    // Cek data
    const [rows] = await db.query('SELECT * FROM perangkat WHERE label = ?', ['perangkat1']);
    console.log('Data perangkat:', rows[0]);
    
    db.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

setup();
