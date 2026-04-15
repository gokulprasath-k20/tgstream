import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  // ── Core identity ──────────────────────────────────────────────────────────
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false,
  },

  // ── TG ID — like Telegram's @username (auto-generated, unique, public) ─────
  tgId: {
    type: String,
    unique: true,
    sparse: true,      // allow null on old docs before migration
    trim: true,
    index: true,
  },

  // ── Optional phone — stored but NEVER exposed in API responses ────────────
  phone: {
    type: String,
    select: false,     // never returned by default
    trim: true,
  },

  // ── Contacts & Privacy ─────────────────────────────────────────────────────
  contacts:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Explicit request tracking (complements Conversation.isRequest)
  contactRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  // incoming
  sentRequests:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  // outgoing

  chatPrivacy: {
    type: String,
    enum: ['everyone', 'contacts', 'nobody'],
    default: 'everyone',
  },

  // ── E2EE public key (private key stays client-side in IndexedDB) ──────────
  publicKey: { type: String },  // ECDH P-256 spki → base64

  // ── Profile ────────────────────────────────────────────────────────────────
  bio:      { type: String, maxlength: 160, default: '' },
  lastSeen: { type: Date },

}, { timestamps: true });

// ── Indexes for fast search ───────────────────────────────────────────────────
UserSchema.index({ tgId: 1 });
UserSchema.index({ username: 'text' });           // full-text username search

// ── Password hashing ──────────────────────────────────────────────────────────
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// ── Helpers ───────────────────────────────────────────────────────────────────
UserSchema.methods.isContact  = function (uid) { return this.contacts.some(id => id.equals(uid)); };
UserSchema.methods.hasBlocked = function (uid) { return this.blockedUsers.some(id => id.equals(uid)); };

// ── Public projection (what's safe to send to other users) ───────────────────
UserSchema.statics.publicFields = 'username tgId bio publicKey _id';  // phone is EXCLUDED

// ── Next.js HMR fix ───────────────────────────────────────────────────────────
if (mongoose.models?.User) delete mongoose.models.User;
export default mongoose.model('User', UserSchema);
