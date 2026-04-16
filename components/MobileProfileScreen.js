'use client';
import { useState, useEffect } from 'react';
import {
  Copy, Check, Shield, Globe, Users, EyeOff,
  Pencil, LogOut, ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const PRIVACY_OPTIONS = [
  { value: 'everyone', label: 'Everyone',      Icon: Globe,   desc: 'Anyone can message you',            color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  { value: 'contacts', label: 'Contacts Only', Icon: Users,   desc: 'Others go to Message Requests',     color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  { value: 'nobody',   label: 'Nobody',        Icon: EyeOff,  desc: 'No one can send you new messages',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
];

export default function MobileProfileScreen({ user }) {
  const router  = useRouter();
  const [profile,  setProfile]  = useState(null);
  const [copied,   setCopied]   = useState(false);
  const [editBio,  setEditBio]  = useState(false);
  const [bio,      setBio]      = useState('');
  const [privacy,  setPrivacy]  = useState(user?.chatPrivacy || 'contacts');
  const [saving,   setSaving]   = useState(false);
  const [status,   setStatus]   = useState('');

  const hasChanges = editBio || privacy !== (profile?.chatPrivacy || 'contacts');

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile);
        setBio(d.profile?.bio || '');
        setPrivacy(d.profile?.chatPrivacy || 'contacts');
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

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      const res  = await fetch('/api/user/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bio, chatPrivacy: privacy }),
      });
      if (res.ok) {
        setProfile(p => ({ ...p, bio, chatPrivacy: privacy }));
        setEditBio(false);
        setStatus('Saved ✓');
        setTimeout(() => setStatus(''), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const COLORS = ['bg-indigo-600','bg-violet-600','bg-pink-600','bg-emerald-600','bg-amber-600'];
  const avatarBg = COLORS[(user?.username?.charCodeAt(0) || 0) % COLORS.length];

  return (
    <div className="flex flex-col h-full bg-[#05060f] overflow-y-auto no-scrollbar">

      {/* Avatar hero */}
      <div className={`flex flex-col items-center pt-8 pb-6 px-4 ${avatarBg}/10`}>
        <div className={`w-24 h-24 rounded-full ${avatarBg} flex items-center justify-center font-bold text-white text-4xl mb-3 ring-4 ring-white/10 shadow-2xl`}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <p className="font-bold text-white text-xl">{user?.username}</p>
        <p className="text-gray-400 text-xs mt-1">{user?.email}</p>
        {status && <p className="text-green-400 text-xs font-medium mt-2 animate-pulse">{status}</p>}
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4 pb-24">

        {/* TG ID card */}
        <div className="bg-indigo-600/10 border border-indigo-500/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={13} className="text-indigo-400" />
            <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider">Your TG ID</p>
          </div>
          {profile?.tgId ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-white text-2xl font-bold tracking-wider">@{profile.tgId}</p>
              <button
                id="copy-tgid-btn"
                onClick={copyTgId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                  copied
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/8 text-gray-300 hover:bg-white/15 border border-white/10'
                }`}
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
          ) : (
            <div className="h-8 w-36 skeleton rounded-xl" />
          )}
          <p className="text-gray-600 text-[11px] mt-2 leading-relaxed">
            Share this ID — your phone number is <strong className="text-gray-500">never exposed</strong>.
          </p>
        </div>

        {/* Bio */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Bio</p>
            <button
              onClick={() => setEditBio(e => !e)}
              className="p-1 rounded-lg hover:bg-white/8 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </div>
          {editBio ? (
            <>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 160))}
                placeholder="Write something about yourself…"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/50 resize-none"
              />
              <p className="text-right text-[10px] text-gray-600 mt-1">{bio.length}/160</p>
            </>
          ) : (
            <p className="text-sm text-gray-300 leading-relaxed min-h-[36px]">
              {profile?.bio || <span className="text-gray-600 italic">No bio yet. Tap ✏️ to add one.</span>}
            </p>
          )}
        </div>

        {/* Privacy */}
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            Who can message me
          </p>
          <div className="flex flex-col gap-2">
            {PRIVACY_OPTIONS.map(({ value, label, Icon, desc, color, bg }) => {
              const active = privacy === value;
              return (
                <button
                  key={value}
                  id={`privacy-${value}`}
                  onClick={() => setPrivacy(value)}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    active ? bg : 'bg-white/3 border-white/8'
                  }`}
                >
                  <Icon size={18} className={active ? color : 'text-gray-500'} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${active ? 'text-white' : 'text-gray-300'}`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
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

        {/* Save button */}
        {hasChanges && (
          <button
            id="save-profile-btn"
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {saving
              ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving…</>
              : 'Save Changes'
            }
          </button>
        )}

        {/* Logout */}
        <button
          id="logout-btn"
          onClick={logout}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-red-500/8 border border-red-500/15 text-red-400 hover:bg-red-500/15 transition-all active:scale-[0.98] mt-2"
        >
          <div className="flex items-center gap-3">
            <LogOut size={16} />
            <span className="font-semibold text-sm">Sign Out</span>
          </div>
          <ChevronRight size={15} className="opacity-50" />
        </button>
      </div>
    </div>
  );
}
