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

// test route
app.get("/", (req, res) => {
  res.send("Server is live!");
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

// socket logic
io.on("connection", (socket) => {
  console.log("a user connected");

  // send previous messages to this user
  socket.emit("previous messages", chatHistory);

  socket.on("chat message", (msg) => {
    chatHistory.push(msg);

    // save to file
    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
      console.error("Error writing messages.json:", err);
    }

    // broadcast new message
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
