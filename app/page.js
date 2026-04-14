import Link from 'next/link';
import { Play, Shield, Users, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
      <section className="animate-fade-in">
        <h1 className="title" style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>
          Watch Movies Together,<br />
          <span style={{ color: 'var(--primary)', WebkitTextFillColor: 'var(--primary)' }}>Anywhere, Anytime.</span>
        </h1>
        <p className="subtitle" style={{ maxWidth: '700px', margin: '0 auto 3rem' }}>
          Experience the ultimate watch party with TGStream. High-quality screen sharing, 
          crystal clear video calls, and instant chat — all in one secure, premium platform.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
            Get Started Free
          </Link>
          <Link href="/login" className="btn btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
            Sign In
          </Link>
        </div>
      </section>

      <section className="grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '2rem', 
        marginTop: '100px' 
      }}>
        {[
          { icon: <Shield />, title: 'Highly Secure', desc: 'JWT protected and encrypted signaling ensures your data stays private.' },
          { icon: <Zap />, title: 'Low Latency', desc: 'WebRTC powered streaming for near-zero delay playback and calls.' },
          { icon: <Users />, title: 'AnyDesk Style', desc: 'Connect easily using simple Room IDs, just like your favorite remote apps.' },
          { icon: <Play />, title: 'Seamless UI', desc: 'Premium dark mode interface designed for the best viewing experience.' },
        ].map((feature, i) => (
          <div key={i} className="card" style={{ textAlign: 'left' }}>
            <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{feature.icon}</div>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>{feature.title}</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>{feature.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
