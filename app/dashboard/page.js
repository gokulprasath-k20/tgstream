'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Video, PlusSquare, Calendar, MonitorUp, 
  Home, MessageCircle, Clock, Search, MoreHorizontal, User,
  Sun, Moon
} from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDark, setIsDark] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (!data.user) router.push('/login'); else setUser(data.user);
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    document.documentElement.classList.toggle('dark', newTheme);
  };

  if (!user) return null;

  return (
    <div className="zoom-layout">
      {/* 1. Zoom Sidebar */}
      <aside className="zoom-sidebar">
        <div className="sidebar-icon active"><Home size={22} /></div>
        <div className="sidebar-icon"><MessageCircle size={22} /></div>
        <div className="sidebar-icon"><Clock size={22} /></div>
        <div className="sidebar-icon"><User size={22} /></div>
        <div className="mt-auto mb-6 flex flex-col items-center gap-4">
          <button onClick={toggleTheme} className="sidebar-icon">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-xs">
            {user.username[0]}
          </div>
        </div>
      </aside>

      {/* 2. Main Dashboard Area */}
      <main className="zoom-main">
        {/* Top Search Bar */}
        <div className="flex justify-between items-center mb-10">
          <div className="relative w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full bg-gray-100 dark:bg-[#1a1a1a] border-none py-2 pl-10 rounded-lg text-sm outline-none" 
            />
          </div>
          <div className="text-sm font-medium opacity-60">Meeting ID: 342-554-221</div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex gap-20">
          {/* Left: Action Grid */}
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold mb-1">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</h1>
            <p className="text-sm text-gray-500 mb-10">{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            
            <div className="action-grid">
              <div onClick={() => router.push('/room/new')} className="action-card">
                <div className="action-icon-box bg-[#ff742e]">
                  <Video size={48} strokeWidth={2.5} />
                </div>
                <span>New Meeting</span>
              </div>
              <div onClick={() => {
                const id = prompt('Enter Meeting ID:');
                if(id) router.push(`/room/${id}`);
              }} className="action-card">
                <div className="action-icon-box bg-[#0b5fff]">
                  <PlusSquare size={48} strokeWidth={2.5} />
                </div>
                <span>Join</span>
              </div>
              <div className="action-card opacity-50 cursor-not-allowed">
                <div className="action-icon-box bg-[#0b5fff]">
                  <Calendar size={48} strokeWidth={2.5} />
                </div>
                <span>Schedule</span>
              </div>
              <div className="action-card opacity-50 cursor-not-allowed">
                <div className="action-icon-box bg-[#0b5fff]">
                  <MonitorUp size={48} strokeWidth={2.5} />
                </div>
                <span>Share Screen</span>
              </div>
            </div>
          </div>

          {/* Right: Upcoming Preview */}
          <div className="flex-1 max-w-[400px]">
            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-3xl p-8 border border-gray-200 dark:border-white/5 h-[500px] flex flex-col">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="font-bold text-lg">Upcoming</h2>
                 <button className="p-2 hover:bg-gray-200 dark:hover:bg-white/5 rounded-full"><MoreHorizontal size={18}/></button>
               </div>
               <div className="flex-1 flex flex-col items-center justify-center text-center">
                 <div className="w-20 h-20 bg-gray-200 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                    <Calendar size={32} className="text-gray-400" />
                 </div>
                 <p className="text-sm font-medium text-gray-400">No upcoming meetings today</p>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
