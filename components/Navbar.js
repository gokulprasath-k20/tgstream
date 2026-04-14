'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, MonitorPlay } from 'lucide-react';
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  };

  return (
    <nav className="glass" style={{
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000,
      padding: '1rem 0'
    }}>
      <div className="container flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2" style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--primary)' }}>
          <MonitorPlay size={32} />
          <span>TGStream</span>
        </Link>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link href="/dashboard" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Dashboard</Link>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{user.username}</span>
                <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" style={{ fontWeight: 500 }}>Login</Link>
              <Link href="/signup" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
