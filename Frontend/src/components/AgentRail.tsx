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
    <div className="agent-rail" style={{ paddingRight: '1.5rem', gap: '0.75rem' }}>
      <span className="agent-rail-label">Agents</span>

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
                  padding: '0.3rem 0.8rem', borderRadius: '99px',
                  border: isActive
                    ? '1px solid #032676'
                    : isCompleted
                    ? '1px solid rgba(1,73,174,0.3)'
                    : '1px solid transparent',
                  background: isActive ? '#0149ae' : isCompleted ? 'rgba(1,73,174,0.08)' : '#f5f5f5',
                  color: isActive ? '#ffffff' : isCompleted ? '#0149ae' : 'rgba(30,30,30,0.45)',
                  fontSize: '0.78rem', fontWeight: isActive || isCompleted ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 2px 12px rgba(1,73,174,0.3)' : 'none',
                  animation: isActive ? 'pulse-glow 1.8s ease-in-out infinite' : 'none',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <span className={`agent-dot ${status}`} style={{ flexShrink: 0 }} />
                {agent.name}
              </button>

              {idx < AGENTS.length - 1 && (
                <div style={{
                  flex: 1, height: '1px', margin: '0 2px',
                  background: isEdgeCompleted ? '#0149ae' : 'rgba(1,73,174,0.12)',
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
