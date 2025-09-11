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

// --- config ---
const MAX_MESSAGES = 200;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

// helper to validate base64 image
function isValidImage(base64) {
  if (typeof base64 !== "string") return false;
  if (!base64.startsWith("data:image/")) return false;
  const sizeInBytes = Buffer.byteLength(base64, "base64");
  if (sizeInBytes > MAX_IMAGE_SIZE) return false;
  return true;
}

// socket logic
io.on("connection", (socket) => {
  console.log("a user connected");

  // send previous messages to this user
  socket.emit("previous messages", chatHistory);

  socket.on("chat message", (msg) => {
    // normalize message shape
    let safeMsg = {
      profile: msg.profile || { name: "Guest", type: "color", color: "#5865f2" },
      text: msg.text || "",
      image: null,
      t: msg.t || Date.now()
    };

    // validate image if present
    if (msg.image && isValidImage(msg.image)) {
      safeMsg.image = msg.image;
    } else if (msg.image) {
      console.warn("⚠️ Invalid or too large image dropped");
    }

    // add to history
    chatHistory.push(safeMsg);

    // keep only last MAX_MESSAGES
    if (chatHistory.length > MAX_MESSAGES) {
      chatHistory = chatHistory.slice(-MAX_MESSAGES);
    }

    // save to file
    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
      console.error("Error writing messages.json:", err);
    }

    // broadcast new message
    io.emit("chat message", safeMsg);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
