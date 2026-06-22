import dotenv from "dotenv";
dotenv.config(); // must run before any module that reads process.env

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

import { router } from "./routes.js";
import "./mqtt.js"; // start MQTT listener

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const DASHBOARD_DIR = path.join(ROOT_DIR, "dashboard");

// Middleware – order matters: JSON parsing before routes, static last
app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use(express.static(DASHBOARD_DIR));

// Dashboard belum ada — fallback dinonaktifkan dulu

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});