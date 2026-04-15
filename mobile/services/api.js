/**
 * TGStream Mobile — API service
 * Update API_BASE to your deployed backend URL.
 */
import * as SecureStore from 'expo-secure-store';

export const API_BASE = 'http://192.168.1.x:3000'; // ← replace with your local IP or deployed URL
const TOKEN_KEY = 'tgstream_jwt';

// ── Auth helpers ─────────────────────────────────────────────────────────────
export async function storeToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const login    = (email, password)       => apiFetch('/api/auth/login',    { method: 'POST', body: JSON.stringify({ email, password }) });
export const register = (username, email, pass) => apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password: pass }) });
export const getMe    = ()                       => apiFetch('/api/auth/me');

// ── Conversations ─────────────────────────────────────────────────────────────
export const getConversations  = ()             => apiFetch('/api/conversations');
export const createConversation = (recipientId) => apiFetch('/api/conversations', { method: 'POST', body: JSON.stringify({ recipientId }) });

// ── Messages ─────────────────────────────────────────────────────────────────
export const getMessages  = (convId, before) => apiFetch(`/api/conversations/${convId}/messages${before ? `?before=${before}` : ''}`);
export const sendMessage  = (convId, body)   => apiFetch(`/api/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(body) });

// ── Contact Requests ─────────────────────────────────────────────────────────
export const getRequests    = ()      => apiFetch('/api/contact/requests');
export const acceptRequest  = (id)   => apiFetch('/api/contact/accept', { method: 'POST', body: JSON.stringify({ conversationId: id }) });
export const rejectRequest  = (id)   => apiFetch('/api/contact/reject', { method: 'POST', body: JSON.stringify({ conversationId: id }) });
export const getContactList = ()     => apiFetch('/api/contact/list');
export const blockUser      = (uid)  => apiFetch('/api/contact/block',  { method: 'POST', body: JSON.stringify({ userId: uid }) });

// ── Users ─────────────────────────────────────────────────────────────────────
export const searchUsers = (q) => apiFetch(`/api/users?q=${encodeURIComponent(q)}`);

// ── File Upload (multipart) ───────────────────────────────────────────────────
export async function uploadFile(fileUri, fileName, mimeType) {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: fileName, type: mimeType });

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}
