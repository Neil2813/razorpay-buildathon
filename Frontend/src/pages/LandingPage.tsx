// LandingPage.tsx
import GlassboxHero from '../components/GlassboxHero';
import Navbar from '../components/Navbar';

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-[#f8f6f0] flex flex-col">
      <Navbar />

      <GlassboxHero />

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(1,73,174,0.1)', padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'rgba(30,30,30,0.4)', background: '#f8f6f0' }}>
        GLASSBOX · Built for Razorpay Buildathon 2026 · Agentic Commerce with Explainability
      </footer>
    </div>
  );
}
