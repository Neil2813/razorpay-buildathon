import React from 'react';
import { soundFX } from '../lib/soundFX';
import { X, Network, ShieldCheck, Activity, Terminal, ExternalLink, Cpu } from 'lucide-react';

export interface NodeData {
  id: string;
  label: string;
  type: string;
  status: 'passed' | 'blocked' | 'warning' | 'active' | string;
  details?: Record<string, any>;
  riskWeight?: number;
  latencyMs?: number;
  description?: string;
  ruleCode?: string;
}

interface GraphNodeInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: NodeData | null;
}

export default function GraphNodeInspectorModal({ isOpen, onClose, node }: GraphNodeInspectorModalProps) {
  if (!isOpen || !node) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9996,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fade-in 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#ffffff',
          border: '2px solid #111111',
          borderRadius: '4px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          animation: 'slide-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: '#111111',
            color: '#ffffff',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '2px',
                background: '#0044ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Network size={18} />
            </div>
            <div>
              <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '1.15rem', letterSpacing: '0.04em' }}>
                KNOWLEDGE NODE INSPECTOR
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NODE ID: {node.id}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Main Title Banner */}
          <div
            style={{
              padding: '1rem',
              background: '#faf9f6',
              border: '1px solid #e4e4e7',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#111111' }}>
                {node.label}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#71717a', marginTop: '2px' }}>
                {node.description || 'Neural rule graph node executed by Glassbox Commerce Agent.'}
              </div>
            </div>

            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '2px',
                background: node.status === 'passed' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: node.status === 'passed' ? '#10b981' : '#ef4444',
                border: `1px solid ${node.status === 'passed' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}
            >
              {node.status}
            </span>
          </div>

          {/* Metrics Mesh Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', padding: '0.75rem', borderRadius: '2px' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#71717a', fontWeight: 700 }}>
                RISK WEIGHT
              </div>
              <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#0044ff' }}>
                {((node.riskWeight || 0.05) * 100).toFixed(0)}%
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', padding: '0.75rem', borderRadius: '2px' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#71717a', fontWeight: 700 }}>
                LATENCY
              </div>
              <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#111111' }}>
                {node.latencyMs || 14} ms
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e4e4e7', padding: '0.75rem', borderRadius: '2px' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#71717a', fontWeight: 700 }}>
                TYPE
              </div>
              <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '1.3rem', fontWeight: 700, color: '#111111', textTransform: 'uppercase' }}>
                {node.type || 'RULE'}
              </div>
            </div>
          </div>

          {/* Code Inspector Box */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#71717a', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Terminal size={14} style={{ color: '#0044ff' }} />
              <span>AGENT EVALUATION RULE TRACE</span>
            </div>
            <pre
              style={{
                background: '#111111',
                color: '#10b981',
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                padding: '0.85rem',
                borderRadius: '4px',
                overflowX: 'auto',
                lineHeight: 1.5,
                margin: 0
              }}
            >
{node.ruleCode || `// Glassbox Rule Node Execution Trace
rule_id: "${node.id}"
evaluated_at: "${new Date().toISOString()}"
policy_scope: "MERCHANT_GUARDRAIL_GLOBAL"
inputs: { velocity_score: 0.02, geo_ip_trust: 0.99 }
verdict: ${node.status.toUpperCase()}
confidence: 0.988`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: '#faf9f6',
            borderTop: '1px solid #e4e4e7',
            textAlign: 'right'
          }}
        >
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="minimal-btn minimal-btn-primary"
            style={{ fontSize: '0.78rem' }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
