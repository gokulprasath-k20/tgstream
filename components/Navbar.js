'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MonitorPlay, LogOut, User } from 'lucide-react';

export default function Navbar({ user }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="h-[70px] border-b border-white/5 bg-transparent flex items-center px-8 z-50">
      <div className="container max-w-7xl mx-auto flex justify-between items-center w-full">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <MonitorPlay size={24} className="text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tighter title-gradient">TGSTREAM</span>
        </Link>

        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-full border border-white/10">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">
                  {user.username[0]}
                </div>
                <span className="text-xs font-semibold text-gray-300">{user.username}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary py-2 px-4 text-xs h-10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-bold text-gray-400 hover:text-white transition-colors">Sign In</Link>
              <Link href="/signup" className="btn btn-primary py-2 px-5 h-10 text-xs">Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
