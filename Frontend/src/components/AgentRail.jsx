export default function AgentRail({ activeAgent }) {
  const agents = [
    { id: 'concierge', name: 'Concierge' },
    { id: 'catalog', name: 'Catalog (RAG)' },
    { id: 'negotiation', name: 'Negotiation' },
    { id: 'risk', name: 'Risk (ML)' },
    { id: 'payment', name: 'Payment' },
    { id: 'ledger', name: 'Audit/Ledger' },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem',
      backgroundColor: 'var(--color-bg-white)',
      borderBottom: '1px solid var(--color-bg-gray)'
    }}>
      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Agent Status</h3>
      <div style={{ display: 'flex', gap: '1rem' }}>
        {agents.map((agent) => {
          const isActive = activeAgent === agent.id;
          return (
            <div 
              key={agent.id}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg-gray)',
                color: isActive ? 'var(--color-bg-white)' : 'var(--color-text-dark)',
                fontSize: '0.9rem',
                transition: 'all 0.3s ease',
                opacity: isActive ? 1 : 0.6
              }}
            >
              {agent.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
