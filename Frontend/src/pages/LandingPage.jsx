import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="flex flex-col h-screen justify-center items-center text-center">
      <div className="glass-box" style={{ maxWidth: '800px', width: '90%' }}>
        <h1 style={{ fontSize: '4rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
          GlassBox
        </h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--color-primary-light)' }}>
          The Trust Layer for Agentic Commerce
        </h2>
        
        <p className="mt-4 mb-4" style={{ fontSize: '1.2rem', lineHeight: '1.6' }}>
          Merchants become AI-buyer-ready, and every money decision stays 
          explainable, bounded, and auditable.
        </p>
        
        <div style={{ marginTop: '2rem' }}>
          <Link to="/checkout" className="btn-primary">
            Experience Agent Checkout
          </Link>
        </div>
      </div>
      
      <div style={{ marginTop: '4rem', opacity: 0.7, fontSize: '0.9rem' }}>
        <p>Built with minimal design. No black boxes.</p>
      </div>
    </div>
  );
}
