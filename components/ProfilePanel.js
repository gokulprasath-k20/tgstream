'use client';
import { useState, useEffect } from 'react';
import { Copy, Check, X, Shield, Globe, Users, EyeOff, Pencil } from 'lucide-react';

const PRIVACY_OPTIONS = [
  {
    value:   'everyone',
    label:   'Everyone',
    icon:    Globe,
    desc:    'Anyone can message you directly',
    color:   'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
  },
  {
    value:   'contacts',
    label:   'Contacts Only',
    icon:    Users,
    desc:    'Unknown users go to Message Requests',
    color:   'text-indigo-400',
    bgColor: 'bg-indigo-500/10 border-indigo-500/30',
  },
  {
    value:   'nobody',
    label:   'Nobody',
    icon:    EyeOff,
    desc:    'No one can send you new messages',
    color:   'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
  },
];

export default function ProfilePanel({ user, onClose, onPrivacyChange }) {
  const [profile, setProfile]   = useState(null);
  const [copied, setCopied]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editBio, setEditBio]   = useState(false);
  const [bio, setBio]           = useState('');
  const [privacy, setPrivacy]   = useState(user?.chatPrivacy || 'everyone');
  const [statusMsg, setStatus]  = useState('');

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile);
        setBio(d.profile?.bio || '');
        setPrivacy(d.profile?.chatPrivacy || 'everyone');
      });
  }, []);

  const copyTgId = () => {
    const id = profile?.tgId;
    if (!id) return;
    navigator.clipboard.writeText(`@${id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const saveProfile = async () => {
    setSaving(true);
    setStatus('');
    try {
      const res  = await fetch('/api/user/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bio, chatPrivacy: privacy }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(p => ({ ...p, bio, chatPrivacy: privacy }));
        setStatus('Saved ✓');
        setEditBio(false);
        onPrivacyChange?.(privacy);
        setTimeout(() => setStatus(''), 2500);
      } else {
        setStatus(data.error || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const avatarColors = ['bg-indigo-600','bg-violet-600','bg-pink-600','bg-emerald-600','bg-amber-600'];
  const avatarBg = avatarColors[(user?.username?.charCodeAt(0) || 0) % avatarColors.length];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8 flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
        <h2 className="font-bold text-white text-sm flex-1">My Profile</h2>
        {statusMsg && <span className="text-xs text-green-400 font-medium">{statusMsg}</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar + Name section */}
        <div className={`flex flex-col items-center py-8 px-4 ${avatarBg}/10`}>
          <div className={`w-20 h-20 rounded-full ${avatarBg} flex items-center justify-center font-bold text-white text-3xl mb-3 ring-4 ring-white/10`}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <p className="font-bold text-white text-lg">{user?.username}</p>
          <p className="text-gray-400 text-xs mt-1">{user?.email}</p>
        </div>

        {/* TG ID card — the centrepiece */}
        <div className="mx-4 mt-4 bg-indigo-600/10 border border-indigo-500/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-indigo-400" />
            <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider">Your TG ID</p>
          </div>
          {profile?.tgId ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-white text-xl font-bold tracking-wider">
                @{profile.tgId}
              </p>
              <button
                onClick={copyTgId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  copied
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/8 text-gray-300 hover:bg-white/15 border border-white/10'
                }`}
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
          ) : (
            <div className="h-7 w-32 bg-white/10 rounded-lg animate-pulse" />
          )}
          <p className="text-gray-600 text-[11px] mt-2 leading-relaxed">
            Share this ID with people so they can find and add you.
            Your phone number is <strong className="text-gray-500">never visible</strong> to others.
          </p>
        </div>

        {/* Bio */}
        <div className="mx-4 mt-3 bg-white/3 border border-white/8 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Bio</p>
            <button
              onClick={() => setEditBio(e => !e)}
              className="p-1 rounded-lg hover:bg-white/8 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </div>
          {editBio ? (
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 160))}
              placeholder="Write something about yourself…"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/50 resize-none"
            />
          ) : (
            <p className="text-sm text-gray-300 leading-relaxed min-h-[36px]">
              {profile?.bio || <span className="text-gray-600 italic">No bio yet. Tap ✏️ to add one.</span>}
            </p>
          )}
          {editBio && (
            <p className="text-right text-[10px] text-gray-600 mt-1">{bio.length}/160</p>
          )}
        </div>

        {/* Privacy Settings */}
        <div className="mx-4 mt-3 mb-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
            Who can message me
          </p>
          <div className="flex flex-col gap-2">
            {PRIVACY_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = privacy === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setPrivacy(opt.value)}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                    active ? opt.bgColor : 'bg-white/3 border-white/8 hover:border-white/15'
                  }`}
                >
                  <Icon size={18} className={active ? opt.color : 'text-gray-500'} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${active ? 'text-white' : 'text-gray-300'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                  {active && (
                    <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save button */}
      {(editBio || privacy !== (profile?.chatPrivacy || 'everyone')) && (
        <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving…</>
              : 'Save Changes'
            }
          </button>
        </div>
      )}
    </div>
  );
}
