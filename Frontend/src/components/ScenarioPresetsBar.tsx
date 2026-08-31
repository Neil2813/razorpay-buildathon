import React from 'react';
import { soundFX } from '../lib/soundFX';
import { Zap, ShieldAlert, Sparkles, Send, Gift } from 'lucide-react';

export interface PresetData {
  id: string;
  name: string;
  badge: string;
  color: string;
  customerName: string;
  email: string;
  amount: number;
  currency: string;
  riskScore: number;
  couponCode: string;
  paymentMethod: string;
  description: string;
}

export const PRESET_SCENARIOS: PresetData[] = [
  {
    id: 'vip',
    name: 'VIP Loyalty Checkout',
    badge: 'AUTO DISCOUNT 20%',
    color: '#0044ff',
    customerName: 'Aarav Sharma',
    email: 'aarav.vip@example.com',
    amount: 1499,
    currency: 'INR',
    riskScore: 0.05,
    couponCode: 'AUTO_LOVALTY_20',
    paymentMethod: 'card',
    description: 'Triggers agent auto-coupon matching & instant clearance'
  },
  {
    id: 'fraud',
    name: 'High-Risk Cross Border',
    badge: 'STEP-UP 3DS GATE',
    color: '#ef4444',
    customerName: 'Unknown Proxy User',
    email: 'flagged_user99@tor-exit.net',
    amount: 8500,
    currency: 'USD',
    riskScore: 0.88,
    couponCode: '',
    paymentMethod: 'card',
    description: 'Triggers agent risk spike, fraud lock, & biometric 3DS'
  },
  {
    id: 'abandonment',
    name: 'Cart Abandoner Offer',
    badge: 'NUDGE + FREE SHIPPING',
    color: '#f97316',
    customerName: 'Priya Patel',
    email: 'priya.patel@example.com',
    amount: 650,
    currency: 'INR',
    riskScore: 0.15,
    couponCode: 'RETENTION_SHIP_FREE',
    paymentMethod: 'upi',
    description: 'Triggers agent retention offer & instant UPI payment link'
  },
  {
    id: 'crypto',
    name: 'Crypto Direct Route',
    badge: 'ZERO FX SPLIT',
    color: '#10b981',
    customerName: 'Web3 Global Merchant',
    email: 'crypto.pay@eth-dao.io',
    amount: 320,
    currency: 'USD',
    riskScore: 0.1,
    couponCode: '',
    paymentMethod: 'crypto',
    description: 'Triggers agent instant liquidity routing & zero FX fee'
  }
];

interface ScenarioPresetsBarProps {
  onSelectPreset: (preset: PresetData) => void;
  activePresetId?: string | null;
}

export default function ScenarioPresetsBar({ onSelectPreset, activePresetId }: ScenarioPresetsBarProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #111111',
        borderRadius: '2px',
        padding: '0.85rem 1rem',
        marginBottom: '1.25rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={16} style={{ color: '#0044ff' }} />
          <span className="brutalist-title" style={{ fontSize: '0.85rem' }}>
            ONE-CLICK AGENT TEST PRESETS
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#71717a' }}>
          Select a preset to test agentic reasoning pipelines live
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.5rem'
        }}
      >
        {PRESET_SCENARIOS.map((preset) => {
          const isSelected = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => {
                soundFX.playClick();
                onSelectPreset(preset);
              }}
              style={{
                background: isSelected ? 'rgba(0,68,255,0.06)' : '#faf9f6',
                border: `1.5px solid ${isSelected ? preset.color : '#d4d4d8'}`,
                borderRadius: '2px',
                padding: '0.6rem 0.75rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = '#111111';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = '#d4d4d8';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.78rem', color: '#111111' }}>
                  {preset.name}
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '2px',
                    background: preset.color,
                    color: '#ffffff'
                  }}
                >
                  {preset.badge}
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#71717a', lineHeight: 1.3 }}>
                {preset.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
