import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlassboxHero from '../components/GlassboxHero';
import ScrollVelocity from '../components/ScrollVelocity';
import Navbar from '../components/Navbar';

const FEATURES = [
  { icon: '01', title: '5 Specialized Agents',         desc: 'Concierge, Catalog RAG, Negotiation, Risk ML, and Payment each run as visible, named LangGraph nodes — no silent middleware.',                                                color: '#0149ae',  bg: 'rgba(1,73,174,0.05)',   border: 'rgba(1,73,174,0.15)' },
  { icon: '02', title: 'Unbypassable Spend Ceilings',  desc: 'Hard guardrails enforced deterministically — the LLM cannot negotiate past a spend ceiling. Visual tripwire shows exactly when a rule fires.',                              color: '#032676',  bg: 'rgba(3,38,118,0.05)',   border: 'rgba(3,38,118,0.15)' },
  { icon: '03', title: 'ML Risk Intelligence',          desc: 'Real XGBoost+LightGBM ensemble scores every transaction with honest precision/recall. SHAP feature bars show exactly why a score was assigned.',                            color: '#1250b2',  bg: 'rgba(18,80,178,0.05)',  border: 'rgba(18,80,178,0.15)' },
  { icon: '04', title: 'Explorable Knowledge Graph',   desc: 'Every decision flows into a live, clickable graph. Click any node and see the exact prompt, ML features, or Razorpay response behind it.',                                  color: '#032676',  bg: 'rgba(3,38,118,0.04)',   border: 'rgba(3,38,118,0.12)' },
  { icon: '05', title: 'Merchant Revenue Intelligence', desc: 'AI buyers accepted 78% of listings with structured return policy vs. 41% without. GLASSBOX turns audit events into actionable merchant insights.',                          color: '#0149ae',  bg: 'rgba(1,73,174,0.05)',   border: 'rgba(1,73,174,0.15)' },
  { icon: '06', title: 'Graceful Failure Handling',    desc: 'Decline, 1 retry, escalate and stop. No infinite retries, no silent failures. Every step visible and auditable in real time.',                                              color: '#1250b2',  bg: 'rgba(18,80,178,0.05)',  border: 'rgba(18,80,178,0.15)' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg-warm)] flex flex-col">
      <Navbar />

      <GlassboxHero />

      {/* Scroll strip */}
      <div className="w-full py-10 relative z-0 bg-[var(--color-bg-warm)] overflow-hidden">
        <ScrollVelocity texts={['Agentic Commerce', 'Explainable AI']} velocity={100} className="text-4xl md:text-[5rem] drop-shadow-md text-[var(--color-primary-light)] mx-4 opacity-20 font-['Antonio'] font-bold tracking-[-0.02em]" numCopies={4} damping={50} stiffness={400} />
        <div className="mt-6">
          <ScrollVelocity texts={['Auditable Decisions', 'Trust Layer']} velocity={100} className="text-4xl md:text-[5rem] drop-shadow-md text-[var(--color-primary-light)] mx-4 opacity-20 font-['Antonio'] font-bold tracking-[-0.02em]" numCopies={4} damping={50} stiffness={400} />
        </div>
      </div>

      {/* Feature Cards */}
      <section style={{ background: '#f8f6f0', padding: '5rem 1.5rem' }}>
        <div className="container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-block', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0149ae', background: 'rgba(1,73,174,0.08)', padding: '0.3rem 0.9rem', borderRadius: '99px', border: '1px solid rgba(1,73,174,0.2)', marginBottom: '1rem' }}>
              GLASSBOX Platform
            </div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', margin: '0 0 0.75rem 0', color: '#032676' }}>
              Make the Invisible, Visible
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(30,30,30,0.55)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
              Most agentic demos ask you to trust a black box. GLASSBOX makes the AI think out loud — in real time, beautifully.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="animate-slide-in"
                style={{ background: f.bg, border: `1px solid ${f.border}`, padding: '1.5rem', borderRadius: '10px', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px rgba(1,73,174,0.1)`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: f.color, fontFamily: "'Antonio', sans-serif", marginBottom: '0.6rem' }}>{f.icon}</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 700, color: f.color, fontFamily: 'inherit' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e1e1e', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#032676', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '680px', margin: '0 auto' }}>
          <h2 style={{ color: '#ffffff', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', margin: '0 0 1rem 0' }}>
            Ready to See AI Commerce with the Lid Off?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            AI can reason freely. AI cannot spend freely. See the guardrails in action.
          </p>
          <Link to={user ? '/checkout' : '/login'} className="btn-primary" style={{ background: '#ffffff', color: '#032676', fontSize: '1rem', padding: '0.85rem 2.25rem', boxShadow: 'none' }}>
            {user ? 'Open Checkout Cockpit' : 'Start the Demo'}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(1,73,174,0.1)', padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'rgba(30,30,30,0.4)', background: '#f8f6f0' }}>
        GLASSBOX · Built for Razorpay Buildathon 2026 · Agentic Commerce with Explainability
      </footer>
    </div>
  );
}
