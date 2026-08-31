import React, { useState } from 'react';
import { soundFX } from '../lib/soundFX';
import { CheckCircle2, Copy, Check, Download, ExternalLink, ShieldCheck, X, FileText } from 'lucide-react';

interface GlassReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionData: {
    txnId: string;
    amount: number;
    currency: string;
    customerName: string;
    email: string;
    paymentMethod: string;
    agentReasoning: string;
    discountApplied?: number;
    riskScore?: number;
    timestamp?: string;
  } | null;
}

export default function GlassReceiptModal({ isOpen, onClose, transactionData }: GlassReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !transactionData) return null;

  const handleCopyTxn = () => {
    soundFX.playClick();
    navigator.clipboard.writeText(transactionData.txnId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const finalAmount = transactionData.amount - (transactionData.discountApplied || 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9995,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fade-in 0.25s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          border: '2px solid #111111',
          borderRadius: '4px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          animation: 'slide-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '1.5rem',
            textAlign: 'center',
            position: 'relative'
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>

          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto'
            }}
          >
            <CheckCircle2 size={28} />
          </div>

          <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '1.4rem', letterSpacing: '0.04em' }}>
            PAYMENT AUTHORIZED
          </div>
          <div style={{ fontSize: '0.78rem', opacity: 0.9, marginTop: '2px' }}>
            Glassbox Autonomous Decision Engine Signed & Verified
          </div>
        </div>

        {/* Receipt Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Amount Card */}
          <div
            style={{
              background: '#faf9f6',
              border: '1px dashed #d4d4d8',
              borderRadius: '4px',
              padding: '1rem',
              textAlign: 'center',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              FINAL DISPATCHED AMOUNT
            </div>
            <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '2.4rem', color: '#111111', fontWeight: 700 }}>
              {transactionData.currency === 'INR' ? '₹' : '$'}
              {finalAmount.toLocaleString()}
            </div>
            {transactionData.discountApplied && transactionData.discountApplied > 0 ? (
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                Includes ${transactionData.discountApplied} Agent Auto-Discount
              </div>
            ) : null}
          </div>

          {/* Details Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#71717a' }}>Transaction ID</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                <span>{transactionData.txnId.substring(0, 16)}...</span>
                <button
                  onClick={handleCopyTxn}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0044ff', padding: 0 }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#71717a' }}>Customer</span>
              <span style={{ fontWeight: 600, color: '#111111' }}>{transactionData.customerName}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#71717a' }}>Payment Method</span>
              <span style={{ fontWeight: 600, color: '#111111', textTransform: 'uppercase' }}>{transactionData.paymentMethod}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
              <span style={{ color: '#71717a' }}>Evaluated Risk Index</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>{((transactionData.riskScore || 0.05) * 100).toFixed(0)} / 100 (Safe)</span>
            </div>
          </div>

          {/* Agent Reasoning Box */}
          <div
            style={{
              marginTop: '1rem',
              background: 'rgba(0,68,255,0.05)',
              borderLeft: '3px solid #0044ff',
              padding: '0.75rem',
              borderRadius: '0 4px 4px 0',
              fontSize: '0.75rem',
              lineHeight: 1.4,
              color: '#111111'
            }}
          >
            <div style={{ fontWeight: 700, color: '#0044ff', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={13} />
              <span>AGENT EXPLAINABILITY STAMP</span>
            </div>
            {transactionData.agentReasoning}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#faf9f6',
            borderTop: '1px solid #e4e4e7',
            display: 'flex',
            gap: '0.5rem'
          }}
        >
          <button
            onClick={() => {
              soundFX.playClick();
              alert('Digital Receipt PDF exported to downloads!');
            }}
            className="minimal-btn minimal-btn-ghost"
            style={{ flex: 1, fontSize: '0.78rem' }}
          >
            <Download size={14} />
            <span>Download</span>
          </button>

          <button
            onClick={onClose}
            className="minimal-btn minimal-btn-primary"
            style={{ flex: 1, fontSize: '0.78rem' }}
          >
            <span>Close Cockpit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
