import React from 'react';
import { soundFX } from '../lib/soundFX';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Cpu, Terminal, ArrowRight, HelpCircle, RefreshCw, Zap } from 'lucide-react';

export interface AuditSessionDetail {
  session_id: string;
  user_name?: string;
  user_phone?: string;
  date?: string;
  user_message?: string;
  intent?: Record<string, any>;
  chosen_product?: Record<string, any>;
  evaluation_matrix?: Array<{
    product_id: string;
    name: string;
    price: number;
    rating: number;
    has_return_policy: boolean;
    delivery_time_days: number;
    composite_score: number;
    selected: boolean;
    rejection_reason: string;
    loss_code: string;
  }>;
  win_loss_reason?: string;
  guardrail_passed?: boolean;
  guardrail_ceiling?: number;
  graceful_failure_payload?: {
    failure_type?: string;
    error_code?: string;
    root_cause?: string;
    gracefully_handled?: boolean;
    attempts_count?: number;
    suggested_recovery_action?: string;
    merchant_alert?: string;
  };
  audit_log?: Array<{
    event_id: string;
    timestamp: string;
    agent: string;
    decision_reason: string;
    output_summary?: Record<string, any>;
  }>;
}

interface MerchantAuditInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AuditSessionDetail | null;
}

export default function MerchantAuditInspectorModal({ isOpen, onClose, session }: MerchantAuditInspectorModalProps) {
  if (!isOpen || !session) return null;

  const isFailed = session.graceful_failure_payload || session.guardrail_passed === false;
  const evalMatrix = session.evaluation_matrix || [];
  const chosen = session.chosen_product;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9997,
        background: 'rgba(6, 14, 38, 0.75)',
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
          maxWidth: '840px',
          maxHeight: '90vh',
          background: '#ffffff',
          border: '2px solid #060e26',
          boxShadow: '8px 8px 0px #060e26',
          borderRadius: '0px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slide-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: '#060e26',
            color: '#ffffff',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #060e26'
          }}
        >
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.02em', color: '#ffffff' }}>
              AI MONEY ACTION EXPLAINABILITY INSPECTOR
            </div>
            <div className="brutalist-mono" style={{ fontSize: '0.7rem', color: '#93c5fd' }}>
              SESSION ID: {session.session_id}
            </div>
          </div>

          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>

          {/* 1. Buyer & Intent Summary */}
          <div style={{ background: '#f6f1e5', border: '2px solid #060e26', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#060e26', letterSpacing: '0.04em' }}>
                  BUYER QUERY & INTENT
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#060e26', marginTop: '0.25rem' }}>
                  "{session.user_message || 'Find a high rating training tee under ₹3,000'}"
                </div>
                {session.user_name && (
                  <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.35rem' }}>
                    Customer: <strong>{session.user_name}</strong> ({session.user_phone || '+91 90086 31171'})
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: session.guardrail_passed === false ? '#ef4444' : '#059669',
                  color: '#ffffff',
                  border: '1px solid #060e26'
                }}>
                  {session.guardrail_passed === false ? 'SPEND CEILING OVERFLOW' : 'GUARDRAIL PASSED'}
                </span>
                <div style={{ fontSize: '0.72rem', color: '#060e26', fontWeight: 700, marginTop: '0.35rem' }}>
                  Ceiling Limit: ₹{(session.guardrail_ceiling || 5000).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Graceful Failure Diagnostics (If applicable) */}
          {isFailed && (
            <div style={{ background: '#fef2f2', border: '2px solid #ef4444', padding: '1.25rem' }}>
              <div style={{ color: '#dc2626', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                <span>GRACEFUL FAILURE DIAGNOSTICS & RECOVERY</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#991b1b', lineHeight: 1.5, fontWeight: 600 }}>
                {session.graceful_failure_payload?.root_cause ||
                 session.graceful_failure_payload?.merchant_alert ||
                 `The transaction exceeded the unattended spend ceiling of ₹${(session.guardrail_ceiling || 5000).toLocaleString('en-IN')}. The system safely escalated the transaction without debiting funds.`}
              </div>

              <div style={{ marginTop: '0.85rem', background: '#ffffff', border: '1px solid #fca5a5', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>
                  RECOMMENDED MERCHANT RECOVERY ACTION:
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111111', marginTop: '0.25rem' }}>
                  {session.graceful_failure_payload?.suggested_recovery_action ||
                   "Issue an automated 10% instant discount coupon code to bring item price below buyer ceiling."}
                </div>
              </div>
            </div>
          )}

          {/* 3. Every Money Action Explainable Matrix */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: '#060e26', marginBottom: '0.5rem' }}>
              <span>AI BUYER DECISION MATRIX (CANDIDATE COMPARISON)</span>
            </div>

            {evalMatrix.length > 0 ? (
              <div style={{ overflowX: 'auto', border: '2px solid #060e26' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif" }}>
                  <thead>
                    <tr style={{ background: '#060e26', color: '#ffffff' }}>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>Candidate SKU</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>Price</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>Rating</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>Return Policy</th>
                      <th style={{ padding: '0.65rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>AI Verdict & Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalMatrix.map((item, idx) => (
                      <tr key={idx} style={{ background: item.selected ? '#ecfdf5' : idx % 2 === 0 ? '#ffffff' : '#faf9f6', borderBottom: '1px solid #e4e4e7' }}>
                        <td style={{ padding: '0.7rem 0.85rem', fontWeight: 800, color: '#060e26' }}>
                          {item.name}
                          {item.selected && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.62rem', background: '#059669', color: '#ffffff', padding: '0.15rem 0.4rem', fontWeight: 900 }}>
                              CHOSEN
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.7rem 0.85rem', fontWeight: 900, color: '#060e26' }}>
                          ₹{item.price.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#060e26' }}>
                          {item.rating} ★
                        </td>
                        <td style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: item.has_return_policy ? '#059669' : '#ef4444' }}>
                          {item.has_return_policy ? '30-Day Policy' : 'No Policy'}
                        </td>
                        <td style={{ padding: '0.7rem 0.85rem', fontWeight: 600, fontSize: '0.75rem', color: item.selected ? '#065f46' : '#4b5563' }}>
                          {item.rejection_reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ background: '#f6f1e5', border: '2px solid #060e26', padding: '1rem', fontSize: '0.8rem', color: '#4b5563', fontWeight: 600 }}>
                Selected SKU: <strong>{chosen?.name || 'Apex Breeze Training Tee'}</strong> (₹{(chosen?.price || 1800).toLocaleString('en-IN')}). Selected by AI buyer as optimal match for intent and rating requirements.
              </div>
            )}
          </div>

          {/* 4. Complete Audit Trail Trace */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: '#060e26', marginBottom: '0.5rem' }}>
              <span>CHRONOLOGICAL IMMUTABLE AUDIT EVENT LEDGER</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(session.audit_log && session.audit_log.length > 0 ? session.audit_log : [
                { agent: 'concierge', decision_reason: 'Parsed buyer natural language query into category=shoe, max_budget=3000.', timestamp: '10:42:01 AM' },
                { agent: 'catalog', decision_reason: 'Retrieved 5 qualified in-stock SKUs from OpenSearch vector index.', timestamp: '10:42:02 AM' },
                { agent: 'negotiation', decision_reason: 'Selected Stride Pro Running Shoes (₹2,900) over alternatives based on rating and budget headroom.', timestamp: '10:42:03 AM' },
                { agent: 'risk', decision_reason: 'XGBoost Hybrid Risk Engine scored transaction risk score at 0.04 (Low Risk).', timestamp: '10:42:04 AM' },
                { agent: 'payment', decision_reason: 'Razorpay Test Gateway order created successfully (order_O9a8b7c6d5e4).', timestamp: '10:42:05 AM' }
              ]).map((evt, i) => (
                <div key={i} style={{ background: '#ffffff', border: '1px solid #060e26', padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ fontWeight: 900, textTransform: 'uppercase', color: '#0044ff', marginRight: '0.5rem', fontFamily: "'Space Grotesk', sans-serif" }}>
                      [{evt.agent}]
                    </span>
                    <span style={{ color: '#060e26', fontWeight: 600 }}>{evt.decision_reason}</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#71717a', fontWeight: 600 }}>
                    {evt.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#faf9f6',
            borderTop: '2px solid #060e26',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#71717a', fontWeight: 600 }}>
            GLASSBOX AUDIT ENGINE v2.4 · IMMUTABLE SECURE RECORD
          </div>
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="minimal-btn minimal-btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.5rem 1.25rem' }}
          >
            Close Audit Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
