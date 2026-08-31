import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { soundFX } from '../lib/soundFX';
import { 
  Search, 
  CreditCard, 
  BarChart3, 
  History, 
  User, 
  Volume2, 
  VolumeX, 
  Zap, 
  X,
  Command
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onRunScenario?: (scenarioId: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onRunScenario }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(soundFX.isEnabled());
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        soundFX.playClick();
        if (isOpen) {
          onClose();
        } else {
          // Open trigger handled at higher level or toggle
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'nav-checkout',
      category: 'Navigation',
      title: 'Checkout Cockpit',
      subtitle: 'Simulate transactions & test agent decisions',
      icon: CreditCard,
      run: () => { navigate('/checkout'); onClose(); }
    },
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Revenue Intel Dashboard',
      subtitle: 'Analytics, Knowledge Graph & Guardrail Metrics',
      icon: BarChart3,
      run: () => { navigate('/dashboard'); onClose(); }
    },
    {
      id: 'nav-history',
      category: 'Navigation',
      title: 'Audit Ledger',
      subtitle: 'Full historical trace of explainable AI decisions',
      icon: History,
      run: () => { navigate('/history'); onClose(); }
    },
    {
      id: 'nav-profile',
      category: 'Navigation',
      title: 'User Profile & Settings',
      subtitle: 'View user credentials & account roles',
      icon: User,
      run: () => { navigate('/profile'); onClose(); }
    },
    {
      id: 'scenario-vip',
      category: 'Agent Scenarios',
      title: 'Run Preset: VIP Customer + 20% Discount',
      subtitle: 'Triggers agent auto-coupon matching & fast clearance',
      icon: Zap,
      run: () => {
        navigate('/checkout');
        onClose();
        if (onRunScenario) onRunScenario('vip');
      }
    },
    {
      id: 'scenario-fraud',
      category: 'Agent Scenarios',
      title: 'Run Preset: High-Risk Cross Border Fraud',
      subtitle: 'Triggers agent risk spike, Step-Up 3DS, & verification lock',
      icon: Zap,
      run: () => {
        navigate('/checkout');
        onClose();
        if (onRunScenario) onRunScenario('fraud');
      }
    },
    {
      id: 'scenario-abandonment',
      category: 'Agent Scenarios',
      title: 'Run Preset: Cart Abandonment Nudge',
      subtitle: 'Triggers agent retention offer & payment link generator',
      icon: Zap,
      run: () => {
        navigate('/checkout');
        onClose();
        if (onRunScenario) onRunScenario('abandonment');
      }
    },
    {
      id: 'toggle-sound',
      category: 'Preferences',
      title: soundEnabled ? 'Mute Web Audio Sound FX' : 'Enable Web Audio Sound FX',
      subtitle: soundEnabled ? 'Disable audio chimes & feedback' : 'Enable audio feedback for UI clicks',
      icon: soundEnabled ? VolumeX : Volume2,
      run: () => {
        const next = soundFX.toggle();
        setSoundEnabled(next);
      }
    }
  ];

  const filtered = actions.filter(action => 
    action.title.toLowerCase().includes(query.toLowerCase()) ||
    action.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    action.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        animation: 'fade-in 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '90%',
          maxWidth: '640px',
          background: '#ffffff',
          border: '2px solid #111111',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          borderRadius: '4px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid #e4e4e7',
          gap: '0.75rem',
          background: '#faf9f6'
        }}>
          <Search size={18} style={{ color: '#71717a' }} />
          <input 
            type="text" 
            placeholder="Type a command, scenario, or page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1rem',
              fontWeight: 500,
              color: '#111111'
            }}
          />
          <span style={{
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            background: '#ffffff',
            padding: '2px 6px',
            border: '1px solid #d4d4d8',
            borderRadius: '3px',
            color: '#71717a'
          }}>
            ESC
          </span>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#71717a',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.5rem 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#71717a', fontSize: '0.875rem' }}>
              No matching commands found.
            </div>
          ) : (
            filtered.map((action, idx) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.id}
                  onClick={() => {
                    soundFX.playClick();
                    action.run();
                  }}
                  style={{
                    padding: '0.75rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    borderLeft: idx === 0 ? '3px solid #0044ff' : '3px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f4f4f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      background: action.category === 'Agent Scenarios' ? 'rgba(0,68,255,0.08)' : '#f4f4f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: action.category === 'Agent Scenarios' ? '#0044ff' : '#111111'
                    }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        color: '#111111'
                      }}>
                        {action.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#71717a' }}>
                        {action.subtitle}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '2px',
                    background: action.category === 'Agent Scenarios' ? 'rgba(0,68,255,0.1)' : '#e4e4e7',
                    color: action.category === 'Agent Scenarios' ? '#0044ff' : '#71717a'
                  }}>
                    {action.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.5rem 1.25rem',
          background: '#faf9f6',
          borderTop: '1px solid #e4e4e7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#71717a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Command size={12} />
            <span>Use <strong>Ctrl+K</strong> to trigger anywhere</span>
          </div>
          <div>GLASSBOX Agentic Engine v2.4</div>
        </div>
      </div>
    </div>
  );
}
