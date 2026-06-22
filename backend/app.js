import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { createServer } from "http";

import { router } from "./routes.js";
import "./mqtt.js";
import { initWS } from "./ws-server.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const DASHBOARD_DIR = path.join(ROOT_DIR, "dashboard");

app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use(express.static(DASHBOARD_DIR));

const PORT = process.env.PORT || 3000;

// Gabung HTTP + WebSocket di satu port
const server = createServer(app);
initWS(server);

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`WebSocket listening on ws://localhost:${PORT}`);
});