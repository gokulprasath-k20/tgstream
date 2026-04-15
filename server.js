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

const rooms = new Map();           // roomId → { users: [{id, username}] }
const onlineUsers = new Map();     // userId → socketId  (for DM presence)

io.on("connection", (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // ═══════════════════════════════════════════════════════════════════════════
  //  ROOM EVENTS  (video call, room chat, screen share — unchanged)
  // ═══════════════════════════════════════════════════════════════════════════

  socket.on("join-room", ({ roomId, username }) => {
    socket.data.username = username;
    socket.data.roomId = roomId;

    // Clean up ghost entries for same username
    const existingRoom = rooms.get(roomId);
    if (existingRoom) {
      existingRoom.users = existingRoom.users.filter(u => u.username !== username);
    }

    socket.join(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, { users: [] });

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

  socket.on("toggle-mute",  (roomId) => io.to(roomId).emit("toggle-mute"));
  socket.on("toggle-video", (roomId) => io.to(roomId).emit("toggle-video"));

  socket.on("signal", ({ targetId, signal }) => {
    io.to(targetId).emit("signal", {
      senderId: socket.id,
      senderName: socket.data.username || 'User',
      signal
    });
  });

  socket.on("sync-video", ({ roomId, ...data }) => {
    socket.to(roomId).emit("video-sync", data);
  });

  socket.on("screen-share-status", ({ roomId, isSharing }) => {
    socket.to(roomId).emit("screen-share-status", {
      isSharing,
      from: socket.data.username
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  DM + PRESENCE EVENTS  (new — additive, no existing events touched)
  // ═══════════════════════════════════════════════════════════════════════════

  // User registers their MongoDB userId to receive DMs + publish presence
  socket.on("join-user-room", ({ userId, username }) => {
    socket.data.userId   = userId;
    socket.data.username = socket.data.username || username;

    // Each user gets a personal socket room: "user:<userId>"
    socket.join(`user:${userId}`);
    onlineUsers.set(userId, socket.id);

    // Tell this user who is currently online
    socket.emit("online-users", Array.from(onlineUsers.keys()));
    // Tell everyone else this user came online
    socket.broadcast.emit("user-online", { userId });

    console.log(`[DM] ${username} online  (user:${userId})`);
  });

  // Relay DM to recipient — DB persistence is handled by the Next.js API.
  // "message" here is the object returned by POST /api/conversations/[id]/messages
  socket.on("send-dm", ({ conversationId, recipientId, message }) => {
    // Deliver to recipient's personal room
    io.to(`user:${recipientId}`).emit("receive-dm", { conversationId, message });
    // Mirror to sender's OTHER tabs/devices (not this socket)
    if (socket.data.userId) {
      socket.to(`user:${socket.data.userId}`).emit("receive-dm", { conversationId, message });
    }
  });

  // Typing indicators — pure relay, no DB
  socket.on("typing-start", ({ conversationId, recipientId }) => {
    io.to(`user:${recipientId}`).emit("typing-start", {
      conversationId,
      senderName: socket.data.username || 'User',
    });
  });

  socket.on("typing-stop", ({ conversationId, recipientId }) => {
    io.to(`user:${recipientId}`).emit("typing-stop", { conversationId });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  VOICE CALL EVENTS  (audio-only WebRTC, uses personal user rooms)
  // ═══════════════════════════════════════════════════════════════════════════

  // Caller → recipient: ring
  socket.on("voice-call-user", ({ recipientId, callerName }) => {
    io.to(`user:${recipientId}`).emit("incoming-voice-call", {
      callerId:   socket.data.userId,
      callerName: callerName || socket.data.username || "Unknown",
    });
  });

  // Callee accepts — notify caller
  socket.on("voice-call-accept", ({ callerId }) => {
    io.to(`user:${callerId}`).emit("voice-call-accepted", {
      accepterId:   socket.data.userId,
      accepterName: socket.data.username,
    });
  });

  // Callee rejects — notify caller
  socket.on("voice-call-reject", ({ callerId }) => {
    io.to(`user:${callerId}`).emit("voice-call-rejected", {
      rejecterId: socket.data.userId,
    });
  });

  // Either party ends the call
  socket.on("voice-call-end", ({ recipientId }) => {
    if (recipientId) io.to(`user:${recipientId}`).emit("voice-call-ended");
  });

  // WebRTC SDP / ICE relay for voice call (separate event namespace from video)
  socket.on("voice-call-signal", ({ recipientId, signal }) => {
    io.to(`user:${recipientId}`).emit("voice-call-signal", {
      senderId: socket.data.userId,
      signal,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONTACT REQUEST NOTIFICATIONS  (server relay)
  // ═══════════════════════════════════════════════════════════════════════════

  socket.on("send-contact-request", ({ recipientId, senderName, conversationId }) => {
    io.to(`user:${recipientId}`).emit("new-contact-request", {
      senderId:       socket.data.userId,
      senderName:     senderName || socket.data.username,
      conversationId,
    });
  });

  socket.on("contact-request-accepted", ({ recipientId }) => {
    io.to(`user:${recipientId}`).emit("contact-request-accepted", {
      accepterId:   socket.data.userId,
      accepterName: socket.data.username,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  DISCONNECT
  // ═══════════════════════════════════════════════════════════════════════════


  socket.on("disconnect", () => {
    // Room cleanup
    rooms.forEach((room, roomId) => {
      const idx = room.users.findIndex(u => u.id === socket.id);
      if (idx !== -1) {
        const username = room.users[idx].username;
        room.users.splice(idx, 1);
        io.to(roomId).emit("user-left", { id: socket.id, username });
        if (room.users.length === 0) rooms.delete(roomId);
      }
    });

    // DM presence cleanup
    if (socket.data.userId) {
      onlineUsers.delete(socket.data.userId);
      socket.broadcast.emit("user-offline", { userId: socket.data.userId });
      console.log(`[DM] user:${socket.data.userId} offline`);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.io server running on port ${port}`);
});
