import { useState, useEffect, useRef } from 'react';
import { Lock, ShieldAlert, RefreshCw, Send, ShieldX, CheckCircle, Globe, Play } from 'lucide-react';
import Navbar from '../components/Navbar';
import AgentRail from '../components/AgentRail';
import KnowledgeGraph, { AuditEvent } from '../components/KnowledgeGraph';
import RiskFeatureChart, { RiskFeaturesData } from '../components/RiskFeatureChart';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface PaymentAttempt { attempt: number; timestamp: string; status: string; reason?: string; }

interface DiscoveredCandidate {
  product_id: string;
  name: string;
  price: number;
  source_site?: string;
  review_summary?: string;
  has_return_policy?: boolean;
  has_delivery_time?: boolean;
  trust_status?: string;
}

interface Message {
  role: 'user' | 'agent';
  agent?: string;
  content: string;
  candidates?: DiscoveredCandidate[];
  siteTrustData?: { site: string; status: string; reason: string; trustOverride?: boolean };
  trustWarningPrompt?: { site: string; reason: string };
  sitesRejectedCount?: number;
  riskData?: RiskFeaturesData;
  guardrailData?: { ceiling: number; price: number; passed: boolean; productName?: string; };
  paymentAttempts?: PaymentAttempt[];
}

const AGENT_LABELS: Record<string, string> = {
  concierge: 'Concierge',
  site_trust: 'Site Trust Agent',
  discovery: 'Discovery Agent',
  catalog: 'Discovery Agent',
  negotiation: 'Negotiation',
  risk: 'Risk Agent',
  payment: 'Payment',
  ledger: 'Audit Ledger',
};

const SUGGESTION_CHIPS = [
  { label: 'Autonomous Pitch Demo (§2.5)', query: 'Find me running shoes under Rs. 4000, size 9', mode: 'autonomous' as const, isPitch: true },
  { label: 'Guided Untrusted Site Warning (Demo)', query: 'Check amaz0n-deals.com for running shoes under Rs. 4000', mode: 'guided' as const, requestedSite: 'amaz0n-deals.com', isPitch: false },
  { label: 'Guided Trusted Site (nike.com)', query: 'Check nike.com for running shoes under Rs. 4000', mode: 'guided' as const, requestedSite: 'nike.com', isPitch: false },
  { label: 'Training tee under ₹2,000', query: 'Find me a synthetic training tee under Rs. 2000', mode: 'autonomous' as const, isPitch: false },
];

export default function CheckoutPage() {
  const { user } = useAuth();
  const [activeAgent, setActiveAgent] = useState('concierge');
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [autonomyMode, setAutonomyMode] = useState<'autonomous' | 'guided'>('autonomous');
  const [requestedSitesInput, setRequestedSitesInput] = useState('');
  const [forcePaymentFail, setForcePaymentFail] = useState(false);
  const [sessionId, setSessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 9)}`);
  const [isRunning, setIsRunning] = useState(false);

  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const [guardrailCeiling, setGuardrailCeiling] = useState<number | undefined>(undefined);
  const [chosenProduct, setChosenProduct] = useState<Record<string, any> | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskFeatures, setRiskFeatures] = useState<Record<string, any> | null>(null);
  const [trustOverrideActive, setTrustOverrideActive] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/api/transaction/ws/${sessionId}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'agent_event') {
        const currentAgentKey = data.agent === 'catalog' ? 'discovery' : data.agent;
        setActiveAgent(currentAgentKey);
        setCompletedAgents(prev => {
          const order = ['concierge','site_trust','discovery','negotiation','risk','payment','ledger'];
          const idx = order.indexOf(currentAgentKey);
          return order.slice(0, idx).filter(a => !prev.includes(a)).concat(prev);
        });
        setAuditLog(prev => [...prev, { event_id: data.event_id, timestamp: data.timestamp, agent: data.agent, decision_reason: data.decision_reason, inputs_summary: data.inputs_summary, output_summary: data.output_summary }]);

        let riskData: RiskFeaturesData | undefined;
        let guardrailData: Message['guardrailData'];
        let paymentAttempts: PaymentAttempt[] | undefined;
        let candidates: Message['candidates'];
        let siteTrustData: Message['siteTrustData'];
        let trustWarningPrompt: Message['trustWarningPrompt'];
        let sitesRejectedCount: number | undefined;

        if (data.output_summary?.trust_override) {
          setTrustOverrideActive(true);
        }

        if (data.agent === 'site_trust' && data.output_summary) {
          const s = data.output_summary;
          siteTrustData = { site: s.site || 'candidate site', status: s.status, reason: s.reason, trustOverride: s.user_overrode_trust_warning || s.trust_override };
        } else if ((data.agent === 'discovery' || data.agent === 'catalog') && data.output_summary) {
          if (data.output_summary.candidates || data.output_summary.discovered_candidates) {
            candidates = data.output_summary.discovered_candidates || data.output_summary.candidates;
          }
          if (data.output_summary.sites_rejected_count) {
            sitesRejectedCount = data.output_summary.sites_rejected_count;
          }
        } else if (data.agent === 'risk' && data.output_summary) {
          const s = data.output_summary;
          setRiskScore(s.risk_score);
          setRiskFeatures({ top_features: s.top_features, model: s.model_source, explanation: s.explanation });
          riskData = { risk_score: s.risk_score ?? 0.01, risk_level: s.risk_level, threshold: s.threshold ?? 0.8, top_features: s.top_features || [], explanation: s.explanation, model: s.model_source === 'rule_based_fallback' ? 'Rule-Based Risk Engine (Fallback)' : 'XGBoost+LightGBM Hybrid Ensemble' };
        } else if (data.agent === 'negotiation' && data.output_summary) {
          const s = data.output_summary;
          setGuardrailCeiling(s.ceiling);
          if (s.product_id) setChosenProduct({ product_id: s.product_id, price: s.price });
          guardrailData = { ceiling: s.ceiling || 5000, price: s.price || 0, passed: s.guardrail_passed !== false, productName: s.product_id };
        } else if (data.agent === 'payment' && data.output_summary?.payment_attempts) {
          paymentAttempts = data.output_summary.payment_attempts;
        }

        // Check if halted on a site trust warning in guided mode
        if (data.decision_reason && (data.decision_reason.includes('safety check') || data.decision_reason.includes('untrusted'))) {
          trustWarningPrompt = {
            site: data.output_summary?.site || data.inputs_summary?.requested_sites?.[0] || 'amaz0n-deals.com',
            reason: data.decision_reason,
          };
        }

        setMessages(prev => [...prev, { role: 'agent', agent: currentAgentKey, content: data.decision_reason, candidates, siteTrustData, trustWarningPrompt, sitesRejectedCount, riskData, guardrailData, paymentAttempts }]);
      } else if (data.type === 'transaction_complete') {
        setActiveAgent('ledger');
        setCompletedAgents(['concierge','site_trust','discovery','negotiation','risk','payment']);
        setPaymentStatus(data.state.payment_status);
        setEscalationMessage(data.state.escalation_message);
        setIsRunning(false);
        if (data.state.guardrail_ceiling) setGuardrailCeiling(data.state.guardrail_ceiling);
        if (data.state.chosen_product) setChosenProduct(data.state.chosen_product);
        if (data.state.risk_score !== undefined) setRiskScore(data.state.risk_score);
        if (data.state.risk_features) setRiskFeatures(data.state.risk_features);
        if (data.state.audit_log) setAuditLog(data.state.audit_log);
        if (data.state.trust_override) setTrustOverrideActive(true);

        let finalRiskData: RiskFeaturesData | undefined;
        if (data.state?.risk_features) {
          const rf = data.state.risk_features;
          finalRiskData = { risk_score: data.state.risk_score ?? 0, top_features: rf.top_features || [], explanation: rf.explanation, model: rf.model || 'XGBoost+LightGBM Hybrid Ensemble' };
        }

        const isTrustHalt = data.state.payment_status === 'escalated' && (data.state.escalation_message || '').includes('safety check');

        setMessages(prev => [...prev, {
          role: 'agent',
          agent: 'ledger',
          content: isTrustHalt
            ? `Transaction paused on Site Trust Warning — awaiting user action (Restart or Continue with trust_override).`
            : `Transaction complete: ${data.state.payment_status.toUpperCase()}${data.state.escalation_message ? ` — ${data.state.escalation_message}` : ''}`,
          trustWarningPrompt: isTrustHalt ? {
            site: data.state.site_trust_results?.[0]?.site || 'requested site',
            reason: data.state.escalation_message || 'Site failed safety check: Typosquatting / domain age flag',
          } : undefined,
          riskData: finalRiskData,
          paymentAttempts: data.state.payment_attempts,
        }]);
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [sessionId]);

  const handleSend = async (queryOverride?: string, forceMode?: 'autonomous' | 'guided', siteOverride?: string) => {
    const query = queryOverride || input;
    if (!query.trim() || isRunning) return;

    const modeToUse = forceMode || autonomyMode;
    const sitesToUse = siteOverride !== undefined ? (siteOverride ? [siteOverride] : null) : (requestedSitesInput.trim() ? [requestedSitesInput.trim()] : null);

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    if (!queryOverride) setInput('');
    setActiveAgent('concierge'); setCompletedAgents([]); setAuditLog([]);
    setPaymentStatus('pending'); setEscalationMessage(null); setIsRunning(true);

    try {
      await api.post('/transaction/run', {
        user_message: query,
        tenant_id: user?.tenant_id || 'demo_tenant',
        session_id: sessionId,
        force_payment_fail: forcePaymentFail,
        autonomy_mode: modeToUse,
        requested_sites: sitesToUse,
      });
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'agent', content: 'Transaction error. Please try again.' }]);
      setIsRunning(false);
    }
  };

  const handleChipClick = (chip: typeof SUGGESTION_CHIPS[0]) => {
    setAutonomyMode(chip.mode);
    if (chip.requestedSite) {
      setRequestedSitesInput(chip.requestedSite);
    } else {
      setRequestedSitesInput('');
    }
    handleSend(chip.query, chip.mode, chip.requestedSite);
  };

  const handleRestartSession = () => {
    const newSess = `sess_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSess);
    setMessages([]);
    setAuditLog([]);
    setPaymentStatus('pending');
    setEscalationMessage(null);
    setTrustOverrideActive(false);
    setRequestedSitesInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />
      <AgentRail activeAgent={activeAgent} onSelectAgent={setActiveAgent} completedAgents={completedAgents} />

      <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>

        {/* Conversation Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '10px', border: '1px solid rgba(1,73,174,0.12)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(3,38,118,0.04)', minHeight: '450px' }}>
          {/* Canvas Header */}
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(1,73,174,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#032676', fontFamily: "'Antonio', sans-serif" }}>Agentic Checkout Cockpit</span>
              {isRunning && <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '99px', background: 'rgba(1,73,174,0.1)', color: '#0149ae', animation: 'pulse-ring 1.4s ease-out infinite' }}>LIVE</span>}
              {trustOverrideActive && (
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.55rem', borderRadius: '99px', background: 'rgba(3,38,118,0.15)', color: '#032676', border: '1px solid rgba(3,38,118,0.3)' }}>
                  TRUST OVERRIDDEN
                </span>
              )}
            </div>

            {/* Autonomy Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'rgba(30,30,30,0.5)', fontWeight: 600 }}>Autonomy Mode:</span>
              <div style={{ display: 'flex', background: '#f5f5f5', padding: '2px', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)' }}>
                <button
                  type="button"
                  onClick={() => setAutonomyMode('autonomous')}
                  disabled={isRunning}
                  style={{
                    padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: autonomyMode === 'autonomous' ? '#0149ae' : 'transparent',
                    color: autonomyMode === 'autonomous' ? '#ffffff' : 'rgba(30,30,30,0.6)',
                    transition: 'all 0.2s',
                  }}
                >
                  Autonomous
                </button>
                <button
                  type="button"
                  onClick={() => setAutonomyMode('guided')}
                  disabled={isRunning}
                  style={{
                    padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: autonomyMode === 'guided' ? '#0149ae' : 'transparent',
                    color: autonomyMode === 'guided' ? '#ffffff' : 'rgba(30,30,30,0.6)',
                    transition: 'all 0.2s',
                  }}
                >
                  Guided Mode
                </button>
              </div>

              {/* Force Payment Fail Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'rgba(30,30,30,0.55)', cursor: 'pointer', userSelect: 'none' }} title="Force Razorpay gateway to fail for retry demo">
                <input
                  type="checkbox"
                  checked={forcePaymentFail}
                  onChange={e => setForcePaymentFail(e.target.checked)}
                  disabled={isRunning}
                />
                Simulate Fail
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.3rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRunning ? '#0149ae' : paymentStatus === 'success' ? '#1250b2' : paymentStatus === 'escalated' ? '#032676' : 'rgba(30,30,30,0.2)', ...(isRunning ? { animation: 'pulse-ring 1.4s ease-out infinite' } : {}) }} />
                <span style={{ fontSize: '0.72rem', color: 'rgba(30,30,30,0.4)', fontWeight: 600 }}>
                  {isRunning ? `${AGENT_LABELS[activeAgent] || activeAgent} running…` : paymentStatus === 'pending' ? 'Awaiting input' : paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Messages Canvas */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: '#0149ae', opacity: 0.18, fontFamily: "'Antonio', sans-serif", fontWeight: 700 }}>GB</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#032676' }}>GLASSBOX Agentic Commerce Cockpit</h3>
                <p style={{ fontSize: '0.875rem', maxWidth: '560px', margin: '0 auto 1.5rem auto', lineHeight: 1.6, color: 'rgba(30,30,30,0.6)' }}>
                  Autonomous buyer agent featuring <strong>Deterministic Site Trust Verification</strong> and <strong>Spend Guardrails</strong>. Ask to discover products across web sources, negotiate, evaluate ML risk, and execute payments.
                </p>

                {/* Preset Chips */}
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '750px' }}>
                  {SUGGESTION_CHIPS.map(chip => (
                    <button key={chip.query} onClick={() => handleChipClick(chip)} style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderRadius: '99px', border: chip.isPitch ? '1px solid #0149ae' : '1px solid rgba(1,73,174,0.2)', background: chip.isPitch ? 'rgba(1,73,174,0.07)' : '#f5f5f5', color: chip.isPitch ? '#0149ae' : 'rgba(30,30,30,0.7)', fontWeight: chip.isPitch ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Play size={12} color={chip.isPitch ? '#0149ae' : '#032676'} />
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  const label = msg.agent ? AGENT_LABELS[msg.agent] || msg.agent : '';
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '0.65rem', animation: 'slide-in-up 0.3s ease-out' }}>
                      {!isUser && (
                        <div style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(1,73,174,0.1)', border: '2px solid rgba(1,73,174,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#0149ae', marginTop: '0.15rem' }}>
                          {(msg.agent || 'A')[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth: '85%', minWidth: 0 }}>
                        {!isUser && label && <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#0149ae', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{label}</div>}
                        <div style={{ padding: '0.85rem 1.1rem', borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px', background: isUser ? 'linear-gradient(135deg, #0149ae 0%, #032676 100%)' : '#f5f5f5', color: isUser ? '#ffffff' : '#1e1e1e', border: isUser ? 'none' : '1px solid rgba(1,73,174,0.1)', borderLeft: isUser ? 'none' : '3px solid #0149ae', fontSize: '0.875rem', lineHeight: 1.55, boxShadow: isUser ? '0 2px 8px rgba(1,73,174,0.2)' : '0 1px 4px rgba(3,38,118,0.04)' }}>
                          <div style={{ fontWeight: 500 }}>{msg.content}</div>

                          {/* Site Trust Warning Alert Card (Guided Mode Halt) */}
                          {msg.trustWarningPrompt && (
                            <div style={{ marginTop: '0.85rem', padding: '1rem 1.15rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid rgba(3,38,118,0.25)', borderLeft: '4px solid #032676', color: '#032676', animation: 'slide-in-up 0.3s ease-out' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: '#032676', marginBottom: '0.4rem' }}>
                                <ShieldX size={18} color="#032676" />
                                Deterministic Site Trust Warning Triggered
                              </div>
                              <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.82rem', lineHeight: 1.5, color: '#1e1e1e' }}>
                                Target site <strong>{msg.trustWarningPrompt.site}</strong> failed deterministic security checks (HTTPS, SSL, domain age, typosquatting pattern).
                              </p>
                              <div style={{ fontSize: '0.75rem', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(3,38,118,0.15)', marginBottom: '0.85rem', fontFamily: 'monospace' }}>
                                {msg.trustWarningPrompt.reason}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'rgba(30,30,30,0.6)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Lock size={13} />
                                Audit Note: Choosing to continue will record <code style={{ background: 'rgba(3,38,118,0.1)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 700 }}>trust_override: true</code> in the immutable audit log.
                              </div>
                              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSend('continue')}
                                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: '#032676', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                >
                                  <CheckCircle size={14} /> Continue & Override Warning
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRestartSession}
                                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: '#ffffff', color: '#0149ae', border: '1px solid rgba(1,73,174,0.3)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  Restart Search
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Autonomous Skipped Banner */}
                          {msg.sitesRejectedCount !== undefined && msg.sitesRejectedCount > 0 && (
                            <div style={{ marginTop: '0.65rem', padding: '0.45rem 0.75rem', background: 'rgba(1,73,174,0.06)', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', fontSize: '0.78rem', color: '#0149ae', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Globe size={14} />
                              Transparency Note: {msg.sitesRejectedCount} candidate source site(s) skipped automatically for failing trust checks.
                            </div>
                          )}

                          {/* Discovered Product Candidates */}
                          {msg.candidates && msg.candidates.length > 0 && (
                            <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem' }}>
                              {msg.candidates.map((item, idx) => (
                                <div key={idx} style={{ background: '#ffffff', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(1,73,174,0.15)', boxShadow: '0 1px 4px rgba(3,38,118,0.04)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                    <span style={{ fontSize: '0.62rem', color: 'rgba(30,30,30,0.4)', fontWeight: 800, textTransform: 'uppercase' }}>Option {idx + 1}</span>
                                    {item.source_site && (
                                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: trustOverrideActive ? 'rgba(3,38,118,0.12)' : 'rgba(1,73,174,0.08)', color: trustOverrideActive ? '#032676' : '#0149ae' }}>
                                        {item.source_site}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e1e1e', marginBottom: '0.25rem' }}>{item.name}</div>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0149ae' }}>&#8377;{item.price.toLocaleString()}</div>
                                  {item.review_summary && (
                                    <div style={{ fontSize: '0.72rem', color: 'rgba(30,30,30,0.6)', marginTop: '0.3rem', lineHeight: 1.3 }}>
                                      {item.review_summary}
                                    </div>
                                  )}
                                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                    <span className={`pill ${item.has_return_policy !== false ? 'pill-success' : 'pill-danger'}`}>
                                      {item.has_return_policy !== false ? 'Returns' : 'No Returns'}
                                    </span>
                                    {item.has_delivery_time !== false && <span className="pill pill-blue">ETA</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Spend Guardrail Lock */}
                          {msg.guardrailData && (
                            <div className={`guardrail-lock ${msg.guardrailData.passed ? 'passed' : 'blocked'}`}>
                              <Lock size={16} style={{ flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Non-Negotiable Spend Guardrail</div>
                                <div style={{ fontSize: '0.78rem', marginTop: '0.2rem', opacity: 0.8 }}>Ceiling: &#8377;{msg.guardrailData.ceiling.toLocaleString()} · Item: &#8377;{msg.guardrailData.price.toLocaleString()}</div>
                              </div>
                              <span className={`pill ${msg.guardrailData.passed ? 'pill-success' : 'pill-danger'}`}>{msg.guardrailData.passed ? 'PASSED' : 'BLOCKED'}</span>
                            </div>
                          )}

                          {/* Payment Attempts */}
                          {msg.paymentAttempts && msg.paymentAttempts.length > 0 && (
                            <div style={{ marginTop: '0.85rem', padding: '1rem', background: 'rgba(3,38,118,0.05)', borderRadius: '8px', border: '1px solid rgba(3,38,118,0.15)', color: '#032676' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.6rem', fontSize: '0.82rem' }}>
                                <RefreshCw size={14} />
                                Razorpay Gateway — Fixed 1-Retry Policy
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                                {msg.paymentAttempts.map((att, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.45rem 0.7rem', borderRadius: '6px', border: '1px solid rgba(3,38,118,0.12)', fontSize: '0.78rem' }}>
                                    <span><strong>Attempt {att.attempt}</strong> ({att.attempt === 1 ? 'Initial' : 'Retry 1/1'}): {att.reason || att.status}</span>
                                    <span className="pill pill-danger">{att.status}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ffffff', padding: '0.45rem 0.7rem', borderRadius: '6px', borderLeft: '4px solid #032676', fontSize: '0.75rem', fontWeight: 600, color: '#032676' }}>
                                <ShieldAlert size={14} />
                                Policy enforced: No further charges attempted without user instruction.
                              </div>
                            </div>
                          )}

                          {msg.riskData && <RiskFeatureChart data={msg.riskData} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Guided Mode Site Input Bar (if Guided Mode Active) */}
          {autonomyMode === 'guided' && (
            <div style={{ padding: '0.5rem 1.1rem', background: 'rgba(1,73,174,0.04)', borderTop: '1px solid rgba(1,73,174,0.08)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Globe size={15} color="#0149ae" />
              <span style={{ fontSize: '0.78rem', color: '#0149ae', fontWeight: 700 }}>Target Site URL / Domain:</span>
              <input
                type="text"
                placeholder="e.g. nike.com or amaz0n-deals.com"
                value={requestedSitesInput}
                onChange={e => setRequestedSitesInput(e.target.value)}
                disabled={isRunning}
                style={{ flex: 1, padding: '0.35rem 0.75rem', border: '1px solid rgba(1,73,174,0.2)', borderRadius: '6px', fontSize: '0.82rem', outline: 'none', background: '#ffffff' }}
              />
            </div>
          )}

          {/* Input Bar */}
          <div style={{ padding: '0.85rem 1.1rem', borderTop: '1px solid rgba(1,73,174,0.08)', background: '#ffffff' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={autonomyMode === 'guided' ? "Enter search item (e.g. Find running shoes under ₹4,000)…" : "E.g. Find me running shoes under ₹4,000, size 9…"} disabled={isRunning}
                style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid rgba(1,73,174,0.15)', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', opacity: isRunning ? 0.6 : 1, background: '#ffffff', color: '#1e1e1e' }}
                onFocus={e => e.target.style.borderColor = '#0149ae'}
                onBlur={e => e.target.style.borderColor = 'rgba(1,73,174,0.15)'}
              />
              <button className="btn-primary" onClick={() => handleSend()} disabled={isRunning || !input.trim()}
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: (isRunning || !input.trim()) ? 0.5 : 1, cursor: (isRunning || !input.trim()) ? 'not-allowed' : 'pointer' }}>
                <Send size={15} /> Send
              </button>
            </div>

            {/* Quick Demo Chips */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', color: 'rgba(30,30,30,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Try:</span>
              {SUGGESTION_CHIPS.map(chip => (
                <button key={chip.query} onClick={() => handleChipClick(chip)} disabled={isRunning}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', borderRadius: '99px', border: chip.isPitch ? '1px solid #0149ae' : '1px solid rgba(1,73,174,0.15)', background: chip.isPitch ? 'rgba(1,73,174,0.07)' : '#f5f5f5', color: chip.isPitch ? '#0149ae' : 'rgba(30,30,30,0.6)', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: chip.isPitch ? 700 : 500, opacity: isRunning ? 0.5 : 1 }}>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Knowledge Graph below Canvas */}
        <KnowledgeGraph
          activeAgent={activeAgent}
          auditLog={auditLog}
          paymentStatus={paymentStatus}
          escalationMessage={escalationMessage}
          guardrailCeiling={guardrailCeiling}
          chosenProduct={chosenProduct}
          riskScore={riskScore}
          riskFeatures={riskFeatures}
        />
      </div>
    </div>
  );
}
