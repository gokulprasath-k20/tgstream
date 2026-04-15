/**
 * lib/crypto.js  —  Client-side End-to-End Encryption
 *
 * Algorithm: ECDH P-256 (key agreement) + AES-GCM 256-bit (message encryption)
 * Private key stays in IndexedDB ONLY — never sent to the server.
 * Public key is stored in MongoDB so other users can encrypt messages for you.
 *
 * Usage:
 *   const { encryptForUser, decryptMessage } = useCrypto(myUserId);
 */

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
const IDB_NAME  = 'tgstream-e2ee';
const IDB_STORE = 'keypairs';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = ({ target: { result: db } }) => {
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'userId' });
      }
    };
    req.onsuccess = ({ target: { result } }) => resolve(result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(userId) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(userId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(record) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Key generation & export ───────────────────────────────────────────────────

/** Generate an ECDH P-256 key pair and store private key in IndexedDB */
export async function generateAndStoreKeyPair(userId) {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,           // extractable so we can persist it
    ['deriveKey'],
  );
  // Store both keys under userId
  await idbPut({ userId, privateKey: keyPair.privateKey, publicKey: keyPair.publicKey });
  return keyPair;
}

/** Load from IndexedDB or generate fresh if missing */
export async function getOrGenerateKeyPair(userId) {
  const stored = await idbGet(userId);
  if (stored?.privateKey) return stored;
  return generateAndStoreKeyPair(userId);
}

/** Export public key → base64 (SPKI format, safe to share via API) */
export async function exportPublicKey(publicKey) {
  const buf = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Import a base64 SPKI public key received from the server */
export async function importPublicKey(base64) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki', bytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],   // public keys have no usages in ECDH
  );
}

// ── Shared secret + message encryption ───────────────────────────────────────

/** Derive a shared AES-GCM key using ECDH (my private + their public) */
export async function deriveSharedKey(myPrivateKey, theirPublicKeyBase64) {
  const theirKey = await importPublicKey(theirPublicKeyBase64);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,            // not extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext string.
 * Returns { encryptedText: string, iv: string } — both base64.
 */
export async function encryptMessage(plaintext, sharedKey) {
  const iv      = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, encoded);
  return {
    encryptedText: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv:            btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt an encrypted message.
 * @param {string} encryptedText - base64 ciphertext
 * @param {string} iv            - base64 initialization vector
 * @param {CryptoKey} sharedKey  - derived AES-GCM key
 * @returns {string} plaintext
 */
export async function decryptMessage(encryptedText, iv, sharedKey) {
  const cipher  = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv),            c => c.charCodeAt(0));
  const plain   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, sharedKey, cipher);
  return new TextDecoder().decode(plain);
}

// ── Convenience: keep a cache of sharedKeys by conversationId ─────────────────
const sharedKeyCache = new Map();

/**
 * High-level helper used by ChatWindow.
 * Returns the shared AES-GCM key for a (myPrivateKey, theirPublicKeyBase64) pair,
 * cached so we don't re-derive on every message.
 */
export async function getSharedKey(cacheKey, myPrivateKey, theirPublicKeyBase64) {
  if (sharedKeyCache.has(cacheKey)) return sharedKeyCache.get(cacheKey);
  const key = await deriveSharedKey(myPrivateKey, theirPublicKeyBase64);
  sharedKeyCache.set(cacheKey, key);
  return key;
}
