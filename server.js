const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const port = process.env.PORT || 3001;
const httpServer = http.createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} joined room: ${roomId}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: [] });
    }
    const room = rooms.get(roomId);
    if (!room.users.find(u => u.id === socket.id)) {
      room.users.push({ id: socket.id, username });
    }

    socket.to(roomId).emit("user-joined", { id: socket.id, username });
    
    // Send list of existing users to the new user
    socket.emit("existing-users", room.users.filter(u => u.id !== socket.id));
  });

  socket.on("send-message", ({ roomId, message, username, timestamp }) => {
    io.to(roomId).emit("receive-message", { message, username, timestamp });
  });

  // WebRTC Signaling
  socket.on("signal", ({ roomId, targetId, signal }) => {
    io.to(targetId).emit("signal", { senderId: socket.id, signal });
  });

  // Screen Share Status
  socket.on("screen-share-status", ({ roomId, isSharing, username }) => {
    socket.to(roomId).emit("screen-share-changed", { isSharing, username, sharerId: socket.id });
  });

  // Sync Movie Playback (Optional but good)
  socket.on("sync-video", ({ roomId, action, time }) => {
    socket.to(roomId).emit("video-sync", { action, time });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex(u => u.id === socket.id);
      if (userIndex !== -1) {
        const username = room.users[userIndex].username;
        room.users.splice(userIndex, 1);
        io.to(roomId).emit("user-left", { id: socket.id, username });
        if (room.users.length === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.io server running on port ${port}`);
});
