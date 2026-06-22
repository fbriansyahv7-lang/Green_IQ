import { db } from './db.js';

const [rows] = await db.query('SELECT * FROM Perangkat');
console.log(rows);