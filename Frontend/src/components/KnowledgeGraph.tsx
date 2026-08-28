import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';

export interface AuditEvent {
  event_id?: string;
  timestamp?: string;
  agent: string;
  decision_reason: string;
  inputs_summary?: Record<string, any>;
  output_summary?: Record<string, any>;
}

export interface KnowledgeGraphProps {
  activeAgent: string;
  auditLog: AuditEvent[];
  paymentStatus?: string;
  escalationMessage?: string | null;
  guardrailCeiling?: number;
  chosenProduct?: Record<string, any> | null;
  riskScore?: number | null;
  riskFeatures?: Record<string, any> | null;
}

// All nodes use the approved palette only
// Active → #0149ae, Completed → #1250b2, Blocked → #032676, Idle → #f5f5f5
const AGENT_NODES = [
  { id: 'concierge',   label: 'Concierge',      subtitle: 'Intent & Autonomy' },
  { id: 'site_trust',  label: 'Site Trust',     subtitle: 'Deterministic Gate' },
  { id: 'discovery',   label: 'Discovery',      subtitle: 'Live Multi-Source' },
  { id: 'negotiation', label: 'Negotiation',      subtitle: 'Spend Guardrails' },
  { id: 'risk',        label: 'Risk Agent',       subtitle: 'ML Hybrid Ensemble' },
  { id: 'payment',     label: 'Payment',          subtitle: 'Razorpay Gateway' },
  { id: 'ledger',      label: 'Audit & Ledger',   subtitle: 'Immutable Event Log' },
];

type NodeStatus = 'active' | 'completed' | 'blocked' | 'failed' | 'bypassed' | 'idle';

function getNodeStyle(status: NodeStatus) {
  switch (status) {
    case 'active':
      return { bg: '#ffffff', border: '#0044ff', text: '#0044ff', badgeBg: 'rgba(0, 68, 255, 0.08)', badgeText: '#0044ff', badgeLabel: 'Live' };
    case 'completed':
      return { bg: '#ffffff', border: '#0044ff', text: '#0044ff', badgeBg: 'rgba(0, 68, 255, 0.08)', badgeText: '#0044ff', badgeLabel: 'Done' };
    case 'blocked':
      return { bg: '#ffffff', border: '#ef4444', text: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.08)', badgeText: '#ef4444', badgeLabel: 'Blocked' };
    case 'failed':
      return { bg: '#ffffff', border: '#ef4444', text: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.08)', badgeText: '#ef4444', badgeLabel: 'Escalated' };
    case 'bypassed':
      return { bg: '#f4f4f5', border: '#e4e4e7', text: '#a1a1aa', badgeBg: '#f4f4f5', badgeText: '#a1a1aa', badgeLabel: 'Bypassed' };
    default:
      return { bg: '#ffffff', border: '#e4e4e7', text: '#71717a', badgeBg: '#f4f4f5', badgeText: '#71717a', badgeLabel: 'Pending' };
  }
}

export default function KnowledgeGraph({
  activeAgent: rawActiveAgent, auditLog, paymentStatus, escalationMessage,
  guardrailCeiling, chosenProduct, riskScore, riskFeatures,
}: KnowledgeGraphProps) {
  const activeAgent = rawActiveAgent === 'catalog' ? 'discovery' : rawActiveAgent;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const eventsByAgent: Record<string, AuditEvent[]> = {};
  auditLog.forEach(evt => {
    const key = evt.agent === 'catalog' ? 'discovery' : evt.agent;
    if (!eventsByAgent[key]) eventsByAgent[key] = [];
    eventsByAgent[key].push(evt);
  });

  const getAgentStatus = (agentId: string): NodeStatus => {
    const events = eventsByAgent[agentId] || [];
    if (agentId === activeAgent) return 'active';
    if (!events.length) return 'idle';
    if (agentId === 'site_trust' && events.find(e => e.output_summary?.status === 'blocked' || e.output_summary?.status === 'suspicious')) {
      if (events.find(e => e.output_summary?.trust_override)) return 'completed';
      return 'blocked';
    }
    if (agentId === 'negotiation' && events.find(e => e.output_summary?.guardrail_passed === false)) return 'blocked';
    if (agentId === 'payment' && paymentStatus === 'escalated') return 'failed';
    return 'completed';
  };

  const activeIdx = AGENT_NODES.findIndex(n => n.id === activeAgent);
  const selectedNode = selectedIdx !== null ? AGENT_NODES[selectedIdx] : null;
  const selectedEvents = selectedNode ? (eventsByAgent[selectedNode.id] || []) : [];

  return (
    <div className="minimal-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 className="brutalist-title" style={{ margin: 0, fontSize: '1.1rem', color: '#111111' }}>
          Transaction Knowledge Graph
        </h3>
        <p className="brutalist-text" style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#71717a' }}>
          Click any node to inspect real-time prompts, site trust checks, ML scores, guardrails and raw state events.
        </p>
      </div>

      {/* Escalation Banner */}
      {escalationMessage && (
        <div className="brutalist-text" style={{
          marginBottom: '1rem', padding: '0.75rem 1rem',
          background: '#fee2e2', borderRadius: '2px',
          border: '1px solid #fecaca', color: '#ef4444',
          fontSize: '0.84rem', lineHeight: '1.45',
        }}>
          <strong>Escalation Notice: </strong>{escalationMessage}
        </div>
      )}

      {/* Node Flow */}
      <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {AGENT_NODES.map((node, index) => {
          const status = getAgentStatus(node.id);
          const s = getNodeStyle(status);
          const isActive = status === 'active';
          const isBypassed = status === 'bypassed';
          const isEdgeCompleted = index <= activeIdx - 1;
          const events = eventsByAgent[node.id] || [];

          return (
            <div key={node.id} style={{ display: 'flex', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
              <div
                onClick={() => setSelectedIdx(index)}
                style={{
                  flex: 'none', width: '128px',
                  background: s.bg, border: `1.5px solid ${s.border}`,
                  borderRadius: '2px', padding: '0.85rem',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  opacity: isBypassed ? 0.4 : 1,
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span className="brutalist-subtitle" style={{ fontSize: '0.68rem', color: s.text }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="minimal-pill" style={{ fontSize: '0.62rem', background: s.badgeBg, color: s.badgeText, border: `1px solid ${s.border}22` }}>
                    {s.badgeLabel}
                  </span>
                </div>

                <div className="brutalist-title" style={{ fontSize: '0.9rem', color: '#111111', lineHeight: 1.15 }}>
                  {node.label}
                </div>
                <div className="brutalist-text" style={{ fontSize: '0.67rem', color: '#71717a', marginTop: '0.2rem' }}>
                  {node.subtitle}
                </div>

                {/* Summary metric */}
                <div className="brutalist-text" style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: `1px solid #e4e4e7`, fontSize: '0.7rem', color: '#71717a' }}>
                  {node.id === 'concierge' && events[0]?.output_summary && (
                    <span>Mode: <strong style={{ color: '#111111', textTransform: 'capitalize' }}>{events[0].output_summary.autonomy_mode || 'Guided'}</strong></span>
                  )}
                  {node.id === 'site_trust' && events[0]?.output_summary && (
                    <span>Trust: <strong style={{ color: '#111111', textTransform: 'capitalize' }}>{events[0].output_summary.status || 'Verified'}</strong></span>
                  )}
                  {node.id === 'discovery' && events[0]?.output_summary && (
                    <span>Found: <strong style={{ color: '#111111' }}>{events[0].output_summary.candidate_count || events[0].output_summary.candidates?.length || '0'}</strong></span>
                  )}
                  {node.id === 'negotiation' && guardrailCeiling && (
                    <span>Ceiling: <strong style={{ color: '#111111' }}>&#8377;{guardrailCeiling.toLocaleString()}</strong></span>
                  )}
                  {node.id === 'risk' && riskScore !== null && riskScore !== undefined && (
                    <span>Score: <strong style={{ color: '#111111' }}>{(riskScore * 100).toFixed(1)}%</strong></span>
                  )}
                  {node.id === 'payment' && paymentStatus && (
                    <span style={{ textTransform: 'capitalize' }}>Status: <strong style={{ color: '#111111' }}>{paymentStatus}</strong></span>
                  )}
                  {node.id === 'ledger' && (
                    <span>Events: <strong style={{ color: '#111111' }}>{auditLog.length}</strong></span>
                  )}
                  {!events.length && !['risk','payment','ledger'].includes(node.id) && node.id !== 'negotiation' && (
                    <span style={{ color: '#d4d4d8' }}>Awaiting…</span>
                  )}
                </div>
              </div>

              {/* Edge arrow */}
              {index < AGENT_NODES.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: '12px', maxWidth: '36px', padding: '0 2px' }}>
                  <div style={{ width: '100%', height: '1px', background: isEdgeCompleted ? '#0044ff' : '#e4e4e7', transition: 'background 0.4s' }} />
                  <ChevronRight size={12} style={{ color: isEdgeCompleted ? '#0044ff' : '#d4d4d8', flexShrink: 0, transition: 'color 0.4s' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inspector Drawer */}
      {selectedNode && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(17, 17, 17, 0.4)', display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', zIndex: 2000 }}
          onClick={() => setSelectedIdx(null)}
        >
          <div
            style={{ background: '#ffffff', width: '100%', maxWidth: '500px', height: '100%', overflowY: 'auto', padding: '1.75rem', borderLeft: '4px solid #0044ff', animation: 'slide-in-up 0.25s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.25rem', fontSize: '0.68rem' }}>
                  Node Inspector
                </div>
                <h3 className="brutalist-title" style={{ margin: 0, fontSize: '1.3rem', color: '#111111' }}>{selectedNode.label}</h3>
                <div className="brutalist-text" style={{ fontSize: '0.8rem', color: '#71717a', marginTop: '0.2rem' }}>{selectedNode.subtitle}</div>
              </div>
              <button onClick={() => setSelectedIdx(null)} style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: '2px', padding: '0.4rem', cursor: 'pointer', lineHeight: 0 }}>
                <X size={16} color="#111111" />
              </button>
            </div>

            {/* Specialised panels */}
            {selectedNode.id === 'site_trust' && selectedEvents.length > 0 && selectedEvents[0]?.output_summary && (
              <div style={{ padding: '0.85rem 1rem', background: '#faf9f6', borderRadius: '2px', border: '1px solid #e4e4e7', borderLeft: '4px solid #ef4444', marginBottom: '1.25rem' }}>
                <div className="brutalist-subtitle" style={{ color: '#ef4444', marginBottom: '0.4rem', fontSize: '0.68rem' }}>Site Trust Checks (Deterministic Gate)</div>
                <div className="brutalist-text" style={{ fontSize: '0.85rem', color: '#111111', fontWeight: 600 }}>Target: {selectedEvents[0].output_summary.site || selectedEvents[0].inputs_summary?.site || 'Candidate Domains'}</div>
                <div className="brutalist-subtitle" style={{ fontSize: '0.8rem', marginTop: '0.35rem', color: selectedEvents[0].output_summary.status === 'trusted' ? '#0044ff' : '#ef4444' }}>
                  Status: {selectedEvents[0].output_summary.status?.toUpperCase() || 'CHECKED'}
                </div>
                {selectedEvents[0].output_summary.reason && (
                  <div className="brutalist-text" style={{ fontSize: '0.78rem', color: '#71717a', marginTop: '0.25rem' }}>
                    Reason: {selectedEvents[0].output_summary.reason}
                  </div>
                )}
                {selectedEvents[0].output_summary.user_overrode_trust_warning && (
                  <div className="minimal-pill minimal-pill-danger" style={{ marginTop: '0.4rem' }}>
                    TRUST OVERRIDDEN BY USER
                  </div>
                )}
              </div>
            )}

            {/* Specialised panels */}
            {selectedNode.id === 'negotiation' && chosenProduct && (
              <div style={{ padding: '0.85rem 1rem', background: '#faf9f6', borderRadius: '2px', border: '1px solid #e4e4e7', borderLeft: '4px solid #0044ff', marginBottom: '1.25rem' }}>
                <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.4rem', fontSize: '0.68rem' }}>Chosen Product</div>
                <div className="brutalist-text" style={{ fontSize: '0.9rem', color: '#111111', fontWeight: 600 }}>{chosenProduct.name || chosenProduct.product_id}</div>
                {chosenProduct.price && (
                  <div className="brutalist-text" style={{ fontSize: '0.85rem', color: '#111111', marginTop: '0.2rem' }}>
                    Price: <strong>&#8377;{chosenProduct.price.toLocaleString()}</strong>
                    {guardrailCeiling && (
                      <span style={{ marginLeft: '0.5rem', color: chosenProduct.price <= guardrailCeiling ? '#0044ff' : '#ef4444', fontWeight: 600 }}>
                        {chosenProduct.price <= guardrailCeiling ? '— Within ceiling' : '— Exceeds ceiling'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedNode.id === 'risk' && riskFeatures && (
              <div style={{ padding: '0.85rem 1rem', background: '#faf9f6', borderRadius: '2px', border: '1px solid #e4e4e7', borderLeft: '4px solid #f97316', marginBottom: '1.25rem' }}>
                <div className="brutalist-subtitle" style={{ color: '#f97316', marginBottom: '0.4rem', fontSize: '0.68rem' }}>Risk Model</div>
                <div className="brutalist-text" style={{ fontSize: '0.85rem', color: '#111111', fontWeight: 600 }}>{riskFeatures.model || 'XGBoost+LightGBM Hybrid'}</div>
                {riskScore !== null && riskScore !== undefined && (
                  <div className="brutalist-text" style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#111111' }}>
                    Score: <strong>{(riskScore * 100).toFixed(2)}%</strong> / Threshold: <strong>{((riskFeatures.threshold || 0.8) * 100).toFixed(0)}%</strong>
                  </div>
                )}
              </div>
            )}

            {selectedNode.id === 'payment' && paymentStatus && (
              <div style={{ padding: '0.85rem 1rem', background: '#faf9f6', borderRadius: '2px', border: `1px solid #e4e4e7`, borderLeft: `4px solid ${paymentStatus === 'success' ? '#10b981' : '#ef4444'}`, marginBottom: '1.25rem' }}>
                <div className="brutalist-subtitle" style={{ color: paymentStatus === 'success' ? '#10b981' : '#ef4444', marginBottom: '0.4rem', fontSize: '0.68rem' }}>Gateway Status</div>
                <div className="brutalist-title" style={{ fontSize: '1.1rem', color: '#111111', textTransform: 'capitalize' }}>
                  {paymentStatus === 'escalated' ? 'Escalated — Retry limit reached' : paymentStatus === 'success' ? 'Payment Successful' : paymentStatus}
                </div>
                {escalationMessage && <div className="brutalist-text" style={{ fontSize: '0.82rem', color: '#ef4444', marginTop: '0.4rem' }}>{escalationMessage}</div>}
              </div>
            )}

            {/* Audit events */}
            <div className="brutalist-subtitle" style={{ fontSize: '0.68rem', color: '#71717a', marginBottom: '0.75rem' }}>
              Audit Trail ({selectedEvents.length} events)
            </div>

            {selectedEvents.length === 0 ? (
              <div className="brutalist-text" style={{ padding: '2rem', textAlign: 'center', color: '#71717a', background: '#faf9f6', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No events recorded yet for this agent.</p>
              </div>
            ) : (
              selectedEvents.map((evt, i) => (
                <div key={i} style={{ marginBottom: '1rem', padding: '1rem', background: '#ffffff', borderRadius: '2px', border: '1px solid #e4e4e7', borderLeft: '3px solid #0044ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.68rem', color: '#71717a' }}>
                    <span className="brutalist-mono">Event <strong>{evt.event_id?.substring(0, 8) || `#${i + 1}`}</strong></span>
                    <span className="brutalist-mono">{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Live'}</span>
                  </div>
                  <div className="brutalist-text" style={{ fontSize: '0.875rem', color: '#111111', fontWeight: 600, lineHeight: 1.5, marginBottom: '0.75rem' }}>
                    {evt.decision_reason}
                  </div>
                  {evt.inputs_summary && Object.keys(evt.inputs_summary).length > 0 && (
                    <details style={{ marginBottom: '0.5rem' }}>
                      <summary className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#71717a', cursor: 'pointer', marginBottom: '0.35rem' }}>Inputs Summary</summary>
                      <pre className="brutalist-mono" style={{ margin: 0, background: '#faf9f6', padding: '0.5rem 0.7rem', border: '1px solid #e4e4e7', borderRadius: '2px', overflowX: 'auto', color: '#111111' }}>
                        {JSON.stringify(evt.inputs_summary, null, 2)}
                      </pre>
                    </details>
                  )}
                  {evt.output_summary && Object.keys(evt.output_summary).length > 0 && (
                    <details>
                      <summary className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#71717a', cursor: 'pointer', marginBottom: '0.35rem' }}>Output Summary</summary>
                      <pre className="brutalist-mono" style={{ margin: 0, background: '#faf9f6', padding: '0.5rem 0.7rem', border: '1px solid #e4e4e7', borderRadius: '2px', overflowX: 'auto', color: '#111111' }}>
                        {JSON.stringify(evt.output_summary, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
