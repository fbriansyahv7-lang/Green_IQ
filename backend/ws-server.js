import { WebSocketServer } from "ws";

// Dashboard connect ke port 8080
export const wss = new WebSocketServer({ port: 8080 });

wss.on("listening", () => {
  console.log("WebSocket server listening on ws://0.0.0.0:8080");
});

wss.on("error", (err) => {
  console.error("WebSocket server error:", err);
});
