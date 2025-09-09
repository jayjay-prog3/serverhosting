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

// --- Voice Channel Users ---
let vcUsers = [];

// test route
app.get("/", (req, res) => {
  res.send("Server is live!");
});

io.on("connection", (socket) => {
  console.log("a user connected");

  // Send previous messages to the user
  socket.emit("previous messages", chatHistory);

  // CHAT MESSAGE
  socket.on("chat message", (msg) => {
    chatHistory.push(msg);
    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
      console.error("Error writing messages.json:", err);
    }
    io.emit("chat message", msg);
  });

  // JOIN VC
  socket.on("join-vc", (user) => {
    if(!vcUsers.find(u=>u.socketId===user.socketId)){
      vcUsers.push(user);
    }
    io.emit("vc-update", vcUsers);
  });

  // LEAVE VC
  socket.on("leave-vc", (user) => {
    vcUsers = vcUsers.filter(u => u.socketId !== user.socketId);
    io.emit("vc-update", vcUsers);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    // remove from VC if in VC
    vcUsers = vcUsers.filter(u => u.socketId !== socket.id);
    io.emit("vc-update", vcUsers);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
