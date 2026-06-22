import { WebSocketServer } from "ws";

export let wss;

export function initWS(server) {
  wss = new WebSocketServer({ server });

  wss.on("listening", () => {
    console.log("WebSocket server listening (shared port)");
  });

  wss.on("error", (err) => {
    console.error("WebSocket server error:", err);
  });
}