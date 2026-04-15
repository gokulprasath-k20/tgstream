'use client';
import { useState, useEffect } from 'react';
import { useRouter as useNextRouter } from 'next/navigation';
import {
  Video, Plus, Calendar, Monitor,
  Home, MessageSquare, Clock, Search, MoreVertical, Settings,
  LogOut, Shield, Zap
} from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useNextRouter();

  const generateMeetingID = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part()}-${part()}-${part()}`;
  };

  const startNewMeeting = () => {
    const id = generateMeetingID();
    router.push(`/room/${id}`);
  };

  const joinMeeting = () => {
    const id = prompt('Enter Meeting ID (e.g. abcd-efgh-ijkl):');
    if (id) {
      const cleanId = id.trim().toLowerCase();
      router.push(`/room/${cleanId}`);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (!data.user) router.push('/login'); else setUser(data.user);
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router]);

  if (!user) return <div className="min-h-screen bg-[#05060f] flex items-center justify-center"><Zap size={40} className="text-indigo-500 animate-pulse" /></div>;

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="min-h-screen bg-[#05060f] text-white flex overflow-hidden font-jakarta">

      {/* 1. Ultra-Modern Sidebar */}
      <aside className="w-24 border-r border-white/5 bg-white/[0.02] flex flex-col items-center py-10 gap-10">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/20">
          <Monitor size={24} className="text-white" />
        </div>

        <nav className="flex flex-col gap-6">
          <div className="sidebar-icon active"><Home size={22} /></div>
          <div className="sidebar-icon"><MessageSquare size={22} /></div>
          <div className="sidebar-icon"><Clock size={22} /></div>
          <div className="sidebar-icon"><Settings size={22} /></div>
        </nav>

        <button className="mt-auto sidebar-icon text-red-100 hover:bg-red-400/20">
          <LogOut size={22} />
        </button>
      </aside>

      {/* 2. Main Content Container */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />

        {/* Header Section */}
        <header className="px-12 py-8 flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-3">
              <span className="text-gray-500 font-medium tracking-tight italic">TG</span>
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Stream</span>
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="bg-white/5 border border-white/5 rounded-2xl px-6 py-3 flex items-center gap-4 backdrop-blur-md">
              <div className="text-right">
                <p className="font-bold text-lg leading-none">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="w-[1px] h-8 bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center font-bold italic shadow-lg shadow-indigo-600/20">
                  {user.username[0].toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Action Center */}
        <div className="flex-1 px-12 py-6 grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10 overflow-y-auto">

          {/* Action Grid (Primary) */}
          <div className="lg:col-span-8 space-y-10">
            <div>
              <h2 className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">{greeting}, {user.username}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div onClick={startNewMeeting} className="dashboard-card group">
                  <div className="w-16 h-16 bg-orange-500 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xl shadow-orange-500/20">
                    <Video size={32} />
                  </div>
                  <h3 className="font-bold">New Meeting</h3>
                </div>

                <div onClick={joinMeeting} className="dashboard-card group">
                  <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xl shadow-blue-600/20">
                    <Plus size={32} />
                  </div>
                  <h3 className="font-bold">Join Room</h3>
                </div>

                <div className="dashboard-card opacity-40 grayscale cursor-not-allowed">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mb-4">
                    <Calendar size={32} />
                  </div>
                  <h3 className="font-bold">Schedule</h3>
                </div>

                <div className="dashboard-card opacity-40 grayscale cursor-not-allowed">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mb-4">
                    <Monitor size={32} />
                  </div>
                  <h3 className="font-bold">Share Screen</h3>
                </div>
              </div>
            </div>

            {/* Quick Access Area */}
            <div className="bg-gradient-to-br from-indigo-600/20 to-transparent border border-white/10 rounded-[40px] p-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8">
                <Zap size={160} className="text-indigo-400/5 transform rotate-12 group-hover:text-indigo-400/10 transition-all duration-700" />
              </div>
              <div className="relative z-10 max-w-lg">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-4">
                  <Shield size={14} />
                  <span>End-to-End Encrypted</span>
                </div>
                <h2 className="text-4xl font-extrabold mb-6 leading-tight">Ready for a watch party?</h2>
                <p className="text-gray-400 mb-10 leading-relaxed text-lg">
                  Invite your friends, share your screen, and enjoy synchronized high-quality streaming together.
                </p>
                <button onClick={startNewMeeting} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all hover:scale-105 shadow-xl shadow-indigo-600/20">
                  Start a Session
                  <Zap size={18} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>

          {/* Side Panel (Upcoming Info) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white/5 border border-white/5 rounded-[40px] p-8 h-full flex flex-col backdrop-blur-sm">
              <div className="flex justify-between items-center mb-10">
                <h3 className="font-bold text-xl tracking-tight">Today</h3>
                <button className="p-2 hover:bg-white/10 rounded-xl transition-colors"><MoreVertical size={20} /></button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="w-24 h-24 bg-white/[0.03] rounded-[36px] flex items-center justify-center mb-8 border border-white/5">
                  <Clock size={40} className="text-gray-700" />
                </div>
                <p className="font-bold text-xl text-gray-200">Quiet for now</p>
                <p className="text-sm text-gray-500 mt-4 leading-relaxed">No upcoming meetings scheduled for the rest of the day.</p>
              </div>

              <div className="mt-10 pt-10 border-t border-white/5">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                    <Monitor size={20} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Device Status</p>
                    <p className="text-sm font-bold text-indigo-400">Streaming Verified</p>
                  </div>
                </div>
              </div>
            </div>
          </div>



        </div>
      </main>
    </div>

  );
}
