'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, MonitorPlay, Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .catch(() => setUser(null));
  }, []);

  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.className = newTheme;
    localStorage.setItem('theme', newTheme);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  };

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000,
      padding: '0.75rem 0',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)'
    }}>
      <div className="container flex justify-between items-center" style={{ padding: '0 1rem' }}>
        <Link href="/" className="flex items-center gap-1" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
          <MonitorPlay size={24} />
          <span>TG</span>
        </Link>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme} 
            className="btn btn-secondary" 
            style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {user ? (
            <>
              <Link href="/dashboard" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Dashboard</Link>
              <div className="flex items-center gap-3" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.username}</span>
                <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Login</Link>
              <Link href="/signup" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
