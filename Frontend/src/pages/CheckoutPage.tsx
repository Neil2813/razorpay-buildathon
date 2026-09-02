import { useState, useEffect, useRef } from 'react';
import { Lock, ShieldAlert, RefreshCw, Send, ShieldX, CheckCircle, Globe, Star, Tag, Filter, Play, TrendingUp, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AuditEvent } from '../components/KnowledgeGraph';
import RiskFeatureChart, { RiskFeaturesData } from '../components/RiskFeatureChart';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { soundFX } from '../lib/soundFX';
import InteractiveCard3D from '../components/InteractiveCard3D';

import ConfettiCanvas from '../components/ConfettiCanvas';
import GlassReceiptModal from '../components/GlassReceiptModal';

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
  upsellOffer?: {
    product_id: string;
    name: string;
    category?: string;
    color?: string;
    rating?: number;
    original_price: number;
    discount_pct: number;
    discounted_price: number;
    bundle_total: number;
    revenue_lift_inr: number;
    pitch?: string;
    within_ceiling: boolean;
    buyer_accepted?: boolean;
  };
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
  { key: 'gender', label: 'Gender / Department', inputType: 'select', options: ['any', 'men', 'women', 'unisex'] },
  { key: 'size', label: 'Size', inputType: 'select', options: ['any', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11'] },
  { key: 'color', label: 'Colour', inputType: 'select', options: ['any', 'black', 'white', 'blue', 'red', 'green', 'brown', 'pink', 'yellow', 'grey', 'navy', 'beige', 'orange'] },
  { key: 'budget_min', label: 'Floor Price (₹)', inputType: 'number', placeholder: 'e.g. 500' },
  { key: 'budget_max', label: 'Ceiling Price (₹)', inputType: 'number', placeholder: 'e.g. 4000' },
  { key: 'brand', label: 'Brand', inputType: 'text', placeholder: 'e.g. Nike, or type "any"' },
  { key: 'min_rating', label: 'Minimum Rating (out of 5)', inputType: 'select', options: ['any', '3', '3.5', '4', '4.5'] },
];

const AUTONOMOUS_PARAMS: MissingParam[] = [
  { key: 'gender', label: 'Gender / Department', inputType: 'select', options: ['any', 'men', 'women', 'unisex'] },
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

function getSizeOptionsForCategory(category?: string, userMsgText?: string): { label: string; options: string[] } {
  const text = ((category || '') + ' ' + (userMsgText || '')).toLowerCase();

  if (/\b(shoe|shoes|sneaker|sneakers|boot|boots|footwear|slipper|sandals?)\b/i.test(text)) {
    return {
      label: 'Shoe Size (UK/US)',
      options: ['any', '6', '7', '8', '9', '10', '11', '12'],
    };
  }

  if (/\b(pant|pants|jeans|trouser|trousers|shorts?|skirt)\b/i.test(text)) {
    return {
      label: 'Pant Size (Waist / Fit)',
      options: ['any', '28', '30', '32', '34', '36', '38', '40', 'S', 'M', 'L', 'XL'],
    };
  }

  if (/\b(shirt|shirts|t-shirt|tshirt|tshirts|jacket|jackets|dress|dresses|kurta|kurtas|top|tops|hoodie|sweater)\b/i.test(text)) {
    return {
      label: 'Shirt Size',
      options: ['any', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    };
  }

  return {
    label: 'Size',
    options: ['any', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11'],
  };
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
  const [buyerApproved, setBuyerApproved] = useState(false);
  const [sessionId, setSessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 9)}`);
  const [isRunning, setIsRunning] = useState(false);

  const [_auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [_escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const [_guardrailCeiling, setGuardrailCeiling] = useState<number | undefined>(undefined);
  const [chosenProduct, setChosenProduct] = useState<Record<string, any> | null>(null);
  const [_riskScore, setRiskScore] = useState<number | null>(null);
  const [_riskFeatures, setRiskFeatures] = useState<Record<string, any> | null>(null);
  const [trustOverrideActive, setTrustOverrideActive] = useState<boolean>(false);
  const [awaitingClarification, setAwaitingClarification] = useState<boolean>(false);
  const [upsellOffer, setUpsellOffer] = useState<Record<string, any> | null>(null);
  const [acceptUpsell, setAcceptUpsell] = useState(false);
  const [upsellDeclined, setUpsellDeclined] = useState(false);

  // Interactive Card & Preset State
  const [cardNumber, _setCardNumber] = useState('4532 8920 1192 4892');
  const [cardHolder, setCardHolder] = useState('AARAV SHARMA');
  const [expiry, _setExpiry] = useState('12/28');
  const [cvv, _setCvv] = useState('882');
  const [focusedField, _setFocusedField] = useState<string | null>(null);
  const [paymentMethod] = useState('card');

  // Interactive Confetti & Glass Receipt State
  const [showConfetti, setShowConfetti] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, _setReceiptData] = useState<any>(null);

  // Buyer Address Management
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home', recipient_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', is_default: false
  });
  const [deliveryAddress, setDeliveryAddress] = useState<Record<string, any> | null>(null);

  const fetchAddresses = async () => {
    try {
      const res = await api.get('/commerce/addresses');
      setAddresses(res.addresses || []);
      const defaultAddr = res.addresses?.find((a: any) => a.is_default) || res.addresses?.[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr.address_id);
    } catch (err) {
      console.error("Failed to load addresses", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
      if (user.card_holder) setCardHolder(user.card_holder);
      else if (user.full_name) setCardHolder(user.full_name.toUpperCase());
      if (user.card_number) _setCardNumber(user.card_number);
      if (user.card_expiry) _setExpiry(user.card_expiry);
      if (user.card_cvv) _setCvv(user.card_cvv);
    }
  }, [user]);


  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/commerce/addresses', newAddress);
      setShowAddAddressForm(false);
      setNewAddress({
        label: 'Home', recipient_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', is_default: false
      });
      await fetchAddresses();
      setSelectedAddressId(res.address_id);
    } catch (err) {
      alert("Failed to save address. Please check PIN code (must be 6 digits).");
    }
  };

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem('glassbox_token');
    if (!token) {
      console.warn('[ws] No authentication token found. Skipping WebSocket connection.');
      return;
    }
    const wsUrl = `ws://localhost:8000/api/transaction/ws/${sessionId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
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

        if (data.output_summary?.trust_override) {
          setTrustOverrideActive(true);
        }

        // Check for missing parameters (clarification required)
        if (data.agent === 'concierge' && data.output_summary?.missing_parameters?.length > 0) {
          setAwaitingClarification(true);
        }

        if ((data.agent === 'discovery' || data.agent === 'catalog') && data.output_summary) {
          if (data.output_summary.candidates?.length || data.output_summary.discovered_candidates?.length) setAwaitingClarification(false);
        } else if (data.agent === 'risk' && data.output_summary) {
          const s = data.output_summary;
          setRiskScore(s.risk_score);
          setRiskFeatures({ top_features: s.top_features, model: s.model_source, explanation: s.explanation });
        } else if (data.agent === 'negotiation' && data.output_summary) {
          const s = data.output_summary;
          setGuardrailCeiling(s.ceiling);
          if (s.product_id) setChosenProduct({ product_id: s.product_id, price: s.price });
        }

        // REST renders one durable, rich summary after the run completes.
        // WebSocket events are deliberately state-only so the same
        // clarification card never appears twice.
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
        if (data.state.delivery_address) setDeliveryAddress(data.state.delivery_address);

        // A missing detail is a normal pause, not an escalation.
        const isParamHalt = Boolean(data.state.intent?.needs_clarification);

        if (isParamHalt) {
          setAwaitingClarification(true);
          return;
        }

        setAwaitingClarification(false);
      }
    };

    ws.onclose = (event) => {
      if (event.code === 1008) {
        console.warn('[ws] WebSocket connection rejected due to invalid authentication token.');
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [sessionId]);

  const handleSend = async (queryOverride?: string, forceMode?: 'autonomous' | 'guided' | null, _siteOverride?: string, buyerApproved = false) => {
    soundFX.playClick();
    const query = queryOverride || input;
    if (!query.trim() || isRunning) return;

    const modeToUse = forceMode !== undefined ? forceMode : (autonomyMode ?? 'autonomous');
    const sitesToUse = null; // External retailer sites are intentionally out of scope.

    // Append user message. On clarification turns (queryOverride set), keep prior agent messages.
    // On fresh top-level sends, keep only prior user messages (wipe stale agent cards).
    if (queryOverride) {
      // Clarification / mode continuation: append user reply, don't reset history
      setMessages((prev: Message[]) => [...prev, { role: 'user', content: query }]);
    } else {
      // Fresh query: clear everything and start new
      setMessages([{ role: 'user', content: query }]);
      setInput('');
      setChosenProduct(null);
      setBuyerApproved(false);
      setDeliveryAddress(null);
      setTrustOverrideActive(false);
      setUpsellOffer(null);
      setAcceptUpsell(false);
      setUpsellDeclined(false);
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
        accept_upsell: acceptUpsell,
        address_id: selectedAddressId || undefined,
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
        setBuyerApproved(Boolean(data.buyer_approved));
        if (data.trust_override) setTrustOverrideActive(true);
        if (data.delivery_address) setDeliveryAddress(data.delivery_address);
        if (data.upsell_offer) setUpsellOffer(data.upsell_offer);

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
            // Use total_amount (which includes tax & shipping) to match the server-created order_id amount
            const checkoutAmount = data.chosen_product?.total_amount ?? data.chosen_product?.price ?? 0;
            const checkout = new window.Razorpay!({
              key: data.razorpay_key_id,
              amount: Math.round(Number(checkoutAmount) * 100),
              currency: 'INR',
              name: 'GLASSBOX Merchant',
              description: data.chosen_product.name,
              order_id: data.razorpay_order_id,
              prefill: { email: user?.email },
              handler: async (payment: any) => {
                try {
                  const verified = await api.post('/transaction/verify-payment', { session_id: data.session_id, ...payment });
                  setPaymentStatus(verified.payment_status);
                  setMessages((prev: Message[]) => [...prev, { role: 'agent', agent: 'payment', content: 'Payment verified server-side. The merchant order is ready for fulfilment.' }]);
                } catch (err: any) {
                  if (err.message?.includes('409') || err.message?.includes('fulfilled') || err.message?.includes('exhausted')) {
                    setPaymentStatus('success');
                    setMessages((prev: Message[]) => [...prev, { role: 'agent', agent: 'payment', content: 'Payment capture confirmed and order fulfilled server-side via Razorpay webhook.' }]);
                  } else {
                    setMessages((prev: Message[]) => [...prev, { role: 'agent', agent: 'payment', content: `Payment verification note: ${err.message || 'Verification completed.'}` }]);
                  }
                }
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
            const cat = conciergeEvent.output_summary?.intent_so_far?.category || '';
            const msgText = conciergeEvent.inputs_summary?.message || query || '';
            missingParams = allParams
              .filter(p => missing.includes(p.key))
              .map(p => {
                if (p.key === 'size') {
                  const spec = getSizeOptionsForCategory(cat, msgText);
                  return { ...p, label: spec.label, options: spec.options };
                }
                return p;
              });
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
              upsellOffer: data.upsell_offer || upsellOffer || undefined,
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
    if (values.gender && values.gender !== 'any') parts.push(`for ${values.gender}`);
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
    setBuyerApproved(false);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f6f1e5' }}>
      <Navbar />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, minHeight: 'calc(100vh - 60px)', background: '#f6f1e5' }}>
        {/* Left Sidebar */}

      <div style={{ 
        background: '#060e26', 
        borderRight: '2px solid #060e26', 
        padding: '1.75rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.75rem', 
        overflowY: 'auto'
      }}>

        {/* Section 1: Delivery Address Selection */}
        <div>
          <div className="brutalist-subtitle" style={{ color: '#ffffff', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            DELIVERY ADDRESS
          </div>
          
          {addresses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select
                value={selectedAddressId}
                onChange={(e) => setSelectedAddressId(e.target.value)}
                style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem', fontWeight: 700, background: '#ffffff', color: '#060e26', border: '2px solid #000000', borderRadius: '0px', fontFamily: "'Space Grotesk', sans-serif" }}
                disabled={isRunning}
              >
                {addresses.map((addr) => (
                  <option key={addr.address_id} value={addr.address_id}>
                    {addr.label}: {addr.city} ({addr.pincode})
                  </option>
                ))}
              </select>
              
              {(() => {
                const curr = addresses.find(a => a.address_id === selectedAddressId);
                if (!curr) return null;
                return (
                  <div style={{ fontSize: '0.78rem', color: '#060e26', padding: '0.65rem 0.75rem', background: '#ffffff', border: '2px solid #000000', borderRadius: '0px', lineHeight: 1.4, fontWeight: 600 }}>
                    <strong>{curr.recipient_name}</strong> - {curr.line1}, {curr.city}, {curr.state} ({curr.pincode})
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="brutalist-text" style={{ fontSize: '0.78rem', color: '#d4d4d8', margin: 0 }}>No addresses found. Add one below.</p>
          )}

          <button
            type="button"
            onClick={() => setShowAddAddressForm(!showAddAddressForm)}
            style={{ width: '100%', fontSize: '0.78rem', marginTop: '0.6rem', padding: '0.55rem', background: '#ffffff', color: '#060e26', border: '2px solid #000000', boxShadow: '3px 3px 0px #000000', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0px', fontFamily: "'Space Grotesk', sans-serif" }}
            disabled={isRunning}
          >
            {showAddAddressForm ? 'Cancel Add Address' : '+ ADD NEW ADDRESS'}
          </button>

          {showAddAddressForm && (
            <form onSubmit={handleAddAddress} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem', padding: '0.65rem', background: '#ffffff', border: '2px solid #000000', borderRadius: '0px' }}>
              <input
                type="text"
                placeholder="Address Label (e.g. Work)"
                value={newAddress.label}
                onChange={e => setNewAddress({ ...newAddress, label: e.target.value })}
                required
                className="minimal-input"
                style={{ padding: '0.35rem', fontSize: '0.75rem' }}
              />
              <input
                type="text"
                placeholder="Recipient Name"
                value={newAddress.recipient_name}
                onChange={e => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
                required
                className="minimal-input"
                style={{ padding: '0.35rem', fontSize: '0.75rem' }}
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newAddress.phone}
                onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })}
                required
                className="minimal-input"
                style={{ padding: '0.35rem', fontSize: '0.75rem' }}
              />
              <input
                type="text"
                placeholder="Address Line 1"
                value={newAddress.line1}
                onChange={e => setNewAddress({ ...newAddress, line1: e.target.value })}
                required
                className="minimal-input"
                style={{ padding: '0.35rem', fontSize: '0.75rem' }}
              />
              <input
                type="text"
                placeholder="City"
                value={newAddress.city}
                onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                required
                className="minimal-input"
                style={{ padding: '0.35rem', fontSize: '0.75rem' }}
              />
              <input
                type="text"
                placeholder="State"
                value={newAddress.state}
                onChange={e => setNewAddress({ ...newAddress, state: e.target.value })}
                required
                className="minimal-input"
                style={{ padding: '0.35rem', fontSize: '0.75rem' }}
              />
              <input
                type="text"
                placeholder="PIN Code (6 digits)"
                value={newAddress.pincode}
                onChange={e => setNewAddress({ ...newAddress, pincode: e.target.value })}
                required
                className="minimal-input"
                style={{ padding: '0.35rem', fontSize: '0.75rem' }}
              />
              <button type="submit" className="minimal-btn minimal-btn-primary" style={{ fontSize: '0.72rem', padding: '0.4rem', width: '100%', marginTop: '0.2rem' }}>
                Save Address
              </button>
            </form>
          )}
        </div>




        {/* Section 3: Interactive 3D Payment Instrument */}
        <div>
          <div className="brutalist-subtitle" style={{ color: '#ffffff', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            PAYMENT CARD DETAILS
          </div>
          
          <InteractiveCard3D
            cardNumber={cardNumber}
            cardHolder={cardHolder}
            expiry={expiry}
            cvv={cvv}
            focusedField={focusedField}
            paymentMethod={paymentMethod}
            cardTheme="light"
          />


        </div>

        {chosenProduct && paymentStatus === 'pending' && !buyerApproved && !isRunning && (
          <div>
            <div className="brutalist-subtitle" style={{ color: '#ffffff', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              PAYMENT APPROVAL
            </div>
            <div style={{ padding: '1rem', background: '#ffffff', border: '2px solid #000000', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p className="brutalist-text" style={{ fontSize: '0.78rem', margin: 0, fontWeight: 700, color: '#111111' }}>
                {chosenProduct.name}
              </p>

              {/* Invoice Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: '#faf9f6', padding: '0.75rem', border: '1px solid #e4e4e7', borderRadius: '2px', fontSize: '0.76rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>Product Price:</span>
                  <span style={{ fontWeight: 600, color: '#111111' }}>₹{Number(chosenProduct.price).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>Shipping Fee:</span>
                  <span style={{ fontWeight: 600, color: '#111111' }}>₹{Number(chosenProduct.fulfilment?.shipping_fee || 0).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>Taxes (18% GST):</span>
                  <span style={{ fontWeight: 600, color: '#111111' }}>₹{Number(chosenProduct.fulfilment?.tax_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ borderTop: '1px solid #e4e4e7', marginTop: '0.35rem', paddingTop: '0.35rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 900 }}>
                  <span style={{ color: '#060e26' }}>Total Checkout:</span>
                  <span style={{ color: '#060e26' }}>₹{Number(chosenProduct.total_amount || chosenProduct.price).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Delivery Address & Estimate */}
              {deliveryAddress && (
                <div style={{ fontSize: '0.74rem', border: '1px solid #e4e4e7', padding: '0.75rem', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ fontWeight: 700, color: '#111111', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Delivery Address</div>
                  <div style={{ color: '#111111', fontWeight: 600 }}>{deliveryAddress.recipient_name} ({deliveryAddress.phone})</div>
                  <div style={{ color: '#71717a' }}>{deliveryAddress.line1}{deliveryAddress.line2 ? `, ${deliveryAddress.line2}` : ''}</div>
                  <div style={{ color: '#71717a' }}>{deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}</div>
                  
                  {chosenProduct.fulfilment?.delivery_estimate && (
                    <div style={{ borderTop: '1px solid #f4f4f5', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#060e26', fontWeight: 700 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#060e26' }} />
                      Estimated Delivery: {chosenProduct.fulfilment.delivery_estimate}
                    </div>
                  )}
                </div>
              )}

              <button 
                type="button" 
                onClick={() => handleSend('I approve this exact merchant order and amount.', autonomyMode, undefined, true)} 
                style={{ 
                  width: '100%', 
                  fontSize: '0.82rem', 
                  padding: '0.8rem', 
                  background: '#ffffff',
                  color: '#060e26',
                  border: '3px solid #000000',
                  boxShadow: '3px 3px 0px #000000',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontFamily: "'Space Grotesk', sans-serif",
                  cursor: 'pointer',
                  borderRadius: '0px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Lock size={14} style={{ color: '#060e26' }} /> APPROVE & OPEN TEST CHECKOUT
              </button>
            </div>
          </div>
        )}



        {/* Section 5: Live Controls Context / Clarification / Trust Overrides */}
        {(awaitingClarification || trustOverrideActive) && (
          <div>
            <div className="brutalist-subtitle" style={{ color: '#ef4444', marginBottom: '0.6rem', fontSize: '0.68rem' }}>
              ATTENTION REQUIRED
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f6f1e5' }}>
        
        {/* Transcript Log Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#f6f1e5' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="brutalist-title" style={{ 
                fontSize: '3.5rem', 
                marginBottom: '1rem', 
                color: '#060e26', 
                fontWeight: 900, 
                letterSpacing: '0.01em',
                textTransform: 'uppercase',
                fontFamily: "'Space Grotesk', sans-serif"
              }}>
                HI, {user?.full_name ? user.full_name.toUpperCase() : 'NEIL EMMANUEL MATHIAS'}
              </div>
              <p className="brutalist-text" style={{ 
                fontSize: '1.05rem', 
                maxWidth: '620px', 
                margin: '0 auto 2.5rem auto', 
                lineHeight: 1.5, 
                color: '#060e26', 
                fontWeight: 600,
                fontFamily: "'Space Grotesk', sans-serif"
              }}>
                What would you like to buy today? Tell me what you're looking for, and I'll find the best options in our store for you.
              </p>
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {['BUY ME A SHIRT UNDER ₹4000', 'FIND RUNNING SHOES UNDER ₹3000', 'GET ME A BLUE FORMAL SHIRT'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    style={{ 
                      padding: '0.85rem 1.4rem', 
                      fontSize: '0.88rem', 
                      background: '#ffffff',
                      color: '#060e26',
                      border: '3px solid #060e26',
                      boxShadow: '4px 4px 0px #060e26',
                      fontWeight: 800,
                      letterSpacing: '0.03em',
                      cursor: 'pointer',
                      borderRadius: '0px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}
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
                        {!isUser && label && <div className="brutalist-subtitle" style={{ color: '#060e26', marginBottom: '0.35rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif" }}>{label}</div>}
                        <div style={{
                          padding: '1rem 1.25rem',
                          borderRadius: '0px',
                          background: isUser ? '#060e26' : '#ffffff',
                          color: isUser ? '#ffffff' : '#060e26',
                          border: '2px solid #060e26',
                          boxShadow: isUser ? '3px 3px 0px rgba(0,0,0,0.15)' : '4px 4px 0px #060e26',
                          fontSize: '0.9rem',
                          lineHeight: 1.55,
                          fontFamily: "'Space Grotesk', sans-serif"
                        }}>
                          <div className="brutalist-text" style={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>{msg.content}</div>

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
                            <div style={{ marginTop: '0.85rem', padding: '1rem 1.15rem', background: '#fee2e2', borderRadius: '0px', border: '2px solid #060e26', borderLeft: '4px solid #ef4444', color: '#991b1b', animation: 'slide-in-up 0.3s ease-out' }}>
                              <div className="brutalist-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', marginBottom: '0.4rem' }}>
                                <ShieldX size={18} color="#ef4444" />
                                Deterministic Site Trust Warning
                              </div>
                              <p className="brutalist-text" style={{ margin: '0 0 0.6rem 0', fontSize: '0.82rem', lineHeight: 1.5, color: '#111111' }}>
                                Target site <strong>{msg.trustWarningPrompt.site}</strong> failed deterministic safety checks (HTTPS, SSL, domain age, typosquatting pattern).
                              </p>
                              <div className="brutalist-mono" style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '0px', border: '1px solid #060e26', marginBottom: '0.85rem', color: '#111111' }}>
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
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '0px' }}
                                >
                                  <CheckCircle size={14} /> Continue & Override
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRestartSession}
                                  className="minimal-btn minimal-btn-ghost"
                                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '0px', background: '#ffffff', border: '1px solid #060e26' }}
                                >
                                  Restart Search
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ---- Autonomous Skipped Banner ---- */}
                          {msg.sitesRejectedCount !== undefined && msg.sitesRejectedCount > 0 && (
                            <div className="brutalist-text" style={{ marginTop: '0.65rem', padding: '0.55rem 0.85rem', background: '#ffffff', borderRadius: '0px', border: '2px solid #060e26', fontSize: '0.78rem', color: '#060e26', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Space Grotesk', sans-serif" }}>
                              <Globe size={14} color="#060e26" />
                              Transparency Note: {msg.sitesRejectedCount} candidate site(s) skipped for failing trust check.
                            </div>
                          )}

                          {/* ---- Discovered Product Candidates ---- */}
                          {msg.candidates && msg.candidates.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <div className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#060e26', fontWeight: 800, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                <Filter size={12} color="#060e26" /> {msg.candidates.length} matching candidate{msg.candidates.length !== 1 ? 's' : ''} found
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem' }}>
                                {msg.candidates.map((item: DiscoveredCandidate, idx: number) => (
                                  <div key={idx} style={{
                                    padding: 0,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: '#ffffff',
                                    border: '2px solid #060e26',
                                    boxShadow: '3px 3px 0px #060e26',
                                    borderRadius: '0px'
                                  }}>
                                    {/* Product Image */}
                                    {(item as any).image_url ? (
                                      <div style={{ width: '100%', height: '140px', overflow: 'hidden', background: '#f6f1e5', flexShrink: 0, borderBottom: '2px solid #060e26' }}>
                                        <img
                                          src={(item as any).image_url}
                                          alt={item.name}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          onError={(e: React.SyntheticEvent) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                        />
                                      </div>
                                    ) : (
                                      <div style={{ width: '100%', height: '80px', background: '#f6f1e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderBottom: '2px solid #060e26' }}>
                                        <Tag size={28} color="#060e26" />
                                      </div>
                                    )}

                                    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                                      {/* Option badge + site */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.45rem', background: '#060e26', color: '#ffffff', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>OPTION {idx + 1}</span>
                                        {item.source_site && (
                                          <span className="brutalist-mono" style={{ fontSize: '0.62rem', color: '#71717a', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{item.source_site}</span>
                                        )}
                                      </div>

                                      {/* Product Name */}
                                      <div className="brutalist-text" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#060e26', lineHeight: 1.3, fontFamily: "'Space Grotesk', sans-serif" }}>{item.name}</div>

                                      {/* Brand */}
                                      {item.brand && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <Tag size={10} color="#060e26" />
                                          <span className="brutalist-text" style={{ fontSize: '0.68rem', color: '#71717a', fontWeight: 600 }}>{item.brand}</span>
                                        </div>
                                      )}

                                      {/* Price */}
                                      <div className="brutalist-title" style={{ fontSize: '1.15rem', color: '#060e26', fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif" }}>&#8377;{item.price.toLocaleString()}</div>

                                      {/* Star Rating */}
                                      {item.rating != null && <StarRating rating={item.rating} />}

                                      {/* Match Reason */}
                                      {(item as any).match_reason && (
                                        <div className="brutalist-text" style={{ fontSize: '0.7rem', color: '#060e26', lineHeight: 1.35, padding: '0.4rem 0.6rem', background: '#f6f1e5', borderRadius: '0px', border: '1px solid #060e26', borderLeft: '3px solid #060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
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
                                          style={{ marginTop: 'auto', paddingTop: '0.4rem', fontSize: '0.72rem', color: '#060e26', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: "'Space Grotesk', sans-serif" }}
                                        >
                                          <Globe size={11} color="#060e26" /> View Product
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
                                <div style={{ marginBottom: '0.75rem', padding: '0.9rem 1rem', background: '#ffffff', borderRadius: '0px', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26' }}>
                                  <div className="brutalist-subtitle" style={{ color: '#060e26', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em' }}>
                                    <CheckCircle size={13} color="#060e26" /> SELECTED OPTIMAL CHOICE
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    {msg.guardrailData?.chosenProduct?.image_url ? (
                                      <img src={msg.guardrailData.chosenProduct.image_url} alt={msg.guardrailData.chosenProduct.name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '0px', border: '1px solid #060e26', flexShrink: 0 }} onError={(e: React.SyntheticEvent) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                                    ) : (
                                      <div style={{ width: '64px', height: '64px', borderRadius: '0px', border: '1px solid #060e26', background: '#f6f1e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Tag size={24} color="#060e26" />
                                      </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="brutalist-text" style={{ fontWeight: 800, fontSize: '0.9rem', color: '#060e26', lineHeight: 1.3, fontFamily: "'Space Grotesk', sans-serif" }}>{msg.guardrailData?.chosenProduct?.name}</div>
                                      {msg.guardrailData?.chosenProduct?.brand && (
                                        <div className="brutalist-text" style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '0.15rem' }}>{msg.guardrailData.chosenProduct.brand}</div>
                                      )}
                                      <div className="brutalist-title" style={{ fontSize: '1.15rem', color: '#060e26', fontWeight: 900, marginTop: '0.2rem', fontFamily: "'Space Grotesk', sans-serif" }}>&#8377;{Number(msg.guardrailData?.price).toLocaleString()}</div>
                                      {msg.guardrailData?.chosenProduct?.rating != null && <StarRating rating={msg.guardrailData.chosenProduct.rating} />}
                                      {msg.guardrailData?.chosenProduct?.source_url && (
                                        <a href={msg.guardrailData.chosenProduct.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#060e26', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', fontFamily: "'Space Grotesk', sans-serif" }}>
                                          <Globe size={11} color="#060e26" /> View on Store
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {/* Candidates being compared */}
                                  {msg.guardrailData?.candidates && msg.guardrailData.candidates.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid #e4e4e7', paddingTop: '0.65rem' }}>
                                      <div className="brutalist-subtitle" style={{ fontSize: '0.65rem', color: '#060e26', fontWeight: 700, marginBottom: '0.4rem', fontFamily: "'Space Grotesk', sans-serif" }}>
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
                                              background: isChosen ? '#060e26' : '#ffffff',
                                              color: isChosen ? '#ffffff' : '#060e26',
                                              border: '1px solid #060e26',
                                              borderRadius: '0px',
                                              flexShrink: 0,
                                            }}>
                                              {cand.image_url ? (
                                                <img src={cand.image_url} alt={cand.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '0px' }} />
                                              ) : (
                                                <div style={{ width: '24px', height: '24px', background: isChosen ? '#ffffff' : '#f6f1e5', borderRadius: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <Tag size={12} color={isChosen ? '#060e26' : '#060e26'} />
                                                </div>
                                              )}
                                              <div className="brutalist-text" style={{ fontSize: '0.74rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isChosen ? '#ffffff' : '#060e26' }}>
                                                {cand.name}
                                              </div>
                                              <div className="brutalist-text" style={{ fontSize: '0.74rem', fontWeight: 800, color: isChosen ? '#ffffff' : '#060e26' }}>
                                                ₹{cand.price}
                                              </div>
                                              {isChosen && <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', background: '#ffffff', color: '#060e26' }}>CHOSEN</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Behind-the-scenes Agent Chat */}
                                  {msg.guardrailData?.dialogue && msg.guardrailData.dialogue.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem 0.9rem', background: '#f6f1e5', borderRadius: '0px', border: '1px solid #060e26', borderLeft: '4px solid #060e26' }}>
                                      <div className="brutalist-subtitle" style={{ color: '#060e26', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.68rem', fontFamily: "'Space Grotesk', sans-serif" }}>
                                        Agent Negotiation Logs
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {msg.guardrailData.dialogue.map((bubble: any, bIdx: number) => (
                                          <div key={bIdx} style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}>
                                            <div style={{ width: '18px', height: '18px', borderRadius: '0px', background: '#060e26', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, flexShrink: 0 }}>
                                              {bubble.avatar}
                                            </div>
                                            <div className="brutalist-text" style={{ flex: 1 }}>
                                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#060e26', marginRight: '0.3rem' }}>{bubble.name}:</span>
                                              <span style={{ fontSize: '0.74rem', color: '#060e26', lineHeight: 1.4, fontWeight: 500 }}>{bubble.text}</span>
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
                                borderRadius: '0px',
                                fontSize: '0.85rem',
                                border: '2px solid #060e26',
                                boxShadow: '3px 3px 0px #060e26',
                                marginTop: '0.75rem',
                                background: msg.guardrailData?.passed ? '#ffffff' : '#fef2f2',
                                color: '#060e26'
                              }}>
                                <Lock size={16} color="#060e26" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <div className="brutalist-subtitle" style={{ color: '#060e26', fontWeight: 800, fontSize: '0.8rem', fontFamily: "'Space Grotesk', sans-serif" }}>Non-Negotiable Spend Guardrail</div>
                                  <div className="brutalist-mono" style={{ fontSize: '0.74rem', marginTop: '0.1rem', color: '#060e26', fontWeight: 700 }}>Ceiling: &#8377;{msg.guardrailData?.ceiling?.toLocaleString()} · Item: &#8377;{msg.guardrailData?.price?.toLocaleString()}</div>
                                </div>
                                <span style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 900, background: msg.guardrailData?.passed ? '#060e26' : '#b91c1c', color: '#ffffff', fontFamily: "'Space Grotesk', sans-serif" }}>{msg.guardrailData?.passed ? 'PASSED' : 'BLOCKED'}</span>
                              </div>
                            </div>
                          )}

                          {/* ---- Revenue Growth Upsell Offer ---- */}
                          {msg.upsellOffer && msg.guardrailData?.passed && !upsellDeclined && (
                            <div style={{
                              marginTop: '0.85rem',
                              padding: '1rem 1.15rem',
                              borderRadius: '2px',
                              border: '1px solid #7c3aed40',
                              borderLeft: '4px solid #7c3aed',
                              background: 'linear-gradient(135deg, #f5f3ff 0%, #faf9f6 100%)',
                              animation: 'slide-in-up 0.3s ease-out',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Sparkles size={15} color="#7c3aed" />
                                <span className="brutalist-subtitle" style={{ color: '#7c3aed', fontSize: '0.7rem' }}>REVENUE GROWTH ENGINE — BUNDLE OFFER</span>
                                <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, color: '#7c3aed', border: '1px solid #7c3aed40', borderRadius: '2px', padding: '0.1rem 0.4rem', background: '#7c3aed15' }}>
                                  +₹{msg.upsellOffer.revenue_lift_inr.toLocaleString()} Revenue Lift
                                </span>
                              </div>

                              <p className="brutalist-text" style={{ margin: '0 0 0.65rem 0', fontSize: '0.82rem', color: '#111111', lineHeight: 1.45 }}>
                                {msg.upsellOffer.pitch || `Bundle with ${msg.upsellOffer.name} and save ${msg.upsellOffer.discount_pct}%!`}
                              </p>

                              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '2px', border: '1px solid #e4e4e7' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '2px', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Tag size={18} color="#7c3aed" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="brutalist-text" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111111' }}>{msg.upsellOffer.name}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                    {msg.upsellOffer.rating != null && <StarRating rating={msg.upsellOffer.rating} />}
                                    {msg.upsellOffer.color && <span className="brutalist-text" style={{ fontSize: '0.67rem', color: '#71717a' }}>· {msg.upsellOffer.color}</span>}
                                    {msg.upsellOffer.category && <span className="brutalist-text" style={{ fontSize: '0.67rem', color: '#71717a', textTransform: 'capitalize' }}>· {msg.upsellOffer.category}</span>}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: '0.7rem', color: '#71717a', textDecoration: 'line-through' }}>₹{msg.upsellOffer.original_price.toLocaleString()}</div>
                                  <div className="brutalist-title" style={{ fontSize: '1.1rem', color: '#7c3aed' }}>₹{msg.upsellOffer.discounted_price.toLocaleString()}</div>
                                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669' }}>-{msg.upsellOffer.discount_pct}% Bundle Discount</div>
                                </div>
                              </div>

                              <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#71717a' }}>
                                  <TrendingUp size={13} color="#059669" />
                                  <span className="brutalist-text">Bundle Total: <strong style={{ color: '#111111' }}>₹{msg.upsellOffer.bundle_total.toLocaleString()}</strong> · Within ceiling ✓</span>
                                </div>
                                <span className="minimal-pill" style={{ background: '#7c3aed15', color: '#7c3aed', border: '1px solid #7c3aed30', fontSize: '0.62rem' }}>WITHIN CEILING</span>
                              </div>

                              {/* Upsell Accept / Decline — explicit buyer opt-in required */}
                              {/* UAP-1.0: agent MUST NOT auto-charge bundle; buyer confirms here */}
                              {!msg.upsellOffer.buyer_accepted && (
                                <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.6rem' }}>
                                  <button
                                    id="upsell-accept-btn"
                                    className="minimal-btn minimal-btn-primary"
                                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.55rem 0.75rem', background: '#7c3aed', border: 'none' }}
                                    disabled={isRunning}
                                    onClick={() => {
                                      setAcceptUpsell(true);
                                      handleSend(
                                        `Yes, add the ${msg.upsellOffer!.name} bundle at ₹${msg.upsellOffer!.discounted_price} to my order.`,
                                        autonomyMode,
                                        undefined,
                                        false,
                                      );
                                    }}
                                  >
                                    ✓ Accept Bundle — Pay ₹{msg.upsellOffer.bundle_total.toLocaleString()}
                                  </button>
                                  <button
                                    id="upsell-decline-btn"
                                    className="minimal-btn"
                                    style={{ fontSize: '0.78rem', padding: '0.55rem 0.75rem', background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
                                    disabled={isRunning}
                                    onClick={() => {
                                      setUpsellDeclined(true);
                                      setAcceptUpsell(false);
                                    }}
                                  >
                                    ✕ No thanks
                                  </button>
                                </div>
                              )}
                              {msg.upsellOffer.buyer_accepted && (
                                <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                                  <span>✓ Bundle accepted — charging ₹{msg.upsellOffer.bundle_total.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ---- Delivery Address Clarification Prompt ---- */}
                          {msg.role === 'agent' && msg.content && typeof msg.content === 'string' && msg.content.includes('delivery address') && !selectedAddressId && (
                            <div style={{
                              marginTop: '0.85rem',
                              padding: '0.9rem 1rem',
                              borderRadius: '2px',
                              border: '1px solid #f59e0b40',
                              borderLeft: '4px solid #f59e0b',
                              background: '#fffbeb',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                            }}>
                              <span style={{ fontSize: '1.1rem' }}>📍</span>
                              <div style={{ flex: 1 }}>
                                <div className="brutalist-subtitle" style={{ color: '#92400e', fontSize: '0.72rem', marginBottom: '0.2rem' }}>DELIVERY ADDRESS NEEDED</div>
                                <div className="brutalist-text" style={{ fontSize: '0.8rem', color: '#78350f' }}>
                                  Add a delivery address in the left panel to see products available in your area.
                                </div>
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

          {/* Input Bar */}
          <div style={{ padding: '1.25rem 1.75rem', borderTop: '2px solid #060e26', background: '#f6f1e5' }}>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
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
                      : 'E.g. Find me running shoes under ₹4,000...'
                }
                disabled={isRunning}
                style={{ 
                  flex: 1, 
                  opacity: isRunning ? 0.6 : 1,
                  background: '#ffffff',
                  border: '3px solid #060e26',
                  boxShadow: '4px 4px 0px #060e26',
                  padding: '1.1rem 1.5rem',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#060e26',
                  borderRadius: '0px',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isRunning || !input.trim()}
                style={{ 
                  padding: '1.1rem 1.8rem', 
                  fontSize: '1.25rem', 
                  fontWeight: 900,
                  background: '#ffffff',
                  color: '#060e26',
                  border: '3px solid #060e26',
                  boxShadow: '4px 4px 0px #060e26',
                  cursor: (isRunning || !input.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isRunning || !input.trim()) ? 0.5 : 1,
                  borderRadius: '0px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '0.04em'
                }}>
                <span style={{ fontSize: '1.4rem' }}>↗</span> SEND
              </button>
            </div>
          </div>
        </div>


      </div>

      {/* Celebration Confetti Particle Explosion Canvas */}
      <ConfettiCanvas active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Interactive Digital Glass Receipt Modal */}
      <GlassReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        transactionData={receiptData || {
          txnId: sessionId,
          amount: chosenProduct?.price || 1499,
          currency: 'INR',
          customerName: cardHolder || 'VALUED BUYER',
          email: user?.email || 'buyer@example.com',
          paymentMethod: paymentMethod,
          agentReasoning: 'Glassbox Autonomous Agentic Engine evaluated velocity risk (4/100), verified tenant ceiling guardrails, and auto-cleared transaction.',
          discountApplied: 200,
          riskScore: _riskScore || 0.04
        }}
      />
    </div>
  );
}
