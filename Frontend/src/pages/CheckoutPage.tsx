import { useState } from 'react';
import AgentRail from '../components/AgentRail';

export default function CheckoutPage() {
  const [activeAgent, setActiveAgent] = useState('concierge');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    
    // Simulate backend connection flow
    setActiveAgent('concierge');
    
    // Mock simulation for now
    setTimeout(() => setActiveAgent('catalog'), 1000);
    setTimeout(() => setActiveAgent('negotiation'), 2000);
    setTimeout(() => setActiveAgent('risk'), 3000);
    setTimeout(() => setActiveAgent('payment'), 4000);
    setTimeout(() => {
      setActiveAgent('ledger');
      setMessages(prev => [...prev, { 
        role: 'agent', 
        content: 'Transaction simulated successfully. Backend integration pending.' 
      }]);
    }, 5000);
  };

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--color-bg-gray)' }}>
      <AgentRail activeAgent={activeAgent} />
      
      <div className="container" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', paddingTop: '2rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Agentic Checkout</h2>
        
        <div className="glass-box" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', marginBottom: '2rem' }}>
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', borderBottom: '1px solid var(--color-bg-gray)' }}>
            {messages.length === 0 ? (
              <p style={{ textAlign: 'center', opacity: 0.5 }}>Tell the concierge what you want to buy...</p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} style={{ 
                  marginBottom: '1rem', 
                  textAlign: msg.role === 'user' ? 'right' : 'left' 
                }}>
                  <div style={{ 
                    display: 'inline-block',
                    padding: '0.8rem 1.2rem',
                    borderRadius: '8px',
                    backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-white)',
                    color: msg.role === 'user' ? 'var(--color-bg-white)' : 'inherit',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="E.g. Find me running shoes under Rs. 4000..."
              style={{
                flexGrow: 1,
                padding: '1rem',
                border: '1px solid var(--color-bg-gray)',
                borderRadius: '4px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            />
            <button className="btn-primary" onClick={handleSend}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
