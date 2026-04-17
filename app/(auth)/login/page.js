'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MonitorPlay, Mail, Lock, ArrowRight, Zap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Login failed: ${data.error || 'Invalid credentials'}`);
      console.error('Login error:', data);
    }
  };

  return (
    <div className="min-h-screen bg-[#05060f] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent">
      <div className="w-full max-w-[440px] animate-slide-up">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-600/40">
            <MonitorPlay size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Welcome Back</h1>
          <p className="text-gray-400 font-medium">Log in to your TGStream dashboard</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="email" className="input pl-12" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="password" className="input pl-12" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full py-4 text-lg mt-2">
              Sign In
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="mt-8 text-center border-t border-white/5 pt-8">
            <p className="text-gray-400 text-sm">
              Don't have an account? <Link href="/signup" className="text-indigo-400 font-bold hover:text-indigo-300">Create one for free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
