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
const vcUsers = {};

app.get("/", (req, res) => {
  res.send("Server is live!");
});

io.on("connection", (socket) => {
  console.log("A user connected");

  // Send previous chat messages
  socket.emit("previous messages", chatHistory);

  // Send current VC users
  socket.emit("current vc users", vcUsers);

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

  // Voice channel join
  socket.on("vc join", (data) => {
    vcUsers[data.user] = { color: data.color, image: data.image };
    io.emit("vc join", data); // notify everyone
  });

  // Voice channel leave
  socket.on("vc leave", (data) => {
    delete vcUsers[data.user];
    io.emit("vc leave", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    // Remove from VC if present
    for (let user in vcUsers) {
      if (vcUsers.hasOwnProperty(user) && user === socket.id) {
        delete vcUsers[user];
        io.emit("vc leave", { user });
      }
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
