import { io } from 'socket.io-client';
import { getToken } from './api';

export const SOCKET_URL = 'http://192.168.1.x:3001'; // ← match server.js PORT

let socket = null;

export function getSocket() {
  return socket;
}

export async function connectSocket(userId, username) {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    socket.emit('join-user-room', { userId, username });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });

  return socket;
}

export function disconnectSocket() {
  socket?.close();
  socket = null;
}
