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
