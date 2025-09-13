const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let messages = [];
const MAX_MESSAGES = 100;

// track spam
const spamTracker = {};
const SPAM_LIMIT = 4;      // number of messages allowed
const SPAM_WINDOW = 4000;  // ms window
const MUTE_TIME = 10;      // seconds muted

io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  // send history
  socket.emit("previous messages", messages);

  // --- handle new message ---
  socket.on("chat message", (msg) => {
    // spam check
    const now = Date.now();
    if (!spamTracker[socket.id]) spamTracker[socket.id] = [];
    spamTracker[socket.id] = spamTracker[socket.id].filter(t => now - t < SPAM_WINDOW);
    spamTracker[socket.id].push(now);

    if (spamTracker[socket.id].length > SPAM_LIMIT) {
      socket.emit("warning", "⚠️ Stop spamming! You are muted for " + MUTE_TIME + "s.");
      socket.emit("mute", MUTE_TIME);
      return;
    }

    msg.senderId = socket.id;
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();
    io.emit("chat message", msg);
  });

  // --- typing ---
  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });

  socket.on("stop typing", (data) => {
    socket.broadcast.emit("stop typing", data);
  });

  // --- reactions ---
  socket.on("reaction", (data) => {
    let msg = messages.find(m => m.id === data.id);
    if (!msg) return;
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[data.emoji]) msg.reactions[data.emoji] = [];

    let users = msg.reactions[data.emoji];
    if (users.includes(socket.id)) {
      // toggle off
      msg.reactions[data.emoji] = users.filter(u => u !== socket.id);
    } else {
      users.push(socket.id);
    }
    io.emit("reaction", { id: data.id, emoji: data.emoji, userId: socket.id });
  });

  // --- edit message ---
  socket.on("edit message", (data) => {
    let msg = messages.find(m => m.id === data.id);
    if (msg && msg.senderId === socket.id) {
      msg.text = data.text;
      msg.edited = true;
      io.emit("edit message", { id: data.id, text: data.text });
    }
  });

  // --- delete message ---
  socket.on("delete message", (data) => {
    let idx = messages.findIndex(m => m.id === data.id);
    if (idx !== -1 && messages[idx].senderId === socket.id) {
      messages.splice(idx, 1);
      io.emit("delete message", { id: data.id });
    }
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
    delete spamTracker[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
