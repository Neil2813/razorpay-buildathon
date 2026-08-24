import { useState, useEffect, useRef } from 'react';
import { Lock, ShieldAlert, RefreshCw, Send, ShieldX, CheckCircle, Globe, Star, Tag, Filter, Play } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AuditEvent } from '../components/KnowledgeGraph';
import RiskFeatureChart, { RiskFeaturesData } from '../components/RiskFeatureChart';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

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
  guardrailData?: { ceiling: number; price: number; passed: boolean; productName?: string; };
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
  { key: 'requested_sites', label: 'Website to Shop From', inputType: 'text', placeholder: 'e.g. myntra.com' },
];

const AUTONOMOUS_PARAMS: MissingParam[] = [
  { key: 'size', label: 'Size', inputType: 'select', options: ['any', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11'] },
  { key: 'color', label: 'Colour', inputType: 'select', options: ['any', 'black', 'white', 'blue', 'red', 'green', 'brown', 'pink', 'yellow', 'grey', 'navy', 'beige', 'orange'] },
  { key: 'budget_max', label: 'Max Budget / Ceiling (₹)', inputType: 'number', placeholder: 'e.g. 4000' },
  { key: 'budget_min', label: 'Min Budget / Floor (₹)', inputType: 'number', placeholder: 'e.g. 500' },
];

// ---------------------------------------------------------------------------
// Clarification Card Component
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

  const allFilled = missing.every(p => {
    const v = values[p.key];
    return v !== undefined && v.trim() !== '';
  });

  const handleSubmit = () => {
    if (allFilled) onSubmit(values);
  };

  const modeColor = mode === 'guided' ? '#0149ae' : '#5c2db8';
  const modeLabel = mode === 'guided' ? 'Guided Mode' : 'Autonomous Mode';

  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '1.1rem 1.25rem',
      background: 'linear-gradient(135deg, rgba(1,73,174,0.04) 0%, rgba(92,45,184,0.04) 100%)',
      borderRadius: '10px',
      border: `1px solid ${modeColor}30`,
      borderLeft: `4px solid ${modeColor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Filter size={15} color={modeColor} />
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: modeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {modeLabel} — Provide Details to Search
        </span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'rgba(30,30,30,0.65)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        I need a few more details before I start searching for your perfect product:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.85rem' }}>
        {missing.map((param) => (
          <div key={param.key}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: modeColor, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {param.label}
            </label>
            {param.inputType === 'select' && param.options ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {param.options.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setValues(v => ({ ...v, [param.key]: opt }))}
                    disabled={disabled}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '99px',
                      border: `1.5px solid ${values[param.key] === opt ? modeColor : 'rgba(1,73,174,0.2)'}`,
                      background: values[param.key] === opt ? modeColor : '#fff',
                      color: values[param.key] === opt ? '#fff' : 'rgba(30,30,30,0.7)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
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
                onChange={e => setValues(v => ({ ...v, [param.key]: e.target.value }))}
                disabled={disabled}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem',
                  border: `1px solid ${values[param.key] ? modeColor : 'rgba(1,73,174,0.2)'}`,
                  borderRadius: '6px',
                  fontSize: '0.83rem',
                  outline: 'none',
                  background: '#ffffff',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allFilled || disabled}
        style={{
          padding: '0.55rem 1.25rem',
          borderRadius: '7px',
          background: allFilled && !disabled ? `linear-gradient(135deg, ${modeColor}, #032676)` : 'rgba(0,0,0,0.08)',
          color: allFilled && !disabled ? '#fff' : 'rgba(0,0,0,0.35)',
          border: 'none',
          fontWeight: 700,
          fontSize: '0.82rem',
          cursor: allFilled && !disabled ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
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
      background: '#f8fafc',
      borderRadius: '10px',
      border: '1px solid rgba(1,73,174,0.2)',
      borderLeft: '4px solid #0149ae',
    }}>
      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#032676', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Select Execution Mode
      </div>
      <p style={{ fontSize: '0.8rem', color: 'rgba(30,30,30,0.7)', marginBottom: '0.85rem', lineHeight: 1.45 }}>
        How would you like the agent to execute your request?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectMode('autonomous')}
          style={{
            padding: '0.9rem',
            borderRadius: '8px',
            border: '1.5px solid rgba(92,45,184,0.3)',
            background: 'linear-gradient(135deg, rgba(92,45,184,0.05) 0%, #ffffff 100%)',
            textAlign: 'left',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#5c2db8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Play size={14} /> Autonomous Mode
          </div>
          <div style={{ fontSize: '0.74rem', color: 'rgba(30,30,30,0.65)', lineHeight: 1.4 }}>
            Let AI discover & buy automatically across vetted stores. Requires Size, Colour, Floor & Ceiling budget.
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectMode('guided')}
          style={{
            padding: '0.9rem',
            borderRadius: '8px',
            border: '1.5px solid rgba(1,73,174,0.3)',
            background: 'linear-gradient(135deg, rgba(1,73,174,0.05) 0%, #ffffff 100%)',
            textAlign: 'left',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0149ae', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Globe size={14} /> Guided Mode
          </div>
          <div style={{ fontSize: '0.74rem', color: 'rgba(30,30,30,0.65)', lineHeight: 1.4 }}>
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
  const [activeAgent, setActiveAgent] = useState('concierge');
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [autonomyMode, setAutonomyMode] = useState<'autonomous' | 'guided' | null>(null);
  const [requestedSitesInput, setRequestedSitesInput] = useState('');
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
        setCompletedAgents(prev => {
          const order = ['concierge', 'site_trust', 'discovery', 'negotiation', 'risk', 'payment', 'ledger'];
          const idx = order.indexOf(currentAgentKey);
          return order.slice(0, idx).filter(a => !prev.includes(a)).concat(prev);
        });
        setAuditLog(prev => [...prev, {
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

        setMessages(prev => [...prev, {
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

        // If escalated on clarification, keep awaitingClarification
        const isParamHalt = data.state.payment_status === 'escalated' &&
          (data.state.escalation_message || '').includes('detail');
        if (!isParamHalt) setAwaitingClarification(false);

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

  const handleSend = async (queryOverride?: string, forceMode?: 'autonomous' | 'guided' | null, siteOverride?: string) => {
    const query = queryOverride || input;
    if (!query.trim() || isRunning) return;

    const modeToUse = forceMode || autonomyMode;
    const sitesToUse = siteOverride !== undefined
      ? (siteOverride ? [siteOverride] : null)
      : (requestedSitesInput.trim() ? [requestedSitesInput.trim()] : null);

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    if (!queryOverride) setInput('');
    setActiveAgent('concierge'); setCompletedAgents([]); setAuditLog([]);
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
      });

      const data = res.data;
      if (data) {
        setPaymentStatus(data.payment_status || 'pending');
        if (data.escalation_message) setEscalationMessage(data.escalation_message);
        if (data.guardrail_ceiling) setGuardrailCeiling(data.guardrail_ceiling);
        if (data.chosen_product) setChosenProduct(data.chosen_product);
        if (data.risk_score !== undefined) setRiskScore(data.risk_score);
        if (data.risk_features) setRiskFeatures(data.risk_features);
        if (data.audit_log) setAuditLog(data.audit_log);
        if (data.trust_override) setTrustOverrideActive(true);

        // If WS didn't receive messages yet, populate messages from response
        const conciergeEvent = data.audit_log?.find((e: any) => e.agent === 'concierge');
        if (conciergeEvent?.output_summary?.missing_parameters?.length > 0) {
          const missing: string[] = conciergeEvent.output_summary.missing_parameters;
          let missingParams: MissingParam[] = [];
          if (missing.includes('autonomy_mode')) {
            missingParams = [{ key: 'autonomy_mode', label: 'Execution Mode', inputType: 'select' }];
          } else {
            const mode = modeToUse || 'autonomous';
            const allParams = mode === 'guided' ? GUIDED_PARAMS : AUTONOMOUS_PARAMS;
            missingParams = allParams.filter(p => missing.includes(p.key));
          }
          setAwaitingClarification(true);

          setMessages(prev => {
            const hasClarificationMsg = prev.some(m => m.missingParams && m.missingParams.length > 0);
            if (!hasClarificationMsg) {
              return [...prev, {
                role: 'agent',
                agent: 'concierge',
                content: conciergeEvent.output_summary.clarification || conciergeEvent.decision_reason || 'Please provide the missing details:',
                missingParams,
                clarificationMode: modeToUse || undefined,
              }];
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'agent', content: 'Transaction error. Please try again.' }]);
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
    if (values.requested_sites) parts.push(`from ${values.requested_sites}`);

    const clarificationMsg = parts.length > 0
      ? `I want: ${parts.join(', ')}.`
      : Object.entries(values).map(([k, v]) => `${k}: ${v}`).join(', ');

    // For guided mode with requested_sites, update the site input
    if (values.requested_sites) {
      setRequestedSitesInput(values.requested_sites);
    }

    await handleSend(clarificationMsg, autonomyMode, values.requested_sites || requestedSitesInput || undefined);
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
    setAwaitingClarification(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />

      <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>

        {/* Conversation Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '10px', border: '1px solid rgba(1,73,174,0.12)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(3,38,118,0.04)', minHeight: '450px' }}>

          {/* Canvas Header */}
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(1,73,174,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#032676', fontFamily: "'Antonio', sans-serif" }}>Agentic Checkout Cockpit</span>
              {isRunning && <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '99px', background: 'rgba(1,73,174,0.1)', color: '#0149ae', animation: 'pulse-ring 1.4s ease-out infinite' }}>LIVE</span>}
              {awaitingClarification && !isRunning && (
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.55rem', borderRadius: '99px', background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }}>
                  NEEDS DETAILS
                </span>
              )}
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
            </div>
          </div>

          {/* Messages Canvas */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: '#0149ae', opacity: 0.18, fontFamily: "'Antonio', sans-serif", fontWeight: 700 }}>GB</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#032676' }}>GLASSBOX Agentic Commerce Cockpit</h3>
                <p style={{ fontSize: '0.875rem', maxWidth: '560px', margin: '0 auto 1.5rem auto', lineHeight: 1.6, color: 'rgba(30,30,30,0.6)' }}>
                  Autonomous buyer agent with <strong>Smart Parameter Verification</strong>, <strong>Deterministic Site Trust</strong>, and <strong>Spend Guardrails</strong>.
                  Just describe what you want — the agent will ask for all the details it needs before searching!
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Buy me a shirt of ₹4000', 'Find running shoes under ₹3000', 'Get me a blue formal shirt'].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: '99px',
                        border: '1px solid rgba(1,73,174,0.25)',
                        background: 'rgba(1,73,174,0.04)',
                        color: '#0149ae',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {suggestion}
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
                      <div style={{ maxWidth: '88%', minWidth: 0 }}>
                        {!isUser && label && <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#0149ae', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{label}</div>}
                        <div style={{
                          padding: '0.85rem 1.1rem',
                          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                          background: isUser ? 'linear-gradient(135deg, #0149ae 0%, #032676 100%)' : '#f5f5f5',
                          color: isUser ? '#ffffff' : '#1e1e1e',
                          border: isUser ? 'none' : '1px solid rgba(1,73,174,0.1)',
                          borderLeft: isUser ? 'none' : '3px solid #0149ae',
                          fontSize: '0.875rem',
                          lineHeight: 1.55,
                          boxShadow: isUser ? '0 2px 8px rgba(1,73,174,0.2)' : '0 1px 4px rgba(3,38,118,0.04)',
                        }}>
                          <div style={{ fontWeight: 500 }}>{msg.content}</div>

                          {/* ---- Clarification / Mode Selection Card ---- */}
                          {msg.missingParams && msg.missingParams.length > 0 && (
                            msg.missingParams.some(p => p.key === 'autonomy_mode') ? (
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

                          {/* ---- Autonomous Skipped Banner ---- */}
                          {msg.sitesRejectedCount !== undefined && msg.sitesRejectedCount > 0 && (
                            <div style={{ marginTop: '0.65rem', padding: '0.45rem 0.75rem', background: 'rgba(1,73,174,0.06)', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', fontSize: '0.78rem', color: '#0149ae', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Globe size={14} />
                              Transparency Note: {msg.sitesRejectedCount} candidate source site(s) skipped automatically for failing trust checks.
                            </div>
                          )}

                          {/* ---- Discovered Product Candidates ---- */}
                          {msg.candidates && msg.candidates.length > 0 && (
                            <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                              {msg.candidates.map((item, idx) => (
                                <div key={idx} style={{
                                  background: '#ffffff',
                                  padding: '0.85rem',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(1,73,174,0.15)',
                                  boxShadow: '0 2px 6px rgba(3,38,118,0.06)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.3rem',
                                  transition: 'box-shadow 0.2s',
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.6rem', color: 'rgba(30,30,30,0.4)', fontWeight: 800, textTransform: 'uppercase' }}>Option {idx + 1}</span>
                                    {item.source_site && (
                                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(1,73,174,0.08)', color: '#0149ae', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.source_site}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e1e1e', lineHeight: 1.3 }}>{item.name}</div>

                                  {/* Brand */}
                                  {item.brand && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <Tag size={10} color="rgba(30,30,30,0.4)" />
                                      <span style={{ fontSize: '0.7rem', color: 'rgba(30,30,30,0.55)', fontWeight: 600 }}>{item.brand}</span>
                                    </div>
                                  )}

                                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0149ae' }}>&#8377;{item.price.toLocaleString()}</div>

                                  {/* Star Rating */}
                                  {item.rating !== undefined && item.rating !== null && (
                                    <StarRating rating={item.rating} />
                                  )}

                                  {item.review_summary && (
                                    <div style={{ fontSize: '0.71rem', color: 'rgba(30,30,30,0.6)', lineHeight: 1.3, marginTop: '0.1rem' }}>
                                      {item.review_summary}
                                    </div>
                                  )}

                                  {/* Match reason */}
                                  {(item as any).match_reason && (
                                    <div style={{ fontSize: '0.68rem', color: '#0149ae', fontStyle: 'italic', marginTop: '0.2rem', lineHeight: 1.3 }}>
                                      {(item as any).match_reason}
                                    </div>
                                  )}

                                  <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                    <span className={`pill ${item.has_return_policy !== false ? 'pill-success' : 'pill-danger'}`}>
                                      {item.has_return_policy !== false ? 'Returns' : 'No Returns'}
                                    </span>
                                    {item.has_delivery_time !== false && <span className="pill pill-blue">ETA</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* ---- Spend Guardrail Lock ---- */}
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

                          {/* ---- Payment Attempts ---- */}
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

          {/* Guided Mode Site Input Bar */}
          {autonomyMode === 'guided' && (
            <div style={{ padding: '0.5rem 1.1rem', background: 'rgba(1,73,174,0.04)', borderTop: '1px solid rgba(1,73,174,0.08)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Globe size={15} color="#0149ae" />
              <span style={{ fontSize: '0.78rem', color: '#0149ae', fontWeight: 700 }}>Target Site URL / Domain:</span>
              <input
                type="text"
                placeholder="e.g. myntra.com or amaz0n-deals.com"
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
                style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid rgba(1,73,174,0.15)', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', opacity: isRunning ? 0.6 : 1, background: '#ffffff', color: '#1e1e1e' }}
                onFocus={e => e.target.style.borderColor = '#0149ae'}
                onBlur={e => e.target.style.borderColor = 'rgba(1,73,174,0.15)'}
              />
              <button
                className="btn-primary"
                onClick={() => handleSend()}
                disabled={isRunning || !input.trim()}
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: (isRunning || !input.trim()) ? 0.5 : 1, cursor: (isRunning || !input.trim()) ? 'not-allowed' : 'pointer' }}>
                <Send size={15} /> Send
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
