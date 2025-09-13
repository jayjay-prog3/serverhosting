// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// message storage
const DATA_FILE = "messages.json";
let messages = [];

try {
  if (fs.existsSync(DATA_FILE)) {
    messages = JSON.parse(fs.readFileSync(DATA_FILE));
  }
} catch (e) {
  console.error("Error loading messages:", e);
}

function saveMessages() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages.slice(-200), null, 2));
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // send chat history
  socket.emit("previous messages", messages);

  // handle new message
  socket.on("chat message", (msg) => {
    if (!msg.id) msg.id = "m_" + Math.random().toString(36).slice(2, 9);
    msg.senderId = socket.id;

    messages.push(msg);
    if (messages.length > 200) messages = messages.slice(-200);
    saveMessages();

    io.emit("chat message", msg);
  });

  // typing indicators
  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });

  socket.on("stop typing", (data) => {
    socket.broadcast.emit("stop typing", data);
  });

  // reactions
  socket.on("reaction", (data) => {
    const m = messages.find((x) => x.id === data.id);
    if (m) {
      m.reactions = m.reactions || {};
      m.reactions[data.emoji] = m.reactions[data.emoji] || [];

      if (!m.reactions[data.emoji].includes(socket.id)) {
        m.reactions[data.emoji].push(socket.id);
      } else {
        // toggle reaction off
        m.reactions[data.emoji] = m.reactions[data.emoji].filter(
          (u) => u !== socket.id
        );
        if (m.reactions[data.emoji].length === 0) {
          delete m.reactions[data.emoji];
        }
      }

      saveMessages();
      io.emit("reaction", { id: m.id, emoji: data.emoji, userId: socket.id });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on", PORT));
