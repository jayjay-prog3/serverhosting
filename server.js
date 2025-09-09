const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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
let voiceUsers = []; // { username, color }

app.get("/", (req, res) => {
  res.send("Server is live!");
});

io.on("connection", (socket) => {
  console.log("a user connected");

  // send previous chat messages
  socket.emit("previous messages", chatHistory);

  // send current voice users
  socket.emit("current-voice-users", voiceUsers);

  // chat message handling
  socket.on("chat message", (msg) => {
    chatHistory.push(msg);
    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
      console.error("Error writing messages.json:", err);
    }
    io.emit("chat message", msg);
  });

  // --- Voice channel events ---
  socket.on("join-voice", (user) => {
    if (!voiceUsers.find(u => u.username === user.username)) {
      voiceUsers.push(user);
      io.emit("user-joined-voice", user);
    }
  });

  socket.on("leave-voice", (username) => {
    voiceUsers = voiceUsers.filter(u => u.username !== username);
    io.emit("user-left-voice", username);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    // Remove from voice users if in channel
    const leavingUsers = voiceUsers.filter(u => u.socketId === socket.id);
    leavingUsers.forEach(u => io.emit("user-left-voice", u.username));
    voiceUsers = voiceUsers.filter(u => u.socketId !== socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
