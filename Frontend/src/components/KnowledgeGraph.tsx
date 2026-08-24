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
      return { bg: 'rgba(1,73,174,0.07)', border: '#0149ae', text: '#0149ae', badgeBg: 'rgba(1,73,174,0.12)', badgeText: '#0149ae', badgeLabel: 'Live' };
    case 'completed':
      return { bg: 'rgba(18,80,178,0.06)', border: '#1250b2', text: '#1250b2', badgeBg: 'rgba(18,80,178,0.1)', badgeText: '#1250b2', badgeLabel: 'Done' };
    case 'blocked':
      return { bg: 'rgba(3,38,118,0.06)', border: '#032676', text: '#032676', badgeBg: 'rgba(3,38,118,0.1)', badgeText: '#032676', badgeLabel: 'Blocked' };
    case 'failed':
      return { bg: 'rgba(3,38,118,0.06)', border: '#032676', text: '#032676', badgeBg: 'rgba(3,38,118,0.1)', badgeText: '#032676', badgeLabel: 'Escalated' };
    case 'bypassed':
      return { bg: '#f5f5f5', border: 'rgba(30,30,30,0.15)', text: 'rgba(30,30,30,0.35)', badgeBg: '#f5f5f5', badgeText: 'rgba(30,30,30,0.35)', badgeLabel: 'Bypassed' };
    default:
      return { bg: '#f5f5f5', border: 'rgba(1,73,174,0.12)', text: 'rgba(30,30,30,0.4)', badgeBg: '#f5f5f5', badgeText: 'rgba(30,30,30,0.4)', badgeLabel: 'Pending' };
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
    <div style={{
      background: '#ffffff', borderRadius: '12px',
      border: '1px solid rgba(1,73,174,0.12)',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 2px 12px rgba(3,38,118,0.04)',
      marginBottom: '1.25rem',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#032676' }}>
          Transaction Knowledge Graph
        </h3>
        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'rgba(30,30,30,0.45)' }}>
          Click any node to inspect real-time prompts, site trust checks, ML scores, guardrails and raw state events.
        </p>
      </div>

      {/* Escalation Banner */}
      {escalationMessage && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem 1rem',
          background: 'rgba(3,38,118,0.06)', borderRadius: '8px',
          border: '1px solid rgba(3,38,118,0.2)', color: '#032676',
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
                  background: s.bg, border: `2px solid ${s.border}`,
                  borderRadius: '10px', padding: '0.85rem',
                  cursor: 'pointer', transition: 'all 0.25s ease',
                  opacity: isBypassed ? 0.4 : 1,
                  transform: isActive ? 'scale(1.035)' : 'scale(1)',
                  boxShadow: isActive ? `0 0 0 3px rgba(1,73,174,0.18), 0 4px 16px rgba(1,73,174,0.14)` : '0 1px 4px rgba(3,38,118,0.04)',
                  animation: isActive ? 'pulse-glow 2s ease-in-out infinite' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: s.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.63rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '99px', background: s.badgeBg, color: s.badgeText }}>
                    {s.badgeLabel}
                  </span>
                </div>

                <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem', fontWeight: 700, color: '#1e1e1e', lineHeight: 1.15 }}>
                  {node.label}
                </div>
                <div style={{ fontSize: '0.67rem', color: 'rgba(30,30,30,0.45)', marginTop: '0.2rem' }}>
                  {node.subtitle}
                </div>

                {/* Summary metric */}
                <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: `1px solid ${s.border}44`, fontSize: '0.7rem', color: 'rgba(30,30,30,0.5)' }}>
                  {node.id === 'concierge' && events[0]?.output_summary && (
                    <span>Mode: <strong style={{ color: '#1e1e1e', textTransform: 'capitalize' }}>{events[0].output_summary.autonomy_mode || 'Guided'}</strong></span>
                  )}
                  {node.id === 'site_trust' && events[0]?.output_summary && (
                    <span>Trust: <strong style={{ color: '#1e1e1e', textTransform: 'capitalize' }}>{events[0].output_summary.status || 'Verified'}</strong></span>
                  )}
                  {node.id === 'discovery' && events[0]?.output_summary && (
                    <span>Found: <strong style={{ color: '#1e1e1e' }}>{events[0].output_summary.candidate_count || events[0].output_summary.candidates?.length || '0'}</strong></span>
                  )}
                  {node.id === 'negotiation' && guardrailCeiling && (
                    <span>Ceiling: <strong style={{ color: '#1e1e1e' }}>&#8377;{guardrailCeiling.toLocaleString()}</strong></span>
                  )}
                  {node.id === 'risk' && riskScore !== null && riskScore !== undefined && (
                    <span>Score: <strong style={{ color: '#1e1e1e' }}>{(riskScore * 100).toFixed(1)}%</strong></span>
                  )}
                  {node.id === 'payment' && paymentStatus && (
                    <span style={{ textTransform: 'capitalize' }}>Status: <strong style={{ color: '#1e1e1e' }}>{paymentStatus}</strong></span>
                  )}
                  {node.id === 'ledger' && (
                    <span>Events: <strong style={{ color: '#1e1e1e' }}>{auditLog.length}</strong></span>
                  )}
                  {!events.length && !['risk','payment','ledger'].includes(node.id) && node.id !== 'negotiation' && (
                    <span style={{ color: 'rgba(30,30,30,0.25)' }}>Awaiting…</span>
                  )}
                </div>
              </div>

              {/* Edge arrow */}
              {index < AGENT_NODES.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: '12px', maxWidth: '36px', padding: '0 2px' }}>
                  <div style={{ width: '100%', height: '2px', background: isEdgeCompleted ? '#0149ae' : 'rgba(1,73,174,0.12)', borderRadius: '1px', transition: 'background 0.4s' }} />
                  <ChevronRight size={12} style={{ color: isEdgeCompleted ? '#0149ae' : 'rgba(1,73,174,0.25)', flexShrink: 0, transition: 'color 0.4s' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inspector Drawer */}
      {selectedNode && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,38,118,0.35)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', zIndex: 2000 }}
          onClick={() => setSelectedIdx(null)}
        >
          <div
            style={{ background: '#ffffff', width: '100%', maxWidth: '500px', height: '100%', overflowY: 'auto', padding: '1.75rem', boxShadow: '-8px 0 40px rgba(3,38,118,0.12)', borderLeft: '4px solid #0149ae', animation: 'slide-in-up 0.25s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#0149ae', marginBottom: '0.25rem' }}>
                  Node Inspector
                </div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#032676' }}>{selectedNode.label}</h3>
                <div style={{ fontSize: '0.8rem', color: 'rgba(30,30,30,0.45)', marginTop: '0.2rem' }}>{selectedNode.subtitle}</div>
              </div>
              <button onClick={() => setSelectedIdx(null)} style={{ background: 'none', border: '1px solid rgba(1,73,174,0.2)', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', lineHeight: 0 }}>
                <X size={16} color="#1e1e1e" />
              </button>
            </div>

            {/* Specialised panels */}
            {selectedNode.id === 'site_trust' && selectedEvents.length > 0 && selectedEvents[0]?.output_summary && (
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(3,38,118,0.05)', borderRadius: '8px', border: '1px solid rgba(3,38,118,0.18)', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#032676', marginBottom: '0.4rem' }}>Site Trust Checks (Deterministic Gate)</div>
                <div style={{ fontSize: '0.85rem', color: '#1e1e1e', fontWeight: 600 }}>Target: {selectedEvents[0].output_summary.site || selectedEvents[0].inputs_summary?.site || 'Candidate Domains'}</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', color: selectedEvents[0].output_summary.status === 'trusted' ? '#0149ae' : '#032676', fontWeight: 700 }}>
                  Status: {selectedEvents[0].output_summary.status?.toUpperCase() || 'CHECKED'}
                </div>
                {selectedEvents[0].output_summary.reason && (
                  <div style={{ fontSize: '0.78rem', color: 'rgba(30,30,30,0.7)', marginTop: '0.25rem' }}>
                    Reason: {selectedEvents[0].output_summary.reason}
                  </div>
                )}
                {selectedEvents[0].output_summary.user_overrode_trust_warning && (
                  <div style={{ marginTop: '0.4rem', display: 'inline-block', fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(3,38,118,0.15)', color: '#032676' }}>
                    TRUST OVERRIDDEN BY USER
                  </div>
                )}
              </div>
            )}

            {/* Specialised panels */}
            {selectedNode.id === 'negotiation' && chosenProduct && (
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(1,73,174,0.05)', borderRadius: '8px', border: '1px solid rgba(1,73,174,0.18)', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#0149ae', marginBottom: '0.4rem' }}>Chosen Product</div>
                <div style={{ fontSize: '0.9rem', color: '#032676', fontWeight: 600 }}>{chosenProduct.name || chosenProduct.product_id}</div>
                {chosenProduct.price && (
                  <div style={{ fontSize: '0.85rem', color: '#1e1e1e', marginTop: '0.2rem' }}>
                    Price: <strong>&#8377;{chosenProduct.price.toLocaleString()}</strong>
                    {guardrailCeiling && (
                      <span style={{ marginLeft: '0.5rem', color: chosenProduct.price <= guardrailCeiling ? '#0149ae' : '#032676', fontWeight: 600 }}>
                        {chosenProduct.price <= guardrailCeiling ? '— Within ceiling' : '— Exceeds ceiling'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedNode.id === 'risk' && riskFeatures && (
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(3,38,118,0.05)', borderRadius: '8px', border: '1px solid rgba(3,38,118,0.18)', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#032676', marginBottom: '0.4rem' }}>Risk Model</div>
                <div style={{ fontSize: '0.85rem', color: '#1e1e1e', fontWeight: 600 }}>{riskFeatures.model || 'XGBoost+LightGBM Hybrid'}</div>
                {riskScore !== null && riskScore !== undefined && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#032676' }}>
                    Score: <strong>{(riskScore * 100).toFixed(2)}%</strong> / Threshold: <strong>{((riskFeatures.threshold || 0.8) * 100).toFixed(0)}%</strong>
                  </div>
                )}
              </div>
            )}

            {selectedNode.id === 'payment' && paymentStatus && (
              <div style={{ padding: '0.85rem 1rem', background: paymentStatus === 'success' ? 'rgba(1,73,174,0.06)' : 'rgba(3,38,118,0.06)', borderRadius: '8px', border: `1px solid ${paymentStatus === 'success' ? 'rgba(1,73,174,0.2)' : 'rgba(3,38,118,0.2)'}`, marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: paymentStatus === 'success' ? '#0149ae' : '#032676', marginBottom: '0.4rem' }}>Gateway Status</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: paymentStatus === 'success' ? '#0149ae' : '#032676', textTransform: 'capitalize' }}>
                  {paymentStatus === 'escalated' ? 'Escalated — Retry limit reached' : paymentStatus === 'success' ? 'Payment Successful' : paymentStatus}
                </div>
                {escalationMessage && <div style={{ fontSize: '0.82rem', color: '#032676', marginTop: '0.4rem' }}>{escalationMessage}</div>}
              </div>
            )}

            {/* Audit events */}
            <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(30,30,30,0.4)', marginBottom: '0.75rem' }}>
              Audit Trail ({selectedEvents.length} events)
            </div>

            {selectedEvents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(30,30,30,0.4)', background: '#f5f5f5', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No events recorded yet for this agent.</p>
              </div>
            ) : (
              selectedEvents.map((evt, i) => (
                <div key={i} style={{ marginBottom: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px', border: '1px solid rgba(1,73,174,0.08)', borderLeft: '3px solid #0149ae', animation: 'fade-in 0.3s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.68rem', color: 'rgba(30,30,30,0.4)' }}>
                    <span>Event <strong style={{ fontFamily: 'monospace', color: '#1e1e1e' }}>{evt.event_id?.substring(0, 8) || `#${i + 1}`}</strong></span>
                    <span>{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Live'}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#1e1e1e', fontWeight: 500, lineHeight: 1.5, marginBottom: '0.75rem' }}>
                    {evt.decision_reason}
                  </div>
                  {evt.inputs_summary && Object.keys(evt.inputs_summary).length > 0 && (
                    <details style={{ marginBottom: '0.5rem' }}>
                      <summary style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(30,30,30,0.5)', cursor: 'pointer', marginBottom: '0.35rem' }}>Inputs Summary</summary>
                      <pre style={{ margin: 0, fontSize: '0.7rem', background: '#ffffff', padding: '0.5rem 0.7rem', borderRadius: '4px', border: '1px solid rgba(1,73,174,0.1)', overflowX: 'auto', color: '#1e1e1e' }}>
                        {JSON.stringify(evt.inputs_summary, null, 2)}
                      </pre>
                    </details>
                  )}
                  {evt.output_summary && Object.keys(evt.output_summary).length > 0 && (
                    <details>
                      <summary style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(30,30,30,0.5)', cursor: 'pointer', marginBottom: '0.35rem' }}>Output Summary</summary>
                      <pre style={{ margin: 0, fontSize: '0.7rem', background: '#ffffff', padding: '0.5rem 0.7rem', borderRadius: '4px', border: '1px solid rgba(1,73,174,0.1)', overflowX: 'auto', color: '#1e1e1e' }}>
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
