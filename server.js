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

// --- Messages storage ---
const MESSAGES_FILE = path.join(__dirname, "messages.json");
let chatHistory = [];

// Load previous messages if file exists
if (fs.existsSync(MESSAGES_FILE)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
  } catch (err) {
    console.error("Error reading messages.json:", err);
  }
}

// --- Voice channel users ---
let vcUsers = []; // { socketId, username, color }

// test route
app.get("/", (req, res) => {
  res.send("Server is live!");
});

// socket logic
io.on("connection", (socket) => {
  console.log("a user connected");

  // send previous messages to this user
  socket.emit("previous messages", chatHistory);

  // Chat messages
  socket.on("chat message", (msg) => {
    chatHistory.push(msg);
    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
      console.error("Error writing messages.json:", err);
    }
    io.emit("chat message", msg);
  });

  // --- Voice channel logic ---
  socket.on("join-vc", ({ socketId, username, color }) => {
    if(!vcUsers.find(u=>u.socketId===socketId)){
      vcUsers.push({ socketId, username, color });
    }
    io.emit("vc-update", vcUsers);
  });

  socket.on("leave-vc", ({ socketId }) => {
    vcUsers = vcUsers.filter(u=>u.socketId!==socketId);
    io.emit("vc-update", vcUsers);
  });

  // --- WebRTC signaling ---
  socket.on("webrtc-offer", ({ to, offer }) => {
    io.to(to).emit("webrtc-offer", { from: socket.id, offer });
  });
  socket.on("webrtc-answer", ({ to, answer }) => {
    io.to(to).emit("webrtc-answer", { from: socket.id, answer });
  });
  socket.on("webrtc-candidate", ({ to, candidate }) => {
    io.to(to).emit("webrtc-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    vcUsers = vcUsers.filter(u=>u.socketId!==socket.id);
    io.emit("vc-update", vcUsers);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
