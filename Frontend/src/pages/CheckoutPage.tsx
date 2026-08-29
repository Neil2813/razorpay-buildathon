import { useState, useEffect, useRef } from 'react';
import { Lock, ShieldAlert, RefreshCw, Send, ShieldX, CheckCircle, Globe, Star, Tag, Filter, Play } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AuditEvent } from '../components/KnowledgeGraph';
import RiskFeatureChart, { RiskFeaturesData } from '../components/RiskFeatureChart';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void }; }
}

interface PaymentAttempt { attempt: number; timestamp: string; status: string; reason?: string; }

interface DiscoveredCandidate {
  product_id: string;
  name: string;
  price: number;
  brand?: string;
  rating?: number;
  source_site?: string;
  review_summary?: string;
  has_return_policy?: boolean;
  has_delivery_time?: boolean;
  trust_status?: string;
  image_url?: string;
  source_url?: string;
  match_reason?: string;
}

interface MissingParam {
  key: string;
  label: string;
  inputType: 'text' | 'number' | 'select';
  options?: string[];
  placeholder?: string;
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
  guardrailData?: {
    ceiling: number;
    price: number;
    passed: boolean;
    productName?: string;
    chosenProduct?: DiscoveredCandidate;
    selectionReason?: string;
    candidates?: DiscoveredCandidate[];
    dialogue?: Array<{ agent: string; name: string; avatar: string; text: string }>;
  };
  paymentAttempts?: PaymentAttempt[];
  missingParams?: MissingParam[];
  clarificationMode?: 'guided' | 'autonomous';
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

// Param definitions per mode for UI clarification cards
const GUIDED_PARAMS: MissingParam[] = [
  { key: 'budget_min', label: 'Floor Price (₹)', inputType: 'number', placeholder: 'e.g. 500' },
  { key: 'budget_max', label: 'Ceiling Price (₹)', inputType: 'number', placeholder: 'e.g. 4000' },
  { key: 'brand', label: 'Brand', inputType: 'text', placeholder: 'e.g. Nike, or type "any"' },
  { key: 'color', label: 'Colour', inputType: 'select', options: ['any', 'black', 'white', 'blue', 'red', 'green', 'brown', 'pink', 'yellow', 'grey', 'navy', 'beige', 'orange'] },
  { key: 'size', label: 'Size', inputType: 'select', options: ['any', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11'] },
  { key: 'min_rating', label: 'Minimum Rating (out of 5)', inputType: 'select', options: ['any', '3', '3.5', '4', '4.5'] },
];

const AUTONOMOUS_PARAMS: MissingParam[] = [
  { key: 'size', label: 'Size', inputType: 'select', options: ['any', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11'] },
  { key: 'color', label: 'Colour', inputType: 'select', options: ['any', 'black', 'white', 'blue', 'red', 'green', 'brown', 'pink', 'yellow', 'grey', 'navy', 'beige', 'orange'] },
  { key: 'budget_max', label: 'Max Budget / Ceiling (₹)', inputType: 'number', placeholder: 'e.g. 4000' },
  { key: 'budget_min', label: 'Min Budget / Floor (₹)', inputType: 'number', placeholder: 'e.g. 500' },
  { key: 'min_rating', label: 'Minimum Rating (out of 5)', inputType: 'select', options: ['any', '3', '3.5', '4', '4.5'] },
];

// ---------------------------------------------------------------------------
// Live Agent Progress Indicator Component (V3 - Root Binding)
// ---------------------------------------------------------------------------
function LiveAgentProgress() {
  return (
    <div style={{
      margin: '0.75rem 0',
      padding: '1rem 1.25rem',
      background: '#ffffff',
      borderRadius: '2px',
      border: '1px solid #e4e4e7',
      boxShadow: 'none',
      animation: 'slide-in-up 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <RefreshCw size={16} color="#0044ff" style={{ animation: 'spin 1.2s linear infinite' }} />
        <span className="brutalist-subtitle" style={{ color: '#0044ff' }}>
          Autonomous Pipeline Executing…
        </span>
      </div>
      <div className="brutalist-text" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: '#111111' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#0044ff' }}>
          <Globe size={13} /> Discovery Agent Triggered: Searching this merchant's catalogue…
        </div>
        <div style={{ fontSize: '0.72rem', color: '#71717a', paddingLeft: '1.2rem', lineHeight: 1.4 }}>
          Evaluating merchant SKUs against budget guardrails, availability, and the risk model…
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clarification Card Component (Clean State)
// ---------------------------------------------------------------------------
function ClarificationCard({
  missing,
  mode,
  onSubmit,
  disabled,
}: {
  missing: MissingParam[];
  mode: 'guided' | 'autonomous';
  onSubmit: (values: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const finalValues = { ...values };
    for (const p of missing) {
      if (!finalValues[p.key]) {
        if (p.inputType === 'select' && p.options?.includes('any')) {
          finalValues[p.key] = 'any';
        }
      }
    }
    onSubmit(finalValues);
  };

  const modeColor = mode === 'guided' ? '#0044ff' : '#7c3aed';
  const modeLabel = mode === 'guided' ? 'Guided Mode' : 'Autonomous Mode';

  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '1.1rem 1.25rem',
      background: '#ffffff',
      borderRadius: '2px',
      border: `1px solid #e4e4e7`,
      borderLeft: `4px solid ${modeColor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Filter size={15} color={modeColor} />
        <span className="brutalist-subtitle" style={{ color: modeColor }}>
          {modeLabel} — Provide Details to Search
        </span>
      </div>
      <p className="brutalist-text" style={{ fontSize: '0.8rem', color: '#71717a', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        I need a few more details before I start searching for your perfect product:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.85rem' }}>
        {missing.map((param) => (
          <div key={param.key}>
            <label className="brutalist-subtitle" style={{ color: modeColor, display: 'block', marginBottom: '0.3rem', fontSize: '0.7rem' }}>
              {param.label}
            </label>
            {param.inputType === 'select' && param.options ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {param.options.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setValues((v: Record<string, string>) => ({ ...v, [param.key]: opt }))}
                    disabled={disabled}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '2px',
                      border: `1px solid ${values[param.key] === opt ? modeColor : '#e4e4e7'}`,
                      background: values[param.key] === opt ? modeColor : '#ffffff',
                      color: values[param.key] === opt ? '#ffffff' : '#71717a',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type={param.inputType}
                placeholder={param.placeholder}
                value={values[param.key] || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((v: Record<string, string>) => ({ ...v, [param.key]: e.target.value }))}
                disabled={disabled}
                className="minimal-input"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.83rem' }}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className="minimal-btn minimal-btn-primary"
        style={{ padding: '0.55rem 1.25rem', fontSize: '0.8rem', borderRadius: '2px' }}
      >
        <Send size={13} /> Search Now
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode Selection Card Component
// ---------------------------------------------------------------------------
function ModeSelectionCard({
  onSelectMode,
  disabled,
}: {
  onSelectMode: (mode: 'autonomous' | 'guided') => void;
  disabled: boolean;
}) {
  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '1.1rem 1.25rem',
      background: '#ffffff',
      borderRadius: '2px',
      border: '1px solid #e4e4e7',
      borderLeft: '4px solid #0044ff',
    }}>
      <div className="brutalist-subtitle" style={{ color: '#111111', marginBottom: '0.4rem' }}>
        Select Execution Mode
      </div>
      <p className="brutalist-text" style={{ fontSize: '0.8rem', color: '#71717a', marginBottom: '0.85rem', lineHeight: 1.45 }}>
        How would you like the agent to execute your request?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectMode('autonomous')}
          style={{
            padding: '0.9rem',
            borderRadius: '2px',
            border: '1px solid #e4e4e7',
            background: '#ffffff',
            textAlign: 'left',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e4e4e7'}
        >
          <div className="brutalist-subtitle" style={{ color: '#7c3aed', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Play size={14} /> Autonomous Mode
          </div>
          <div className="brutalist-text" style={{ fontSize: '0.74rem', color: '#71717a', lineHeight: 1.4 }}>
            Let AI discover & buy automatically across vetted stores. Requires Size, Colour, Floor & Ceiling budget.
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectMode('guided')}
          style={{
            padding: '0.9rem',
            borderRadius: '2px',
            border: '1px solid #e4e4e7',
            background: '#ffffff',
            textAlign: 'left',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#0044ff'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e4e4e7'}
        >
          <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Globe size={14} /> Guided Mode
          </div>
          <div className="brutalist-text" style={{ fontSize: '0.74rem', color: '#71717a', lineHeight: 1.4 }}>
            You specify the exact store URL, brand, rating cap, size, colour, floor & ceiling budget before searching.
          </div>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star Rating Display
// ---------------------------------------------------------------------------
function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={10}
          fill={i < Math.round(rating) ? '#f59e0b' : 'transparent'}
          color={i < Math.round(rating) ? '#f59e0b' : 'rgba(0,0,0,0.2)'}
        />
      ))}
      <span style={{ fontSize: '0.7rem', color: 'rgba(30,30,30,0.6)', marginLeft: '0.2rem', fontWeight: 600 }}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CheckoutPage() {
  const { user } = useAuth();
  const [_activeAgent, setActiveAgent] = useState('concierge');
  const [_completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [autonomyMode, setAutonomyMode] = useState<'autonomous' | 'guided'>('autonomous');
  const [requestedSitesInput, setRequestedSitesInput] = useState('');
  const [sessionId, setSessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 9)}`);
  const [isRunning, setIsRunning] = useState(false);

  const [_auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [_paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [_escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const [_guardrailCeiling, setGuardrailCeiling] = useState<number | undefined>(undefined);
  const [_chosenProduct, setChosenProduct] = useState<Record<string, any> | null>(null);
  const [_riskScore, setRiskScore] = useState<number | null>(null);
  const [_riskFeatures, setRiskFeatures] = useState<Record<string, any> | null>(null);
  const [trustOverrideActive, setTrustOverrideActive] = useState<boolean>(false);
  const [awaitingClarification, setAwaitingClarification] = useState<boolean>(false);

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
        setCompletedAgents((prev: string[]) => {
          const order = ['concierge', 'site_trust', 'discovery', 'negotiation', 'risk', 'payment', 'ledger'];
          const idx = order.indexOf(currentAgentKey);
          return order.slice(0, idx).filter(a => !prev.includes(a)).concat(prev);
        });
        setAuditLog((prev: AuditEvent[]) => [...prev, {
          event_id: data.event_id,
          timestamp: data.timestamp,
          agent: data.agent,
          decision_reason: data.decision_reason,
          inputs_summary: data.inputs_summary,
          output_summary: data.output_summary,
        }]);

        let riskData: RiskFeaturesData | undefined;
        let guardrailData: Message['guardrailData'];
        let paymentAttempts: PaymentAttempt[] | undefined;
        let candidates: Message['candidates'];
        let siteTrustData: Message['siteTrustData'];
        let trustWarningPrompt: Message['trustWarningPrompt'];
        let sitesRejectedCount: number | undefined;
        let missingParams: MissingParam[] | undefined;

        if (data.output_summary?.trust_override) {
          setTrustOverrideActive(true);
        }

        // Check for missing parameters (clarification required)
        if (data.agent === 'concierge' && data.output_summary?.missing_parameters?.length > 0) {
          const missing: string[] = data.output_summary.missing_parameters;
          if (missing.includes('autonomy_mode')) {
            missingParams = [{ key: 'autonomy_mode', label: 'Execution Mode', inputType: 'select' }];
          } else {
            const mode = data.inputs_summary?.mode || autonomyMode || 'autonomous';
            const allParams = mode === 'guided' ? GUIDED_PARAMS : AUTONOMOUS_PARAMS;
            missingParams = allParams.filter(p => missing.includes(p.key));
          }
          setAwaitingClarification(true);
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
          if (candidates?.length) setAwaitingClarification(false);
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

        if (data.decision_reason && (data.decision_reason.includes('safety check') || data.decision_reason.includes('untrusted'))) {
          trustWarningPrompt = {
            site: data.output_summary?.site || data.inputs_summary?.requested_sites?.[0] || 'amaz0n-deals.com',
            reason: data.decision_reason,
          };
        }

        setMessages((prev: Message[]) => [...prev, {
          role: 'agent',
          agent: currentAgentKey,
          content: data.decision_reason,
          candidates,
          siteTrustData,
          trustWarningPrompt,
          sitesRejectedCount,
          riskData,
          guardrailData,
          paymentAttempts,
          missingParams,
          clarificationMode: data.inputs_summary?.mode || autonomyMode,
        }]);
      } else if (data.type === 'transaction_complete') {
        setActiveAgent('ledger');
        setCompletedAgents(['concierge', 'site_trust', 'discovery', 'negotiation', 'risk', 'payment']);
        setPaymentStatus(data.state.payment_status);
        setEscalationMessage(data.state.escalation_message);
        setIsRunning(false);
        if (data.state.guardrail_ceiling) setGuardrailCeiling(data.state.guardrail_ceiling);
        if (data.state.chosen_product) setChosenProduct(data.state.chosen_product);
        if (data.state.risk_score !== undefined) setRiskScore(data.state.risk_score);
        if (data.state.risk_features) setRiskFeatures(data.state.risk_features);
        if (data.state.audit_log) setAuditLog(data.state.audit_log);
        if (data.state.trust_override) setTrustOverrideActive(true);

        // If escalated on clarification, keep awaitingClarification and skip generic ledger complete banner
        const isParamHalt = data.state.payment_status === 'escalated' &&
          (data.state.intent?.needs_clarification ||
           (data.state.escalation_message || '').includes('detail') ||
           (data.state.escalation_message || '').includes('search') ||
           (data.state.escalation_message || '').includes('mode'));

        if (isParamHalt) {
          setAwaitingClarification(true);
          return;
        }

        setAwaitingClarification(false);

        let finalRiskData: RiskFeaturesData | undefined;
        if (data.state?.risk_features) {
          const rf = data.state.risk_features;
          finalRiskData = { risk_score: data.state.risk_score ?? 0, top_features: rf.top_features || [], explanation: rf.explanation, model: rf.model || 'XGBoost+LightGBM Hybrid Ensemble' };
        }

        const isTrustHalt = data.state.payment_status === 'escalated' && (data.state.escalation_message || '').includes('safety check');

        setMessages((prev: Message[]) => [...prev, {
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

  const handleSend = async (queryOverride?: string, forceMode?: 'autonomous' | 'guided' | null, siteOverride?: string, buyerApproved = false) => {
    const query = queryOverride || input;
    if (!query.trim() || isRunning) return;

    const modeToUse = forceMode !== undefined ? forceMode : (autonomyMode ?? 'autonomous');
    const sitesToUse = siteOverride !== undefined
      ? (siteOverride ? [siteOverride] : null)
      : (requestedSitesInput.trim() ? [requestedSitesInput.trim()] : null);

    // Append user message. On clarification turns (queryOverride set), keep prior agent messages.
    // On fresh top-level sends, keep only prior user messages (wipe stale agent cards).
    if (queryOverride) {
      // Clarification / mode continuation: append user reply, don't reset history
      setMessages((prev: Message[]) => [...prev, { role: 'user', content: query }]);
    } else {
      // Fresh query: clear everything and start new
      setMessages([{ role: 'user', content: query }]);
      setInput('');
    }

    setActiveAgent('concierge');
    setPaymentStatus('pending'); setEscalationMessage(null); setIsRunning(true);
    setAwaitingClarification(false);

    try {
      const res = await api.post('/transaction/run', {
        user_message: query,
        tenant_id: user?.tenant_id || 'demo_tenant',
        session_id: sessionId,
        force_payment_fail: false,
        autonomy_mode: modeToUse,
        requested_sites: sitesToUse,
        buyer_approved: buyerApproved,
      });

      const data = res;
      if (data && data.audit_log && data.audit_log.length > 0) {
        setPaymentStatus(data.payment_status || 'pending');
        if (data.escalation_message) setEscalationMessage(data.escalation_message);
        if (data.guardrail_ceiling) setGuardrailCeiling(data.guardrail_ceiling);
        if (data.chosen_product) setChosenProduct(data.chosen_product);
        if (data.risk_score !== undefined) setRiskScore(data.risk_score);
        if (data.risk_features) setRiskFeatures(data.risk_features);
        if (data.audit_log) setAuditLog(data.audit_log);
        if (data.trust_override) setTrustOverrideActive(true);

        if (data.razorpay_order_id && data.razorpay_key_id && buyerApproved) {
          if (data.razorpay_key_id === 'rzp_test_mock_key') {
            setMessages((prev: Message[]) => [...prev, { role: 'agent', agent: 'payment', content: 'Razorpay test credentials are not configured. Add a real rzp_test key and secret to open test Checkout.' }]);
          } else {
            const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
            if (!existing) {
              await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load Razorpay Checkout.'));
                document.body.appendChild(script);
              });
            }
            const checkout = new window.Razorpay!({
              key: data.razorpay_key_id, amount: Math.round(Number(data.chosen_product.price) * 100), currency: 'INR',
              name: 'GLASSBOX Merchant', description: data.chosen_product.name, order_id: data.razorpay_order_id,
              prefill: { email: user?.email },
              handler: async (payment: any) => {
                const verified = await api.post('/transaction/verify-payment', { session_id: data.session_id, ...payment });
                setPaymentStatus(verified.payment_status);
                setMessages((prev: Message[]) => [...prev, { role: 'agent', agent: 'payment', content: 'Payment verified server-side. The merchant order is ready for fulfilment.' }]);
              },
              modal: { ondismiss: () => setMessages((prev: Message[]) => [...prev, { role: 'agent', agent: 'payment', content: 'Checkout closed. No payment was recorded.' }]) },
            });
            checkout.open();
          }
        }

        // Aggregate turn result message from response data
        const auditLog: any[] = data.audit_log || [];
        const lastConciergeIdx = auditLog.map(e => e.agent).lastIndexOf('concierge');
        const currentTurnEvents = lastConciergeIdx !== -1 ? auditLog.slice(lastConciergeIdx) : auditLog;

        const newTurnMessages: Message[] = [];

        // Check if concierge is asking for missing parameters
        const conciergeEvent = currentTurnEvents.find(e => e.agent === 'concierge' && e.output_summary?.missing_parameters?.length > 0);
        let missingParams: MissingParam[] | undefined;

        if (conciergeEvent) {
          const missing: string[] = conciergeEvent.output_summary.missing_parameters;
          if (missing.includes('autonomy_mode') && modeToUse) {
            setAwaitingClarification(false);
          } else if (missing.includes('autonomy_mode')) {
            missingParams = [{ key: 'autonomy_mode', label: 'Execution Mode', inputType: 'select' }];
            setAwaitingClarification(true);
          } else {
            const mode = conciergeEvent.inputs_summary?.mode || modeToUse || 'autonomous';
            const allParams = mode === 'guided' ? GUIDED_PARAMS : AUTONOMOUS_PARAMS;
            missingParams = allParams.filter(p => missing.includes(p.key));
            setAwaitingClarification(true);
          }

          newTurnMessages.push({
            role: 'agent',
            agent: 'concierge',
            content: conciergeEvent.output_summary?.clarification || conciergeEvent.decision_reason || 'Please provide required parameters.',
            missingParams,
            clarificationMode: conciergeEvent.inputs_summary?.mode || modeToUse || undefined,
          });
        } else {
          setAwaitingClarification(false);
          // Parameter check passed — full pipeline executed. Push synthesized turn results.

          // 1. Discovery Products Message (if candidates found)
          const discovered = (data.discovered_candidates && data.discovered_candidates.length > 0)
            ? data.discovered_candidates
            : (data.catalog_candidates && data.catalog_candidates.length > 0 ? data.catalog_candidates : undefined);

          const discoveryEvent = currentTurnEvents.find(e => e.agent === 'discovery' || e.agent === 'catalog');
          const discoveryNote = discoveryEvent?.decision_reason ||
            (discovered?.length ? `Autonomous discovery complete: found ${discovered.length} candidate product(s).` : 'Autonomous discovery complete.');

          if (discovered?.length || discoveryEvent) {
            newTurnMessages.push({
              role: 'agent',
              agent: 'discovery',
              content: discoveryNote,
              candidates: discovered,
              sitesRejectedCount: data.sites_rejected_count,
            });
          }

          // 2. Negotiation / Selection & Guardrail Message
          if (data.chosen_product || data.guardrail_ceiling) {
            const chosen = data.chosen_product;
            const negEvent = currentTurnEvents.find(e => e.agent === 'negotiation');
            const selectionReason = chosen?.selection_reason ||
              negEvent?.output_summary?.selection_reason ||
              'Best match for your specified requirements.';

            const conciergeEvt = data.audit_log?.find((e: any) => e.agent === 'concierge' && e.output_summary?.intent);
            const intent = conciergeEvt?.output_summary?.intent || {};
            const candidatesList = data.discovered_candidates?.length > 0
              ? data.discovered_candidates
              : (data.catalog_candidates || []);

            // Generate dialogue bubbles representing negotiation
            const dialogue = [];
            const cat = intent.category || 'item';
            
            dialogue.push({
              agent: 'concierge',
              name: 'Concierge Agent',
              avatar: 'C',
              text: `Verified user intent: looking for ${intent.color || 'any'} ${cat}, size ${intent.size || 'any'}, price range ₹${intent.budget_min || 0} - ₹${intent.budget_max || 5000}, min rating ${intent.min_rating || 'any'} stars. Routing to Discovery...`
            });

            dialogue.push({
              agent: 'discovery',
              name: 'Discovery Agent',
              avatar: 'D',
              text: `Scanned pre-approved sites. Discovered ${candidatesList.length} matching candidates meeting safety and trust guidelines.`
            });

            if (chosen) {
              dialogue.push({
                agent: 'decision',
                name: 'Decision Agent',
                avatar: 'A',
                text: `Evaluating candidates. Selected "${chosen.name}" (₹${chosen.price}) as the optimal choice. Reason: ${selectionReason}`
              });

              const passed = Number(chosen.price) <= (data.guardrail_ceiling || 5000);
              dialogue.push({
                agent: 'guardrail',
                name: 'Deterministic Guardrail',
                avatar: 'G',
                text: `Running spend ceiling guardrail check. Item price ₹${chosen.price} ${passed ? '<=' : '>'} Ceiling Limit ₹${data.guardrail_ceiling || 5000}. Status: ${passed ? 'PASSED' : 'BLOCKED'}.`
              });
            }

            newTurnMessages.push({
              role: 'agent',
              agent: 'negotiation',
              content: negEvent?.decision_reason || 'Code compared selected product price against tenant ceiling.',
              guardrailData: {
                ceiling: data.guardrail_ceiling || 5000,
                price: chosen?.price || 0,
                passed: data.guardrail_passed !== false,
                productName: chosen?.product_id || chosen?.name,
                chosenProduct: chosen,
                selectionReason,
                candidates: candidatesList,
                dialogue: dialogue,
              },
            });
          }

          // 3. Risk Assessment Message
          if (data.risk_score !== undefined || data.risk_features) {
            const rf = data.risk_features || {};
            const riskEvent = currentTurnEvents.find(e => e.agent === 'risk');
            newTurnMessages.push({
              role: 'agent',
              agent: 'risk',
              content: riskEvent?.decision_reason || 'ML Risk Engine evaluated transaction features.',
              riskData: {
                risk_score: data.risk_score ?? 0.01,
                risk_level: data.risk_score ? (data.risk_score > (rf.threshold ?? 0.8) ? 'HIGH' : 'LOW') : 'LOW',
                threshold: rf.threshold ?? 0.8,
                top_features: rf.top_features || [],
                explanation: rf.explanation,
                model: rf.model === 'rule_based_fallback' ? 'Rule-Based Risk Engine (Fallback)' : 'XGBoost+LightGBM Hybrid Ensemble',
              },
            });
          }

          // 4. Payment Execution & Gateway Attempts Message
          if (data.payment_attempts && data.payment_attempts.length > 0) {
            const payEvent = currentTurnEvents.find(e => e.agent === 'payment');
            newTurnMessages.push({
              role: 'agent',
              agent: 'payment',
              content: payEvent?.decision_reason || 'Razorpay Gateway charge processing complete.',
              paymentAttempts: data.payment_attempts,
            });
          }

          // 5. Audit Ledger Finalization Message
          const isTrustHalt = data.payment_status === 'escalated' && (data.escalation_message || '').includes('safety check');
          const trustEvent = currentTurnEvents.find(e => e.agent === 'site_trust' || (e.decision_reason || '').includes('safety check'));

          newTurnMessages.push({
            role: 'agent',
            agent: 'ledger',
            content: isTrustHalt
              ? `Transaction paused on Site Trust Warning — awaiting user action (Restart or Continue with trust_override).`
              : `Transaction complete: ${data.payment_status.toUpperCase()}${data.escalation_message ? ` — ${data.escalation_message}` : ''}`,
            trustWarningPrompt: isTrustHalt ? {
              site: trustEvent?.output_summary?.site || data.requested_sites?.[0] || 'requested site',
              reason: data.escalation_message || 'Site failed safety check: Typosquatting / domain age flag',
            } : undefined,
          });
        }

        // Preserve streamed agent updates from this and earlier turns.  The REST
        // response adds the durable turn summary; it must not erase WebSocket
        // progress messages that may have arrived while scraping was running.
        setMessages((prev: Message[]) => {
          return [...prev, ...newTurnMessages];
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev: Message[]) => [...prev, { role: 'agent', content: 'Transaction error. Please try again.' }]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleClarificationSubmit = async (values: Record<string, string>) => {
    // Build a natural language continuation message from the filled fields
    const parts: string[] = [];
    if (values.size && values.size !== 'any') parts.push(`size ${values.size}`);
    if (values.color && values.color !== 'any') parts.push(`${values.color} colour`);
    if (values.brand && values.brand.toLowerCase() !== 'any') parts.push(`brand ${values.brand}`);
    if (values.budget_min) parts.push(`minimum budget ₹${values.budget_min}`);
    if (values.budget_max) parts.push(`maximum budget ₹${values.budget_max}`);
    if (values.min_rating && values.min_rating !== 'any') parts.push(`minimum rating ${values.min_rating} stars`);

    const clarificationMsg = parts.length > 0
      ? `I want: ${parts.join(', ')}.`
      : Object.entries(values).map(([k, v]) => `${k}: ${v}`).join(', ');

    await handleSend(clarificationMsg, autonomyMode);
  };

  const handleRestartSession = () => {
    const newSess = `sess_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSess);
    setMessages([]);
    setAuditLog([]);
    setPaymentStatus('pending');
    setEscalationMessage(null);
    setTrustOverrideActive(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: 'calc(100vh - 60px)', background: '#ffffff' }}>
        
        {/* Left Side: Session Control Console */}
        <div style={{ 
          background: '#faf9f6', 
          borderRight: '1px solid #111111', 
          padding: '1.75rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.75rem', 
          overflowY: 'auto'
        }}>


          {/* Section 2: Autonomy Level */}
          <div>
            <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.6rem', fontSize: '0.68rem' }}>
              [02 // BUYER CONTROL]
            </div>
            
            <div style={{ display: 'flex', background: '#ffffff', padding: '3px', borderRadius: '2px', border: '1px solid #e4e4e7' }}>
              <button
                type="button"
                onClick={() => {
                  if (autonomyMode !== 'autonomous') {
                    setAutonomyMode('autonomous');
                    setSessionId(`sess_${Math.random().toString(36).substring(2, 9)}`);
                    setMessages([]);
                  }
                }}
                disabled={isRunning}
                style={{
                  flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '2px', border: 'none', cursor: 'pointer',
                  background: autonomyMode === 'autonomous' ? '#0044ff' : 'transparent',
                  color: autonomyMode === 'autonomous' ? '#ffffff' : '#71717a',
                  transition: 'all 0.15s',
                  fontFamily: 'Space Grotesk'
                }}
              >
                Agent Recommend
              </button>
              <button
                type="button"
                onClick={() => {
                  if (autonomyMode !== 'guided') {
                    setAutonomyMode('guided');
                    setSessionId(`sess_${Math.random().toString(36).substring(2, 9)}`);
                    setMessages([]);
                  }
                }}
                disabled={isRunning}
                style={{
                  flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '2px', border: 'none', cursor: 'pointer',
                  background: autonomyMode === 'guided' ? '#0044ff' : 'transparent',
                  color: autonomyMode === 'guided' ? '#ffffff' : '#71717a',
                  transition: 'all 0.15s',
                  fontFamily: 'Space Grotesk'
                }}
              >
                Buyer Guided
              </button>
            </div>
          </div>

          {chosenProduct && paymentStatus === 'pending' && !isRunning && (
            <div>
              <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.6rem', fontSize: '0.68rem' }}>
                [03 // PAYMENT APPROVAL]
              </div>
              <div style={{ padding: '0.9rem', background: '#ffffff', border: '1px solid #e4e4e7', borderLeft: '4px solid #0044ff' }}>
                <p className="brutalist-text" style={{ fontSize: '0.78rem', margin: '0 0 0.7rem', lineHeight: 1.45 }}>
                  Approve exactly <strong>{chosenProduct.name}</strong> for <strong>₹{Number(chosenProduct.price).toLocaleString('en-IN')}</strong>. The agent cannot alter this amount.
                </p>
                <button type="button" onClick={() => handleSend('I approve this exact merchant order and amount.', autonomyMode, undefined, true)} className="minimal-btn minimal-btn-primary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.55rem' }}>
                  <Lock size={13} /> Approve & Open Test Checkout
                </button>
              </div>
            </div>
          )}

          {/* Section 4: Live Exec Agents */}
          <div>
            <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.6rem', fontSize: '0.68rem' }}>
                [04 // REAL-TIME EXECUTION AGENTS]
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#e4e4e7', border: '1px solid #e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
              {[
                { id: 'concierge', name: 'Concierge Agent' },
                { id: 'site_trust', name: 'Site Trust Agent' },
                { id: 'discovery', name: 'Discovery Agent' },
                { id: 'negotiation', name: 'Decision Agent' },
                { id: 'risk', name: 'Risk Evaluator' },
                { id: 'payment', name: 'Payment Agent' }
              ].map((ag, index) => {
                const status = _activeAgent === ag.id ? 'active' : _completedAgents.includes(ag.id) ? 'success' : 'pending';
                return (
                  <div key={ag.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '0.65rem 0.85rem', 
                    background: '#ffffff',
                    fontSize: '0.78rem'
                  }}>
                    <span className="brutalist-text" style={{ fontWeight: status === 'active' ? 700 : 500, color: status === 'active' ? '#111111' : '#71717a' }}>
                      {index + 1}. {ag.name}
                    </span>
                    {status === 'active' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0044ff', fontSize: '0.65rem', fontWeight: 700 }}>
                        <span className="minimal-indicator-live" /> LIVE
                      </span>
                    ) : status === 'success' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontSize: '0.65rem', fontWeight: 700 }}>
                        <span className="minimal-indicator-success" /> OK
                      </span>
                    ) : (
                      <span style={{ color: '#d4d4d8', fontSize: '0.65rem', fontWeight: 700 }}>IDLE</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Live Controls Context / Clarification / Trust Overrides */}
          {(awaitingClarification || trustOverrideActive) && (
            <div>
              <div className="brutalist-subtitle" style={{ color: '#ef4444', marginBottom: '0.6rem', fontSize: '0.68rem' }}>
                [05 // ATTENTION REQUIRED]
              </div>
              {/* Trust Override warnings */}
              {trustOverrideActive && (
                <div style={{ padding: '0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '2px', marginBottom: '0.75rem' }}>
                  <p className="brutalist-text" style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                    WARNING: The destination merchant domain requires dynamic credentials verification. Proceed with bypass?
                  </p>
                  <button 
                    className="minimal-btn minimal-btn-danger" 
                    style={{ width: '100%', fontSize: '0.72rem', padding: '0.4rem' }}
                    onClick={() => {
                      if (wsRef.current) wsRef.current.send(JSON.stringify({ type: 'override_trust' }));
                      setTrustOverrideActive(false);
                    }}
                  >
                    Bypass & Verify Site
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Side: Conversation Transcript Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Header */}
          <div style={{ padding: '0.85rem 1.75rem', borderBottom: '1px solid #111111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="brutalist-title" style={{ fontSize: '1.15rem' }}>TRANSACTION TIMELINE LEDGER</span>
              {isRunning && <span className="minimal-pill minimal-pill-primary">SYS_PROCESSING</span>}
            </div>
            <div className="brutalist-mono" style={{ fontSize: '0.75rem', color: '#71717a' }}>
              Mode: <strong style={{ color: '#111111', textTransform: 'uppercase' }}>{autonomyMode}</strong>
            </div>
          </div>

          {/* Transcript Log Stream */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#ffffff' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="brutalist-title" style={{ fontSize: '3.5rem', marginBottom: '0.25rem', color: '#0044ff' }}>GLASSBOX</div>
                <h3 className="brutalist-subtitle" style={{ fontSize: '0.85rem', margin: '0 0 1rem 0' }}>// TRANSACTION LEDGER CONSOLE</h3>
                <p className="brutalist-text" style={{ fontSize: '0.88rem', maxWidth: '520px', margin: '0 auto 2rem auto', lineHeight: 1.6, color: '#71717a' }}>
                  An AI-buyer checkout for this merchant's catalogue. The agent recommends a transactable SKU, then waits for your approval before Razorpay Test Checkout opens.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Buy me a shirt of ₹4000', 'Find running shoes under ₹3000', 'Get me a blue formal shirt'].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="minimal-btn minimal-btn-ghost"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.74rem' }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const label = msg.agent ? AGENT_LABELS[msg.agent] || msg.agent : '';
                  
                  return (
                    <div key={index} style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ maxWidth: '88%', minWidth: 0 }}>
                        {!isUser && label && <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.3rem', fontSize: '0.68rem' }}>{label}</div>}
                        <div style={{
                          padding: '0.85rem 1.1rem',
                          borderRadius: '2px',
                          background: isUser ? '#0044ff' : '#f4f4f5',
                          color: isUser ? '#ffffff' : '#111111',
                          border: isUser ? 'none' : '1px solid #e4e4e7',
                          borderLeft: isUser ? 'none' : '3px solid #0044ff',
                          fontSize: '0.875rem',
                          lineHeight: 1.55,
                          boxShadow: 'none'
                        }}>
                          <div className="brutalist-text" style={{ fontWeight: 500 }}>{msg.content}</div>

                          {/* ---- Clarification / Mode Selection Card ---- */}
                          {msg.missingParams && msg.missingParams.length > 0 && (
                            msg.missingParams.some((p: MissingParam) => p.key === 'autonomy_mode') ? (
                              <ModeSelectionCard
                                onSelectMode={(selectedMode) => {
                                  setAutonomyMode(selectedMode);
                                  handleSend(`I want to run in ${selectedMode} mode.`, selectedMode);
                                }}
                                disabled={isRunning}
                              />
                            ) : (
                              <ClarificationCard
                                missing={msg.missingParams}
                                mode={msg.clarificationMode || autonomyMode || 'autonomous'}
                                onSubmit={handleClarificationSubmit}
                                disabled={isRunning}
                              />
                            )
                          )}

                          {/* ---- Site Trust Warning ---- */}
                          {msg.trustWarningPrompt && (
                            <div style={{ marginTop: '0.85rem', padding: '1rem 1.15rem', background: '#fee2e2', borderRadius: '2px', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', color: '#991b1b', animation: 'slide-in-up 0.3s ease-out' }}>
                              <div className="brutalist-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', marginBottom: '0.4rem' }}>
                                <ShieldX size={18} color="#ef4444" />
                                Deterministic Site Trust Warning
                              </div>
                              <p className="brutalist-text" style={{ margin: '0 0 0.6rem 0', fontSize: '0.82rem', lineHeight: 1.5, color: '#111111' }}>
                                Target site <strong>{msg.trustWarningPrompt.site}</strong> failed deterministic safety checks (HTTPS, SSL, domain age, typosquatting pattern).
                              </p>
                              <div className="brutalist-mono" style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '2px', border: '1px solid #e4e4e7', marginBottom: '0.85rem', color: '#111111' }}>
                                {msg.trustWarningPrompt.reason}
                              </div>
                              <div className="brutalist-text" style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Lock size={13} />
                                Audit Note: Continuing will log trust_override in the immutable ledger.
                              </div>
                              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSend('continue')}
                                  className="minimal-btn minimal-btn-danger"
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '2px' }}
                                >
                                  <CheckCircle size={14} /> Continue & Override
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRestartSession}
                                  className="minimal-btn minimal-btn-ghost"
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '2px', background: '#ffffff' }}
                                >
                                  Restart Search
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ---- Autonomous Skipped Banner ---- */}
                          {msg.sitesRejectedCount !== undefined && msg.sitesRejectedCount > 0 && (
                            <div className="brutalist-text" style={{ marginTop: '0.65rem', padding: '0.45rem 0.75rem', background: '#f4f4f5', borderRadius: '2px', border: '1px solid #e4e4e7', borderLeft: '3px solid #0044ff', fontSize: '0.78rem', color: '#0044ff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Globe size={14} />
                              Transparency Note: {msg.sitesRejectedCount} candidate site(s) skipped for failing trust check.
                            </div>
                          )}

                          {/* ---- Discovered Product Candidates ---- */}
                          {msg.candidates && msg.candidates.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <div className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#0044ff', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Filter size={12} /> {msg.candidates.length} matching candidate{msg.candidates.length !== 1 ? 's' : ''} found
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                {msg.candidates.map((item: DiscoveredCandidate, idx: number) => (
                                  <div key={idx} className="minimal-card" style={{
                                    padding: 0,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'border-color 0.15s',
                                  }}>
                                    {/* Product Image */}
                                    {(item as any).image_url ? (
                                      <div style={{ width: '100%', height: '140px', overflow: 'hidden', background: '#f4f4f5', flexShrink: 0 }}>
                                        <img
                                          src={(item as any).image_url}
                                          alt={item.name}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          onError={(e: React.SyntheticEvent) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                        />
                                      </div>
                                    ) : (
                                      <div style={{ width: '100%', height: '80px', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderBottom: '1px solid #e4e4e7' }}>
                                        <Tag size={28} color="#0044ff" />
                                      </div>
                                    )}

                                    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                                      {/* Option badge + site */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="minimal-pill" style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem' }}>Option {idx + 1}</span>
                                        {item.source_site && (
                                          <span className="brutalist-mono" style={{ fontSize: '0.6rem', color: '#71717a', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.source_site}</span>
                                        )}
                                      </div>

                                      {/* Product Name */}
                                      <div className="brutalist-text" style={{ fontSize: '0.83rem', fontWeight: 700, color: '#111111', lineHeight: 1.3 }}>{item.name}</div>

                                      {/* Brand */}
                                      {item.brand && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <Tag size={10} color="#71717a" />
                                          <span className="brutalist-text" style={{ fontSize: '0.68rem', color: '#71717a', fontWeight: 600 }}>{item.brand}</span>
                                        </div>
                                      )}

                                      {/* Price */}
                                      <div className="brutalist-title" style={{ fontSize: '1.1rem', color: '#0044ff' }}>&#8377;{item.price.toLocaleString()}</div>

                                      {/* Star Rating */}
                                      {item.rating != null && <StarRating rating={item.rating} />}

                                      {/* Match Reason */}
                                      {(item as any).match_reason && (
                                        <div className="brutalist-text" style={{ fontSize: '0.67rem', color: '#0044ff', fontStyle: 'italic', lineHeight: 1.3, padding: '0.3rem 0.5rem', background: '#faf9f6', borderRadius: '2px', borderLeft: '2px solid #0044ff' }}>
                                          {(item as any).match_reason}
                                        </div>
                                      )}

                                      {/* Review Summary */}
                                      {item.review_summary && (
                                        <div className="brutalist-text" style={{ fontSize: '0.67rem', color: '#71717a', lineHeight: 1.3 }}>
                                          {item.review_summary}
                                        </div>
                                      )}

                                      {/* View Link */}
                                      {(item as any).source_url && (
                                        <a
                                          href={(item as any).source_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="brutalist-subtitle"
                                          style={{ marginTop: 'auto', paddingTop: '0.4rem', fontSize: '0.68rem', color: '#0044ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                        >
                                          <Globe size={11} /> View Product
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ---- Spend Guardrail Lock + Chosen Product ---- */}
                          {msg.guardrailData && (
                            <div style={{ marginTop: '0.85rem' }}>
                              {/* Chosen Product Card */}
                              {msg.guardrailData?.chosenProduct && (
                                <div style={{ marginBottom: '0.75rem', padding: '0.9rem 1rem', background: '#ffffff', borderRadius: '2px', border: '1px solid #e4e4e7', borderLeft: '4px solid #0044ff' }}>
                                  <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <CheckCircle size={13} color="#0044ff" /> Selected Optimal Choice
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    {msg.guardrailData?.chosenProduct?.image_url ? (
                                      <img src={msg.guardrailData.chosenProduct.image_url} alt={msg.guardrailData.chosenProduct.name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} onError={(e: React.SyntheticEvent) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                                    ) : (
                                      <div style={{ width: '64px', height: '64px', borderRadius: '2px', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Tag size={24} color="#0044ff" />
                                      </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="brutalist-text" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111111', lineHeight: 1.3 }}>{msg.guardrailData?.chosenProduct?.name}</div>
                                      {msg.guardrailData?.chosenProduct?.brand && (
                                        <div className="brutalist-text" style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '0.15rem' }}>{msg.guardrailData.chosenProduct.brand}</div>
                                      )}
                                      <div className="brutalist-title" style={{ fontSize: '1.1rem', color: '#0044ff', marginTop: '0.2rem' }}>&#8377;{Number(msg.guardrailData?.price).toLocaleString()}</div>
                                      {msg.guardrailData?.chosenProduct?.rating != null && <StarRating rating={msg.guardrailData.chosenProduct.rating} />}
                                      {msg.guardrailData?.chosenProduct?.source_url && (
                                        <a href={msg.guardrailData.chosenProduct.source_url} target="_blank" rel="noopener noreferrer" className="brutalist-subtitle" style={{ fontSize: '0.68rem', color: '#0044ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem' }}>
                                          <Globe size={11} /> View on Store
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {/* Candidates being compared */}
                                  {msg.guardrailData?.candidates && msg.guardrailData.candidates.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid #e4e4e7', paddingTop: '0.65rem' }}>
                                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', color: '#71717a', marginBottom: '0.4rem' }}>
                                        Negotiated between candidate(s):
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                                        {msg.guardrailData.candidates.map((cand: any, idx: number) => {
                                          const isChosen = cand.product_id === msg.guardrailData?.chosenProduct?.product_id;
                                          return (
                                            <div key={idx} style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.4rem',
                                              padding: '0.35rem 0.6rem',
                                              background: isChosen ? '#faf9f6' : '#ffffff',
                                              border: `1px solid ${isChosen ? '#0044ff' : '#e4e4e7'}`,
                                              borderRadius: '2px',
                                              flexShrink: 0,
                                            }}>
                                              {cand.image_url ? (
                                                <img src={cand.image_url} alt={cand.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px' }} />
                                              ) : (
                                                <div style={{ width: '24px', height: '24px', background: '#f4f4f5', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <Tag size={12} color="#71717a" />
                                                </div>
                                              )}
                                              <div className="brutalist-text" style={{ fontSize: '0.74rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {cand.name}
                                              </div>
                                              <div className="brutalist-text" style={{ fontSize: '0.74rem', fontWeight: 700, color: isChosen ? '#0044ff' : '#111111' }}>
                                                ₹{cand.price}
                                              </div>
                                              {isChosen && <span className="minimal-pill minimal-pill-primary" style={{ fontSize: '0.6rem' }}>CHOSEN</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Behind-the-scenes Agent Chat */}
                                  {msg.guardrailData?.dialogue && msg.guardrailData.dialogue.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem 0.9rem', background: '#faf9f6', borderRadius: '2px', border: '1px solid #e4e4e7', borderLeft: '4px solid #7c3aed' }}>
                                      <div className="brutalist-subtitle" style={{ color: '#7c3aed', marginBottom: '0.5rem', fontSize: '0.62rem' }}>
                                        Agent Negotiation Logs
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {msg.guardrailData.dialogue.map((bubble: any, bIdx: number) => (
                                          <div key={bIdx} style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}>
                                            <div style={{ width: '18px', height: '18px', borderRadius: '2px', background: '#0044ff', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, flexShrink: 0 }}>
                                              {bubble.avatar}
                                            </div>
                                            <div className="brutalist-text" style={{ flex: 1 }}>
                                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#111111', marginRight: '0.3rem' }}>{bubble.name}:</span>
                                              <span style={{ fontSize: '0.72rem', color: '#71717a', lineHeight: 1.4 }}>{bubble.text}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Guardrail Lock Bar */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.85rem 1.1rem',
                                borderRadius: '2px',
                                fontSize: '0.85rem',
                                border: '1px solid #e4e4e7',
                                marginTop: '0.75rem',
                                background: msg.guardrailData?.passed ? '#ecfdf5' : '#fef2f2',
                                color: msg.guardrailData?.passed ? '#047857' : '#b91c1c'
                              }}>
                                <Lock size={16} style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <div className="brutalist-subtitle" style={{ color: 'inherit', fontSize: '0.8rem' }}>Non-Negotiable Spend Guardrail</div>
                                  <div className="brutalist-mono" style={{ fontSize: '0.74rem', marginTop: '0.1rem', opacity: 0.9 }}>Ceiling: &#8377;{msg.guardrailData?.ceiling?.toLocaleString()} · Item: &#8377;{msg.guardrailData?.price?.toLocaleString()}</div>
                                </div>
                                <span className={`minimal-pill ${msg.guardrailData?.passed ? 'minimal-pill-success' : 'minimal-pill-danger'}`}>{msg.guardrailData?.passed ? 'PASSED' : 'BLOCKED'}</span>
                              </div>
                            </div>
                          )}

                          {/* ---- Payment Attempts ---- */}
                          {msg.paymentAttempts && msg.paymentAttempts.length > 0 && (
                            <div style={{ marginTop: '0.85rem', padding: '1rem', background: '#f4f4f5', borderRadius: '2px', border: '1px solid #e4e4e7', color: '#111111' }}>
                              <div className="brutalist-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', color: '#111111' }}>
                                <RefreshCw size={14} />
                                Razorpay Gateway (Fixed 1-Retry Policy)
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                                {msg.paymentAttempts.map((att, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.45rem 0.7rem', borderRadius: '2px', border: '1px solid #e4e4e7', fontSize: '0.78rem' }}>
                                    <span className="brutalist-text"><strong>Attempt {att.attempt}</strong> ({att.attempt === 1 ? 'Initial' : 'Retry 1/1'}): {att.reason || att.status}</span>
                                    <span className="minimal-pill minimal-pill-danger">{att.status}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="brutalist-text" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ffffff', padding: '0.45rem 0.7rem', borderRadius: '2px', borderLeft: '4px solid #ef4444', fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>
                                <ShieldAlert size={14} />
                                Policy Enforced: No further charges attempted. Awaiting details.
                              </div>
                            </div>
                          )}

                          {msg.riskData && <RiskFeatureChart data={msg.riskData} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isRunning && <LiveAgentProgress />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Guided Mode Site Input Bar */}
          {autonomyMode === 'guided' && (
            <div style={{ padding: '0.5rem 1.1rem', background: '#faf9f6', borderTop: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Globe size={15} color="#0044ff" />
              <span className="brutalist-subtitle" style={{ color: '#0044ff', fontSize: '0.75rem' }}>Target Site:</span>
              <input
                type="text"
                placeholder="e.g. myntra.com"
                value={requestedSitesInput}
                onChange={e => setRequestedSitesInput(e.target.value)}
                disabled={isRunning}
                className="minimal-input"
                style={{ flex: 1, padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
              />
            </div>
          )}

          {/* Input Bar */}
          <div style={{ padding: '0.85rem 1.1rem', borderTop: '1px solid #e4e4e7', background: '#ffffff' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={
                  awaitingClarification
                    ? 'Fill in the details above or type a reply…'
                    : autonomyMode === 'guided'
                      ? 'E.g. Buy me a shirt of 4000 rupees…'
                      : 'E.g. Find me running shoes under ₹4,000…'
                }
                disabled={isRunning}
                className="minimal-input"
                style={{ flex: 1, opacity: isRunning ? 0.6 : 1 }}
              />
              <button
                className="minimal-btn minimal-btn-primary"
                onClick={() => handleSend()}
                disabled={isRunning || !input.trim()}
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', opacity: (isRunning || !input.trim()) ? 0.5 : 1 }}>
                <Send size={15} /> Send
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
