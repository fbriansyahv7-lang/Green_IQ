import mqtt from "mqtt";
import dotenv from "dotenv";
import { db } from "./db.js";
import { wss } from "./ws-server.js";
import { WebSocket } from "ws";

dotenv.config();
console.log("MQTT FILE LOADED");
console.log("BROKER:", process.env.MQTT_BROKER);
console.log("PORT:", process.env.MQTT_PORT);
console.log("USER:", process.env.MQTT_USERNAME);

const client = mqtt.connect({
  host: process.env.MQTT_BROKER,
  port: Number(process.env.MQTT_PORT),
  protocol: "mqtts",
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  rejectUnauthorized: false,
});

client.on("connect", () => {
  console.log("MQTT CONNECTED to HiveMQ Cloud");
  client.subscribe(process.env.MQTT_TOPIC, (err) => {
    if (err) console.error("Subscribe gagal:", err);
    else console.log("Subscribed ke:", process.env.MQTT_TOPIC);
  });
});

client.on("error", (err) => {
  console.error("MQTT ERROR:", err);
});

client.on("message", async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log("MQTT Received:", data);

    const { label, suhu, kelembaban, tekanan, kelembaban_tanah } = data;

    // Lookup perangkat by label
    const [rows] = await db.query(
      "SELECT id_perangkat FROM perangkat WHERE label = ? LIMIT 1",
      [label]
    );

    if (rows.length === 0) {
      console.log("❌ Perangkat tidak terdaftar, data diabaikan");
      return;
    }

    const id_perangkat = rows[0].id_perangkat;

    // INSERT pakai kolom sesuai struktur DB lama:
    // - kelembaban_tanah → kesuburan_tanah
    // - timestamp       → reading_timestamp (auto)
    const [result] = await db.query(
      `INSERT INTO sensor_data
      (id_perangkat, suhu, kelembaban, tekanan, kesuburan_tanah, lokasi, iklim, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_perangkat,
        suhu,
        kelembaban,
        tekanan,
        kelembaban_tanah,
        null,
        null,
        JSON.stringify({ dari: "ESP32" })
      ]
    );

    const id_sensor_data = result.insertId;
    console.log("✅ Data sensor disimpan, id:", id_sensor_data);

    // Broadcast ke semua WebSocket clients
    wss.clients.forEach(wsClient => {
      if (wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify({
          id_sensor_data,
          id_perangkat,
          suhu,
          kelembaban,
          tekanan,
          kelembaban_tanah,
          timestamp: new Date()
        }));
      }
    });

  } catch (err) {
    console.error("❌ MQTT Error:", err);
  }
});
