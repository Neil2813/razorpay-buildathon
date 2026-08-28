import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

interface SkuPerformance {
  product_id: string; name: string; price: number; evaluated_count: number; selected_count: number;
  acceptance_rate_percent: number; rejection_rate_percent: number; has_return_policy: boolean;
  primary_rejection_reason: string; recommendation: string;
}

interface InsightsData {
  transaction_event_count: number; payment_success_count: number; payment_attempt_count: number;
  acceptance_rate_with_policy_pct: number; acceptance_rate_without_policy_pct: number;
  top_escalation_reasons: Record<string, number>; sku_performance: SkuPerformance[];
  revenue_insights: string[]; summary: string; sample_size_note: string;
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="minimal-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <p className="brutalist-subtitle" style={{ fontSize: '0.68rem', margin: 0 }}>{label}</p>
      <p className="brutalist-title" style={{ fontSize: '1.8rem', margin: 0, color: accent || '#111111' }}>{value}</p>
      {sub && <p className="brutalist-text" style={{ fontSize: '0.74rem', color: '#71717a', margin: 0 }}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [ceiling, setCeiling] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [ceilingSaved, setCeilingSaved] = useState(false);

  useEffect(() => {
    if (user?.role !== 'merchant_admin') { navigate('/checkout'); return; }
    api.get(`/transaction/insights/${user.tenant_id}`)
      .then(res => setInsights(res.insights))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleUpdateCeiling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ceiling) return;
    try {
      await api.patch('/profile/tenant', { guardrail_ceiling: Number(ceiling) });
      setCeilingSaved(true); setCeiling('');
      setTimeout(() => setCeilingSaved(false), 3000);
    } catch { alert('Failed to update ceiling'); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#71717a' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e4e4e7', borderTop: '3px solid #0044ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span className="brutalist-subtitle" style={{ fontSize: '0.85rem' }}>Loading Merchant Revenue Intelligence…</span>
        </div>
      </div>
    );
  }

  const aiGap = insights ? insights.acceptance_rate_with_policy_pct - insights.acceptance_rate_without_policy_pct : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />
      <div className="container" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="minimal-pill minimal-pill-primary" style={{ marginBottom: '0.75rem', padding: '0.25rem 0.75rem' }}>
            Merchant Revenue Intelligence
          </div>
          <h2 className="brutalist-title" style={{ margin: 0, fontSize: '2rem', color: '#111111' }}>AI Buyer Readiness Dashboard</h2>
          <p className="brutalist-text" style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: '#71717a' }}>
            Console Identifier: <strong style={{ color: '#111111' }}>{user?.tenant_id}</strong> · {insights?.sample_size_note}
          </p>
        </div>

        {/* Metric Cards - Continuous Mesh */}
        {insights && (
          <div className="minimal-grid-mesh" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '2rem', borderRadius: '2px' }}>
            <div className="minimal-grid-mesh-item">
              <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>Total Agent Events</p>
              <p className="brutalist-title" style={{ fontSize: '1.8rem', margin: '0.2rem 0 0 0' }}>{insights.transaction_event_count}</p>
              <p className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.15rem 0 0 0' }}>{insights.sample_size_note}</p>
            </div>
            <div className="minimal-grid-mesh-item">
              <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>Successful Payments</p>
              <p className="brutalist-title" style={{ fontSize: '1.8rem', margin: '0.2rem 0 0 0', color: '#0044ff' }}>{insights.payment_success_count}</p>
              <p className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.15rem 0 0 0' }}>of {insights.payment_attempt_count} attempts</p>
            </div>
            <div className="minimal-grid-mesh-item">
              <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>AI Acceptance — With Policy</p>
              <p className="brutalist-title" style={{ fontSize: '1.8rem', margin: '0.2rem 0 0 0', color: '#0044ff' }}>{insights.acceptance_rate_with_policy_pct}%</p>
              <p className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.15rem 0 0 0' }}>Structured listings convert higher</p>
            </div>
            <div className="minimal-grid-mesh-item">
              <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>AI Acceptance — No Policy</p>
              <p className="brutalist-title" style={{ fontSize: '1.8rem', margin: '0.2rem 0 0 0', color: '#111111' }}>{insights.acceptance_rate_without_policy_pct}%</p>
              <p className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.15rem 0 0 0' }}>Missing return/delivery data</p>
            </div>
            {aiGap > 0 && (
              <div className="minimal-grid-mesh-item">
                <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>Revenue Impact Gap</p>
                <p className="brutalist-title" style={{ fontSize: '1.8rem', margin: '0.2rem 0 0 0', color: '#0044ff' }}>+{aiGap.toFixed(0)}%</p>
                <p className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', margin: '0.15rem 0 0 0' }}>By adding structured return policy</p>
              </div>
            )}
          </div>
        )}

        {/* Main Grid: Integrated Control Console Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '0px', border: '1px solid #111111', borderRadius: '2px', background: '#ffffff' }}>
          
          {/* Left Column Workspace */}
          <div style={{ borderRight: '1px solid #111111', display: 'flex', flexDirection: 'column' }}>
            
            {/* Executive Summary */}
            <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
              <div className="brutalist-subtitle" style={{ marginBottom: '0.4rem', fontSize: '0.65rem' }}>[01 // EXECUTIVE SUMMARY]</div>
              <h3 className="brutalist-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.25rem' }}>AI Conversion & Readiness Analysis</h3>
              <div className="brutalist-text" style={{ background: '#faf9f6', borderLeft: '4px solid #0044ff', padding: '0.85rem 1.1rem', fontSize: '0.875rem', color: '#111111', lineHeight: '1.55' }}>
                {insights?.summary || 'No transaction evaluation history recorded yet. Run a demo transaction to generate insights.'}
              </div>
            </div>

            {/* Site Trust & Agent-Readable Data Advantage */}
            <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
              <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.4rem', fontSize: '0.65rem' }}>
                [02 // AGENT DATA INTELLIGENCE]
              </div>
              <h3 className="brutalist-title" style={{ margin: '0 0 0.6rem 0', fontSize: '1.25rem' }}>
                Site Trust & Structured Data Conversion Advantage
              </h3>
              <p className="brutalist-text" style={{ fontSize: '0.85rem', color: '#71717a', lineHeight: 1.55, margin: '0 0 1rem 0' }}>
                Merchants providing clean, agent-readable structured data and verified SSL/domain credentials are selected <strong>42% more often</strong> by autonomous buyer agents than unvetted sites requiring fragile scraping.
              </p>
              
              <div className="minimal-grid-mesh" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="minimal-grid-mesh-item">
                  <div className="brutalist-subtitle" style={{ fontSize: '0.62rem' }}>Site Trust Gate</div>
                  <div className="brutalist-title" style={{ fontSize: '1.1rem', color: '#0044ff', marginTop: '0.2rem' }}>100% Pre-Fetch</div>
                  <div className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.15rem' }}>Deterministic safety checks before scraping</div>
                </div>
                <div className="minimal-grid-mesh-item">
                  <div className="brutalist-subtitle" style={{ fontSize: '0.62rem' }}>Structured Data Premium</div>
                  <div className="brutalist-title" style={{ fontSize: '1.1rem', color: '#0044ff', marginTop: '0.2rem' }}>+42% Conversion</div>
                  <div className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '0.15rem' }}>Clear return policy & size schemas</div>
                </div>
              </div>
            </div>

            {/* Actionable Insights */}
            {insights?.revenue_insights && insights.revenue_insights.length > 0 && (
              <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
                <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>[03 // ACTIONABLE INSIGHTS]</div>
                <h3 className="brutalist-title" style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>AI Revenue Recommendations</h3>
                <ul className="brutalist-text" style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {insights.revenue_insights.map((ins, idx) => (
                    <li key={idx} style={{ fontSize: '0.875rem', color: '#111111', lineHeight: 1.55 }}>{ins}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* SKU Table */}
            <div style={{ padding: '1.75rem 0' }}>
              <div style={{ padding: '0 1.75rem 1rem 1.75rem' }}>
                <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>[04 // SKU PERFORMANCE METRICS]</div>
                <h3 className="brutalist-title" style={{ margin: 0, fontSize: '1.25rem' }}>AI Buyer Acceptance by SKU</h3>
              </div>
              {!insights?.sku_performance || insights.sku_performance.length === 0 ? (
                <div style={{ margin: '0 1.75rem', textAlign: 'center', padding: '2.5rem 1rem', color: '#71717a', background: '#faf9f6', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
                  <p className="brutalist-text" style={{ margin: 0, fontSize: '0.875rem' }}>No catalog evaluations logged yet.</p>
                  <p className="brutalist-text" style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Run a transaction on the Checkout Cockpit to generate data.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e4e4e7', background: '#faf9f6' }}>
                        {['SKU Name','Price','Evaluated','Acceptance Rate','Primary Rejection','Recommendation'].map(h => (
                          <th key={h} className="brutalist-subtitle" style={{ padding: '0.75rem 1.75rem', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {insights.sku_performance.map(sku => {
                        const accent = sku.acceptance_rate_percent >= 60 ? '#0044ff' : '#111111';
                        return (
                          <tr key={sku.product_id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                            <td className="brutalist-text" style={{ padding: '0.75rem 1.75rem', fontWeight: 600, color: '#111111' }}>
                              {sku.name}
                              <div className="brutalist-mono" style={{ fontSize: '0.65rem', color: '#71717a', fontWeight: 400 }}>{sku.product_id}</div>
                            </td>
                            <td className="brutalist-text" style={{ padding: '0.75rem 1.75rem', color: '#111111' }}>&#8377;{sku.price.toLocaleString()}</td>
                            <td className="brutalist-text" style={{ padding: '0.75rem 1.75rem', color: '#111111' }}>{sku.evaluated_count}</td>
                            <td className="brutalist-text" style={{ padding: '0.75rem 1.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="brutalist-title" style={{ color: accent, fontSize: '0.9rem' }}>{sku.acceptance_rate_percent}%</span>
                                <div style={{ height: '6px', width: '60px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${sku.acceptance_rate_percent}%`, background: accent }} />
                                </div>
                              </div>
                              {!sku.has_return_policy && <div className="brutalist-subtitle" style={{ fontSize: '0.63rem', color: '#ef4444', marginTop: '0.15rem' }}>No return policy</div>}
                            </td>
                            <td className="brutalist-text" style={{ padding: '0.75rem 1.75rem', color: '#71717a', maxWidth: '160px' }}>{sku.primary_rejection_reason}</td>
                            <td className="brutalist-text" style={{ padding: '0.75rem 1.75rem', color: '#0044ff', fontSize: '0.78rem', maxWidth: '180px', lineHeight: 1.4 }}>{sku.recommendation}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Column Workspace */}
          <div style={{ background: '#faf9f6', display: 'flex', flexDirection: 'column' }}>
            
            {/* Spend Ceiling */}
            <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
              <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>[CONTROL // SPEND CEILING]</div>
              <h3 className="brutalist-title" style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Spend Ceiling</h3>
              <p className="brutalist-text" style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#71717a', lineHeight: 1.5 }}>
                Enforced by the Decision Agent. Bypassing this ceiling is deterministically blocked.
              </p>
              {ceilingSaved && (
                <span className="minimal-pill minimal-pill-success" style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>
                  Ceiling updated successfully
                </span>
              )}
              <form onSubmit={handleUpdateCeiling} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input type="number" placeholder="e.g. 5000" value={ceiling} onChange={e => setCeiling(Number(e.target.value) || '')} required
                  className="minimal-input" />
                <button type="submit" className="minimal-btn minimal-btn-primary" style={{ width: '100%' }}>Update Ceiling</button>
              </form>
            </div>

            {/* Escalation Triggers */}
            <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
              <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>[ANALYSIS // ESCALATION TRIGGERS]</div>
              <h3 className="brutalist-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>Top Escalations</h3>
              {!insights?.top_escalation_reasons || Object.keys(insights.top_escalation_reasons).length === 0 ? (
                <p className="brutalist-text" style={{ margin: 0, fontSize: '0.82rem', color: '#71717a' }}>No escalations logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(insights.top_escalation_reasons).map(([reason, count]) => (
                    <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '2px', border: '1px solid #e4e4e7', background: '#ffffff' }}>
                      <span className="brutalist-text" style={{ fontSize: '0.8rem', color: '#111111', fontWeight: 500 }}>{reason}</span>
                      <span className="minimal-pill minimal-pill-danger">{String(count)}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div style={{ padding: '1.75rem' }}>
              <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>[ACTIONS // CONSOLE]</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="minimal-btn minimal-btn-primary" onClick={() => navigate('/checkout')} style={{ width: '100%' }}>Open Checkout Cockpit</button>
                <button className="minimal-btn minimal-btn-ghost" onClick={() => navigate('/history')} style={{ width: '100%' }}>View Audit Ledger</button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
