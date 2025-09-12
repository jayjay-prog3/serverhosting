const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (req, res) => {
  res.send("Server is live!");
});

const MESSAGES_FILE = path.join(__dirname, "messages.json");
let chatHistory = [];

if (fs.existsSync(MESSAGES_FILE)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
  } catch (err) {
    console.error("Error reading messages.json:", err);
  }
}

// --- config ---
const MAX_MESSAGES = 200;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const LIMIT = 3; // messages
const WINDOW = 5000; // ms
const MUTE_TIME = 10000; // ms

// spam tracking
const spamMap = new Map(); // socket.id -> {timestamps:[], violations:0, mutedUntil:0}

function isValidImage(base64) {
  if (typeof base64 !== "string") return false;
  if (!base64.startsWith("data:image/")) return false;
  const sizeInBytes = Buffer.byteLength(base64, "base64");
  if (sizeInBytes > MAX_IMAGE_SIZE) return false;
  return true;
}

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.emit("previous messages", chatHistory);

  socket.on("chat message", (msg) => {
    let track = spamMap.get(socket.id) || { timestamps: [], violations: 0, mutedUntil: 0 };
    const now = Date.now();

    // check mute
    if (track.mutedUntil > now) {
      socket.emit("mute", Math.ceil((track.mutedUntil - now) / 1000));
      return;
    }

    // push timestamp + clean window
    track.timestamps.push(now);
    track.timestamps = track.timestamps.filter(t => now - t < WINDOW);

    if (track.timestamps.length > LIMIT) {
      track.violations++;
      if (track.violations === 1) {
        socket.emit("warning", "⚠️ Slow down!");
      } else {
        track.mutedUntil = now + MUTE_TIME;
        track.violations = 0; // reset violations after mute
        socket.emit("mute", MUTE_TIME / 1000);
      }
      spamMap.set(socket.id, track);
      return; // block message
    }

    spamMap.set(socket.id, track);

    // normalize message
    let safeMsg = {
      profile: msg.profile || { name: "Guest", type: "color", color: "#5865f2" },
      text: msg.text || "",
      image: null,
      t: msg.t || Date.now()
    };

    if (msg.image && isValidImage(msg.image)) {
      safeMsg.image = msg.image;
    }

    chatHistory.push(safeMsg);
    if (chatHistory.length > MAX_MESSAGES) {
      chatHistory = chatHistory.slice(-MAX_MESSAGES);
    }

    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
      console.error("Error writing messages.json:", err);
    }

    io.emit("chat message", safeMsg);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    spamMap.delete(socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
