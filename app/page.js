import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Shield, Zap, Layout, Share2, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#05060f]">
      <Navbar />
      
      <main className="container max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full text-indigo-400 text-xs font-bold mb-8 animate-fade-in">
          <Zap size={14} />
          <span>EXPERIENCE THE FUTURE OF WATCH PARTIES</span>
        </div>

        <h1 className="text-6xl sm:text-7xl font-extrabold mb-6 tracking-tight leading-tight">
          Watch Movies Together, <br />
          <span className="title-gradient">Anywhere, Anytime.</span>
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
          Experience the ultimate watch party with TGStream. High-quality screen sharing, crystal clear video calls, and instant chat — all in one secure, premium platform.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link href="/signup" className="btn btn-primary px-10 py-4 text-lg w-full sm:w-auto">
            Get Started Free
            <ArrowRight size={20} />
          </Link>
          <Link href="/login" className="btn btn-secondary px-10 py-4 text-lg w-full sm:w-auto">
            Sign In to Account
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left border-t border-white/5 pt-20">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all group">
            <Shield className="text-indigo-500 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold mb-2">Highly Secure</h3>
            <p className="text-sm text-gray-400 leading-relaxed">JWT protected and encrypted signaling ensures your data stays private.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all group">
            <Zap className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold mb-2">Low Latency</h3>
            <p className="text-sm text-gray-400 leading-relaxed">WebRTC powered streaming for near-zero delay playback and calls.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all group">
            <Share2 className="text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold mb-2">AnyDesk Style</h3>
            <p className="text-sm text-gray-400 leading-relaxed">Connect easily using simple Room IDs, just like your favorite remote apps.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all group">
            <Layout className="text-cyan-500 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold mb-2">Seamless UI</h3>
            <p className="text-sm text-gray-400 leading-relaxed">Premium dark mode interface designed for the best viewing experience.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
