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
    <div className="metric-card">
      <p className="label">{label}</p>
      <p className="value" style={{ color: accent || '#032676' }}>{value}</p>
      {sub && <p className="sub">{sub}</p>}
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
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'rgba(30,30,30,0.4)' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(1,73,174,0.15)', borderTop: '3px solid #0149ae', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '0.9rem' }}>Loading Merchant Revenue Intelligence…</span>
        </div>
      </div>
    );
  }

  const aiGap = insights ? insights.acceptance_rate_with_policy_pct - insights.acceptance_rate_without_policy_pct : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />
      <div className="container" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0149ae', background: 'rgba(1,73,174,0.08)', padding: '0.25rem 0.75rem', borderRadius: '99px', border: '1px solid rgba(1,73,174,0.2)', marginBottom: '0.75rem' }}>
            Merchant Revenue Intelligence
          </div>
          <h2 style={{ margin: 0, fontSize: '1.85rem', color: '#032676' }}>AI Buyer Readiness Dashboard</h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: 'rgba(30,30,30,0.45)' }}>
            Tenant: <strong style={{ color: '#1e1e1e' }}>{user?.tenant_id}</strong> · {insights?.sample_size_note}
          </p>
        </div>

        {/* Metric Cards */}
        {insights && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <MetricCard label="Total Agent Events" value={insights.transaction_event_count} sub={insights.sample_size_note} />
            <MetricCard label="Successful Payments" value={insights.payment_success_count} accent="#0149ae" sub={`of ${insights.payment_attempt_count} attempts`} />
            <MetricCard label="AI Acceptance — With Policy" value={`${insights.acceptance_rate_with_policy_pct}%`} accent="#1250b2" sub="Structured listings convert higher" />
            <MetricCard label="AI Acceptance — No Policy" value={`${insights.acceptance_rate_without_policy_pct}%`} accent="#032676" sub="Missing return/delivery data" />
            {aiGap > 0 && <MetricCard label="Revenue Impact Gap" value={`+${aiGap.toFixed(0)}%`} accent="#0149ae" sub="By adding structured return policy" />}
          </div>
        )}

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Executive Summary */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(30,30,30,0.35)', marginBottom: '0.5rem' }}>Executive Summary</div>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#032676' }}>AI Readiness & Conversion Analysis</h3>
              <div className="insight-callout">{insights?.summary || 'No transaction evaluation history recorded yet. Run a demo transaction to generate insights.'}</div>
            </div>

            {/* Site Trust & Agent-Readable Data Advantage (UPDATE.md §7) */}
            <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(1,73,174,0.03) 0%, rgba(3,38,118,0.06) 100%)', border: '1px solid rgba(1,73,174,0.18)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0149ae', marginBottom: '0.4rem' }}>
                Agent Data Intelligence (UPDATE.md §7)
              </div>
              <h3 style={{ margin: '0 0 0.6rem 0', fontSize: '1.1rem', color: '#032676' }}>
                Site Trust & Structured Data Conversion Advantage
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(30,30,30,0.7)', lineHeight: 1.55, margin: '0 0 1rem 0' }}>
                Merchants providing clean, agent-readable structured data and verified SSL/domain credentials are selected <strong>42% more often</strong> by autonomous buyer agents than unvetted sites requiring fragile scraping.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(1,73,174,0.12)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(30,30,30,0.4)', textTransform: 'uppercase' }}>Site Trust Gate</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0149ae', marginTop: '0.2rem' }}>100% Pre-Fetch</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(30,30,30,0.5)', marginTop: '0.15rem' }}>Deterministic safety checks before scraping</div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(1,73,174,0.12)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(30,30,30,0.4)', textTransform: 'uppercase' }}>Structured Data Premium</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1250b2', marginTop: '0.2rem' }}>+42% Conversion</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(30,30,30,0.5)', marginTop: '0.15rem' }}>Clear return policy & size schemas</div>
                </div>
              </div>
            </div>

            {/* Actionable Insights */}
            {insights?.revenue_insights && insights.revenue_insights.length > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(30,30,30,0.35)', marginBottom: '0.5rem' }}>Actionable Insights</div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#032676' }}>AI Revenue Recommendations</h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {insights.revenue_insights.map((ins, idx) => (
                    <li key={idx} style={{ fontSize: '0.875rem', color: '#1e1e1e', lineHeight: 1.55 }}>{ins}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* SKU Table */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(30,30,30,0.35)', marginBottom: '0.5rem' }}>SKU Analytics</div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#032676' }}>AI Buyer Acceptance by SKU</h3>
              {!insights?.sku_performance || insights.sku_performance.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'rgba(30,30,30,0.35)', background: '#f5f5f5', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>No catalog evaluations logged yet.</p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Run a transaction on the Checkout Cockpit to generate data.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(1,73,174,0.1)', color: 'rgba(30,30,30,0.4)' }}>
                        {['SKU Name','Price','Evaluated','Acceptance Rate','Primary Rejection','Recommendation'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {insights.sku_performance.map(sku => {
                        const accent = sku.acceptance_rate_percent >= 60 ? '#0149ae' : '#032676';
                        return (
                          <tr key={sku.product_id} style={{ borderBottom: '1px solid rgba(1,73,174,0.07)', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <td style={{ padding: '0.75rem', fontWeight: 600, color: '#1e1e1e' }}>
                              {sku.name}
                              <div style={{ fontSize: '0.65rem', color: 'rgba(30,30,30,0.3)', fontWeight: 400, fontFamily: 'monospace' }}>{sku.product_id}</div>
                            </td>
                            <td style={{ padding: '0.75rem', color: '#1e1e1e' }}>&#8377;{sku.price.toLocaleString()}</td>
                            <td style={{ padding: '0.75rem', color: '#1e1e1e' }}>{sku.evaluated_count}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, color: accent, fontSize: '0.9rem' }}>{sku.acceptance_rate_percent}%</span>
                                <div className="progress-bar-track" style={{ width: '60px' }}>
                                  <div className="progress-bar-fill" style={{ width: `${sku.acceptance_rate_percent}%`, background: accent }} />
                                </div>
                              </div>
                              {!sku.has_return_policy && <div style={{ fontSize: '0.63rem', color: '#032676', marginTop: '0.15rem' }}>No return policy</div>}
                            </td>
                            <td style={{ padding: '0.75rem', color: 'rgba(30,30,30,0.55)', maxWidth: '160px' }}>{sku.primary_rejection_reason}</td>
                            <td style={{ padding: '0.75rem', color: '#0149ae', fontSize: '0.78rem', maxWidth: '180px', lineHeight: 1.4 }}>{sku.recommendation}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Spend Ceiling */}
            <div className="card" style={{ padding: '1.5rem', borderTop: `3px solid ${ceilingSaved ? '#1250b2' : '#0149ae'}`, transition: 'border-color 0.4s' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(30,30,30,0.35)', marginBottom: '0.5rem' }}>Deterministic Control Plane</div>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', color: '#032676' }}>Spend Ceiling</h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: 'rgba(30,30,30,0.45)', lineHeight: 1.5 }}>
                The maximum unattended spend ceiling enforced by the Decision Agent. The LLM cannot bypass this.
              </p>
              {ceilingSaved && (
                <span className="pill pill-success" style={{ marginBottom: '0.75rem', fontSize: '0.75rem', padding: '0.3rem 0.75rem', display: 'inline-flex' }}>
                  Ceiling updated successfully
                </span>
              )}
              <form onSubmit={handleUpdateCeiling} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input type="number" placeholder="e.g. 5000" value={ceiling} onChange={e => setCeiling(Number(e.target.value) || '')} required
                  style={{ padding: '0.7rem 0.9rem', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', color: '#1e1e1e', background: '#ffffff' }}
                  onFocus={e => e.target.style.borderColor = '#0149ae'}
                  onBlur={e => e.target.style.borderColor = 'rgba(1,73,174,0.15)'} />
                <button type="submit" className="btn-primary" style={{ padding: '0.7rem', fontSize: '0.9rem' }}>Update Ceiling</button>
              </form>
            </div>

            {/* Escalation Triggers */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(30,30,30,0.35)', marginBottom: '0.5rem' }}>Escalation Analysis</div>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', color: '#032676' }}>Top Escalation Triggers</h3>
              {!insights?.top_escalation_reasons || Object.keys(insights.top_escalation_reasons).length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(30,30,30,0.4)' }}>No escalations logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(insights.top_escalation_reasons).map(([reason, count]) => (
                    <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(3,38,118,0.05)', border: '1px solid rgba(3,38,118,0.12)' }}>
                      <span style={{ fontSize: '0.8rem', color: '#1e1e1e', fontWeight: 500 }}>{reason}</span>
                      <span className="pill pill-danger">{String(count)}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="btn-primary" onClick={() => navigate('/checkout')} style={{ padding: '0.6rem', fontSize: '0.875rem' }}>Open Checkout Cockpit</button>
                <button className="btn-ghost" onClick={() => navigate('/history')} style={{ padding: '0.6rem', fontSize: '0.875rem' }}>View Audit Ledger</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
