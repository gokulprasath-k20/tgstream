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
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: [] });
    }
    
    const room = rooms.get(roomId);
    if (!room.users.find(u => u.id === socket.id)) {
      room.users.push({ id: socket.id, username });
    }

    console.log(`[Room ${roomId}] ${username} (${socket.id}) joined. Total users: ${room.users.length}`);

    // Notify others that a user is in the room
    socket.to(roomId).emit("user-joined", { id: socket.id, username });
    socket.emit("existing-users", room.users.filter(u => u.id !== socket.id));

    // Special event to trigger handshake once camera is ready
    socket.on("ready-for-handshake", () => {
      console.log(`[Handshake] ${username} is ready for signals.`);
      socket.to(roomId).emit("initiate-call", { id: socket.id, username });
    });
  });

  socket.on("send-message", ({ roomId, message, username, timestamp }) => {
    console.log(`[Chat ${roomId}] Message from ${username}`);
    io.to(roomId).emit("receive-message", { message, username, timestamp });
  });

  socket.on("signal", ({ targetId, signal }) => {
    io.to(targetId).emit("signal", { senderId: socket.id, signal });
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
