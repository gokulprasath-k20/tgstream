'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Plus, Hash, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [joinId, setJoinId] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (!data.user) router.push('/login'); else setUser(data.user);
    });
  }, [router]);

  const createRoom = async () => {
    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roomName || `${user.username}'s Party`, password })
    });
    const data = await res.json();
    if (res.ok) router.push(`/room/${data.roomId}`);
  };

  const joinRoom = () => { if (joinId) router.push(`/room/${joinId}`); };

  if (!user) return <div className="min-h-screen bg-[#05060f] flex items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#05060f]">
      <Navbar user={user} />
      
      <main className="container max-w-5xl mx-auto px-6 py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold mb-2">Welcome back, <span className="title-gradient">{user.username}</span></h1>
          <p className="text-gray-400">Start a new party or join an existing one.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Create Room */}
          <section className="card group hover:border-indigo-500/30 transition-all">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Plus className="text-indigo-500" size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Create a New Room</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Host your own party and invite friends with a private Room ID.</p>
            
            <div className="space-y-4">
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="password" 
                  placeholder="Room Password (Optional)" 
                  className="input pl-12" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <button onClick={createRoom} className="btn btn-primary w-full py-4 text-lg">
                Create Party Room
                <Zap size={20} />
              </button>
            </div>
          </section>

          {/* Join Room */}
          <section className="card group hover:border-blue-500/30 transition-all">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Hash className="text-blue-500" size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Join Existing Room</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Already have an ID? Enter it below to join your friend's stream.</p>
            
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Enter Room ID (e.g. bhd-ehge-mck)" 
                className="input" 
                value={joinId}
                onChange={e => setJoinId(e.target.value)}
              />
              <button onClick={joinRoom} className="btn btn-secondary w-full py-4 text-lg">
                Join Meeting
                <ArrowRight size={20} />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
