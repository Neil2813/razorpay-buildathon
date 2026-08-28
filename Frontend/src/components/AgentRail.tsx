interface AgentRailProps {
  activeAgent: string;
  onSelectAgent?: (agentId: string) => void;
  completedAgents?: string[];
}

const AGENTS = [
  { id: 'concierge',   name: 'Concierge',    subtitle: 'Intent & Autonomy' },
  { id: 'site_trust',  name: 'Site Trust',   subtitle: 'Deterministic Gate' },
  { id: 'discovery',   name: 'Discovery',    subtitle: 'Live Multi-Source' },
  { id: 'negotiation', name: 'Negotiation',   subtitle: 'Spend Guardrail' },
  { id: 'risk',        name: 'Risk ML',       subtitle: 'XGBoost Ensemble' },
  { id: 'payment',     name: 'Payment',       subtitle: 'Razorpay Gateway' },
  { id: 'ledger',      name: 'Audit Ledger',  subtitle: 'Immutable Log' },
];

export default function AgentRail({ activeAgent: rawActiveAgent, onSelectAgent, completedAgents = [] }: AgentRailProps) {
  const activeAgent = rawActiveAgent === 'catalog' ? 'discovery' : rawActiveAgent;
  const normalizedCompleted = completedAgents.map(a => a === 'catalog' ? 'discovery' : a);

  const activeIdx = AGENTS.findIndex(a => a.id === activeAgent);
  const effectiveCompleted = normalizedCompleted.length > 0
    ? normalizedCompleted
    : AGENTS.slice(0, activeIdx > -1 ? activeIdx : 0).map(a => a.id);

  const getStatus = (id: string): 'idle' | 'active' | 'completed' | 'blocked' => {
    if (id === activeAgent) return 'active';
    if (effectiveCompleted.includes(id)) return 'completed';
    return 'idle';
  };

  return (
    <div style={{ padding: '0 1.5rem', height: '56px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', borderBottom: '1px solid #e4e4e7' }}>
      <span className="brutalist-subtitle" style={{ fontSize: '0.68rem', color: '#71717a' }}>Agents</span>

      <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'visible' }}>
        {AGENTS.map((agent, idx) => {
          const status = getStatus(agent.id);
          const isActive = status === 'active';
          const isCompleted = status === 'completed';
          const isEdgeCompleted = idx <= activeIdx - 1;

          return (
            <div key={agent.id} style={{ display: 'flex', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
              <button
                onClick={() => onSelectAgent?.(agent.id)}
                title={`${agent.name} — ${agent.subtitle}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.75rem', borderRadius: '2px',
                  border: isActive
                    ? '1px solid #0044ff'
                    : isCompleted
                    ? '1px solid #e4e4e7'
                    : '1px solid #e4e4e7',
                  background: isActive ? '#0044ff' : isCompleted ? '#faf9f6' : '#ffffff',
                  color: isActive ? '#ffffff' : isCompleted ? '#0044ff' : '#71717a',
                  fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  fontFamily: 'Space Grotesk'
                }}
              >
                <span className={`agent-dot ${status}`} style={{ flexShrink: 0, borderRadius: '2px', background: isActive ? '#ffffff' : isCompleted ? '#0044ff' : '#d4d4d8' }} />
                {agent.name}
              </button>

              {idx < AGENTS.length - 1 && (
                <div style={{
                  flex: 1, height: '1px', margin: '0 4px',
                  background: isEdgeCompleted ? '#0044ff' : '#e4e4e7',
                  minWidth: '6px', maxWidth: '32px', transition: 'background 0.4s',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
