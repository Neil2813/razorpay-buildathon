import React, { useState, useEffect } from 'react';
import { soundFX } from '../lib/soundFX';
import { Play, Pause, Zap, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';

interface StreamItem {
  id: string;
  time: string;
  user: string;
  amount: string;
  action: string;
  status: 'passed' | 'blocked' | 'step_up';
  risk: number;
}

export default function LiveStreamTicker() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [items, setItems] = useState<StreamItem[]>([
    { id: '1', time: 'Just now', user: 'Aarav S.', amount: '₹1,499', action: 'Auto Coupon 20% Applied', status: 'passed', risk: 4 },
    { id: '2', time: '12s ago', user: 'Priya K.', amount: '$240', action: 'Velocity Check Passed', status: 'passed', risk: 8 },
    { id: '3', time: '35s ago', user: 'Proxy User', amount: '$8,500', action: 'Step-Up 3DS Enforced', status: 'blocked', risk: 88 }
  ]);

  useEffect(() => {
    if (!isPlaying) return;

    const names = ['Rohan M.', 'Ananya D.', 'Vikram R.', 'Sneha P.', 'Rahul K.', 'Siddharth T.'];
    const actions = ['Loyalty Clearance', 'Fast UPI Dispatch', 'Card Velocity Cleared', 'Cross Border Tax Adjusted'];

    const interval = setInterval(() => {
      soundFX.playStep(Math.floor(Math.random() * 3) + 1);
      const isHigh = Math.random() > 0.8;
      const newItem: StreamItem = {
        id: Math.random().toString(36).substring(2, 7),
        time: 'Just now',
        user: isHigh ? 'Tor Exit Node' : names[Math.floor(Math.random() * names.length)],
        amount: isHigh ? '$5,200' : `₹${(Math.floor(Math.random() * 40) + 5) * 100}`,
        action: isHigh ? 'Fraud Guardrail Locked' : actions[Math.floor(Math.random() * actions.length)],
        status: isHigh ? 'blocked' : 'passed',
        risk: isHigh ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 15) + 1
      };

      setItems((prev) => [newItem, ...prev.slice(0, 4)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #111111',
        borderRadius: '2px',
        padding: '0.85rem 1.25rem',
        marginBottom: '1.25rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isPlaying ? '#10b981' : '#a1a1aa',
              boxShadow: isPlaying ? '0 0 0 4px rgba(16,185,129,0.2)' : 'none'
            }}
          />
          <span className="brutalist-title" style={{ fontSize: '0.85rem' }}>
            REAL-TIME AGENTIC TRANSACTION STREAM
          </span>
        </div>

        <button
          onClick={() => {
            soundFX.playClick();
            setIsPlaying(!isPlaying);
          }}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '2px',
            background: isPlaying ? '#faf9f6' : '#111111',
            color: isPlaying ? '#111111' : '#ffffff',
            border: '1px solid #111111',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          <span>{isPlaying ? 'Pause Stream' : 'Resume Stream'}</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 0.75rem',
              background: item.status === 'blocked' ? '#fef2f2' : '#faf9f6',
              border: `1px solid ${item.status === 'blocked' ? '#fecaca' : '#e4e4e7'}`,
              borderRadius: '2px',
              fontSize: '0.78rem',
              animation: 'slide-in-up 0.25s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {item.status === 'blocked' ? (
                <ShieldAlert size={15} style={{ color: '#ef4444' }} />
              ) : (
                <ShieldCheck size={15} style={{ color: '#10b981' }} />
              )}
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#111111' }}>
                {item.user}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#71717a' }}>({item.time})</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#52525b' }}>{item.action}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#111111' }}>{item.amount}</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '2px',
                  background: item.status === 'blocked' ? '#ef4444' : '#10b981',
                  color: '#ffffff'
                }}
              >
                RISK {item.risk}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
