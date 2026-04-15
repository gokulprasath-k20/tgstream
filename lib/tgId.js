import mongoose from 'mongoose';
import User from '@/models/User';

/**
 * Generate a unique TG ID like: tg_A7K9X2
 * 6 chars from A-Z + 0-9 (36^6 = 2.1 billion combinations)
 */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed I/O/0/1 for readability

export function generateTgIdRaw() {
  let id = 'tg_';
  for (let i = 0; i < 6; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return id;
}

/**
 * Generate a guaranteed-unique TG ID by checking MongoDB.
 * Tries up to 10 times before failing (astronomically unlikely).
 */
export async function generateUniqueTgId() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateTgIdRaw();
    const exists = await User.findOne({ tgId: candidate }).lean();
    if (!exists) return candidate;
  }
  throw new Error('Failed to generate a unique TG ID after 10 attempts');
}

/**
 * Validate TG ID format: tg_ followed by 6 alphanumeric chars (case-insensitive check)
 */
export function isValidTgId(tgId) {
  return typeof tgId === 'string' && /^tg_[A-Z2-9]{6}$/i.test(tgId);
}
