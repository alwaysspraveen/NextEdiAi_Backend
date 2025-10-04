// server.js
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

// Allow multiple frontends: comma-separated origins in WEB_ORIGIN
const ORIGINS = (process.env.WEB_ORIGIN || "http://localhost:4200")
  .split(",")
  .map((s) => s.trim());

const PORT = Number(process.env.PORT || 5000);

// Create HTTP server from your Express app
const server = http.createServer(app);

// Attach Socket.IO
const io = new Server(server, {
  path: "/socket.io",
  cors: { origin: ORIGINS, credentials: true },
});

// Make io available inside controllers: req.app.get('io')
app.set("io", io);

// Rooms: per-tenant and optional per-user
io.on("connection", (socket) => {
  const tenantId =
    socket.handshake.auth?.tenantId ||
    socket.handshake.query?.tenantId ||
    socket.handshake.headers?.["x-tenant-id"];

  if (tenantId) socket.join(`calendar-${tenantId}`);

  const userId =
    socket.handshake.auth?.userId || socket.handshake.query?.userId;
  if (userId) socket.join(`user-${userId}`);

  // (optional) basic ping/pong
  socket.on("ping", () => socket.emit("pong"));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ CampusFlow API running on http://localhost:${PORT}`);
});

module.exports = { server, io };
