import React, { useState } from 'react';
import { soundFX } from '../lib/soundFX';
import { Bot, Sparkles, X, ChevronRight, RefreshCw, Send, ShieldAlert, Cpu } from 'lucide-react';

interface AgentMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  bullets?: string[];
}

export default function InteractiveAgentWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: '1',
      sender: 'agent',
      text: 'Hello! I am GLASSBOX Agent Core. I monitor transaction risk, execute policy guardrails, and auto-route commerce flows.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      bullets: [
        'Ask me about current risk posture',
        'Simulate dynamic coupon matching',
        'Check policy guardrail overrides'
      ]
    }
  ]);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputMsg;
    if (!query.trim()) return;

    soundFX.playClick();
    const userMsg: AgentMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMsg('');
    setIsEvaluating(true);

    setTimeout(() => {
      soundFX.playSuccess();
      let responseText = '';
      let bullets: string[] = [];

      const lower = query.toLowerCase();
      if (lower.includes('risk') || lower.includes('posture')) {
        responseText = 'Current Glassbox system posture is OPTIMAL. Real-time risk index is evaluated at 0.12 (Low Risk).';
        bullets = ['Velocity Check: Passed (1 txn/min)', 'Fraud Score: 4/100', 'Step-Up 3DS: Not required'];
      } else if (lower.includes('coupon') || lower.includes('discount') || lower.includes('vip')) {
        responseText = 'Agent matched VIP Loyalty Rule #42. A 20% instant discount ($199 savings) was recommended for cart #902.';
        bullets = ['Merchant Margin Check: Cleared', 'Promo Budget: Valid', 'Agent Action: Auto-applied'];
      } else if (lower.includes('guardrail') || lower.includes('policy')) {
        responseText = 'Strict Merchant Guardrail #12 is ACTIVE: Transactions above $5,000 require mandatory biometric 3DS + split payout clearance.';
        bullets = ['Hard Lock: Active', 'Explainability Log: Generated', 'Auditor Signature: Verified'];
      } else {
        responseText = `Agent analyzed prompt: "${query}". All safety guardrails evaluated clean. System ready for transaction dispatch.`;
        bullets = ['Latency: 18ms', 'Model: Gemini 3.6 Flash / Groq Llama 3.3', 'State: Active'];
      }

      const agentReply: AgentMessage = {
        id: Math.random().toString(),
        sender: 'agent',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bullets
      };

      setMessages((prev) => [...prev, agentReply]);
      setIsEvaluating(false);
    }, 700);
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9980 }}>
      {/* Drawer */}
      {isOpen ? (
        <div
          style={{
            width: '360px',
            height: '480px',
            background: '#ffffff',
            border: '2px solid #111111',
            borderRadius: '4px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slide-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1rem',
              background: '#0044ff',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '2px',
                  background: '#ffffff',
                  color: '#0044ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}
              >
                <Bot size={16} />
              </div>
              <div>
                <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '1rem', letterSpacing: '0.04em' }}>
                  GLASSBOX AI ASSISTANT
                </div>
                <div style={{ fontSize: '0.68rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="agent-dot active" style={{ width: '6px', height: '6px', background: '#10b981' }}></span>
                  Real-time Explainability Agent
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundFX.playClick();
                setIsOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '2px'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Preset Prompt Chips */}
          <div
            style={{
              padding: '0.5rem 0.85rem',
              background: '#faf9f6',
              borderBottom: '1px solid #e4e4e7',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto'
            }}
          >
            {[
              'Current Risk Status',
              'Explain VIP Offer',
              'Check Guardrails'
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '2px',
                  background: '#ffffff',
                  border: '1px solid #d4d4d8',
                  color: '#111111',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div style={{ flex: 1, padding: '0.85rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                <div
                  style={{
                    background: m.sender === 'user' ? '#111111' : '#f4f4f5',
                    color: m.sender === 'user' ? '#ffffff' : '#111111',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    lineHeight: 1.4,
                    border: m.sender === 'agent' ? '1px solid #e4e4e7' : 'none'
                  }}
                >
                  {m.text}
                  {m.bullets && m.bullets.length > 0 && (
                    <div style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.4rem' }}>
                      {m.bullets.map((b, idx) => (
                        <div key={idx} style={{ fontSize: '0.72rem', color: '#52525b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ChevronRight size={10} style={{ color: '#0044ff' }} />
                          {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#a1a1aa', marginTop: '2px', textAlign: m.sender === 'user' ? 'right' : 'left' }}>
                  {m.timestamp}
                </div>
              </div>
            ))}

            {isEvaluating && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#0044ff' }}>
                <RefreshCw size={12} className="animate-spin" />
                <span>Agent evaluating neural risk graph...</span>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div
            style={{
              padding: '0.65rem',
              borderTop: '1px solid #e4e4e7',
              background: '#ffffff',
              display: 'flex',
              gap: '6px'
            }}
          >
            <input
              type="text"
              placeholder="Ask Glassbox Agent..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                border: '1px solid #d4d4d8',
                borderRadius: '2px',
                outline: 'none',
                fontFamily: "'Space Grotesk', sans-serif"
              }}
            />
            <button
              onClick={() => handleSend()}
              style={{
                background: '#0044ff',
                color: '#ffffff',
                border: 'none',
                borderRadius: '2px',
                padding: '0 0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* Floating Pill Button */
        <button
          onClick={() => {
            soundFX.playClick();
            setIsOpen(true);
          }}
          style={{
            background: '#111111',
            color: '#ffffff',
            border: '2px solid #0044ff',
            borderRadius: '99px',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,68,255,0.25)',
            transition: 'all 0.2s ease',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '0.78rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,68,255,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,68,255,0.25)';
          }}
        >
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Sparkles size={16} style={{ color: '#0044ff' }} />
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981'
              }}
            ></span>
          </span>
          <span>AI AGENT</span>
          <span
            style={{
              background: '#0044ff',
              color: '#ffffff',
              fontSize: '0.65rem',
              padding: '1px 6px',
              borderRadius: '99px'
            }}
          >
            ACTIVE
          </span>
        </button>
      )}
    </div>
  );
}
