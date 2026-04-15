const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const port = process.env.PORT || 3001;
const httpServer = http.createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);
  
  socket.on("join-room", ({ roomId, username }) => {
    // Store username on socket for signal relay
    socket.data.username = username;
    socket.data.roomId = roomId;

    // Clean up ghost users with same username
    const existingRoom = rooms.get(roomId);
    if (existingRoom) {
      existingRoom.users = existingRoom.users.filter(u => u.username !== username);
    }

    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: [] });
    }
    
    const room = rooms.get(roomId);
    if (!room.users.find(u => u.id === socket.id)) {
      room.users.push({ id: socket.id, username });
    }

    console.log(`[Room ${roomId}] ${username} joined. Total: ${room.users.length}`);

    socket.to(roomId).emit("user-joined", { id: socket.id, username });
    socket.emit("existing-users", room.users.filter(u => u.id !== socket.id));

    socket.on("ready-for-handshake", () => {
      socket.to(roomId).emit("initiate-call", { id: socket.id, username });
    });
  });

  socket.on("send-message", ({ roomId, ...msgData }) => {
    io.to(roomId).emit("receive-message", msgData);
  });

  socket.on("toggle-mute", (roomId) => {
    io.to(roomId).emit("toggle-mute");
  });

  socket.on("toggle-video", (roomId) => {
    io.to(roomId).emit("toggle-video");
  });

  socket.on("signal", ({ targetId, signal }) => {
    // Include senderName so the receiver knows who is calling
    io.to(targetId).emit("signal", { 
      senderId: socket.id, 
      senderName: socket.data.username || 'User',
      signal 
    });
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex(u => u.id === socket.id);
      if (userIndex !== -1) {
        const username = room.users[userIndex].username;
        room.users.splice(userIndex, 1);
        io.to(roomId).emit("user-left", { id: socket.id, username });
        if (room.users.length === 0) rooms.delete(roomId);
      }
    });
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.io server running on port ${port}`);
});
