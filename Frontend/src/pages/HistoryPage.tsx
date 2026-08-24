import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Navbar from '../components/Navbar';

interface TransactionItem {
  session_id: string; tenant_id: string; user_message: string; payment_status: string;
  chosen_product?: { product_id?: string; name?: string; price?: number; } | null;
  risk_score?: number | null; escalation_message?: string | null;
  audit_count: number; created_at: string;
}

const STATUS_FILTERS = ['all', 'success', 'escalated', 'pending'];

export default function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<TransactionItem[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/transaction/history/list')
      .then(res => setHistory(res.history || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = history.filter(item => {
    const matchStatus = filterStatus === 'all' || item.payment_status === filterStatus;
    const matchSearch = !searchQuery || item.user_message.toLowerCase().includes(searchQuery.toLowerCase()) || item.session_id.toLowerCase().includes(searchQuery.toLowerCase()) || (item.chosen_product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchStatus && matchSearch;
  });

  const totalSuccess = history.filter(i => i.payment_status === 'success').length;
  const totalEscalated = history.filter(i => i.payment_status === 'escalated').length;
  const totalAudit = history.reduce((s, i) => s + (i.audit_count || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'rgba(30,30,30,0.4)' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(1,73,174,0.15)', borderTop: '3px solid #0149ae', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '0.9rem' }}>Loading Transaction History…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />
      <div className="container" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1250b2', background: 'rgba(18,80,178,0.08)', padding: '0.25rem 0.75rem', borderRadius: '99px', border: '1px solid rgba(18,80,178,0.2)', marginBottom: '0.75rem' }}>
            Immutable Audit Ledger
          </div>
          <h2 style={{ margin: 0, fontSize: '1.85rem', color: '#032676' }}>Transaction History</h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: 'rgba(30,30,30,0.45)' }}>
            Explore past agent decisions, guardrail events, and payment outcomes — all immutably logged.
          </p>
        </div>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div className="metric-card"><p className="label">Total Sessions</p><p className="value" style={{ color: '#032676' }}>{history.length}</p></div>
          <div className="metric-card"><p className="label">Successful Payments</p><p className="value" style={{ color: '#0149ae' }}>{totalSuccess}</p></div>
          <div className="metric-card"><p className="label">Escalated / Blocked</p><p className="value" style={{ color: '#032676' }}>{totalEscalated}</p></div>
          <div className="metric-card"><p className="label">Total Audit Events</p><p className="value" style={{ color: '#1250b2' }}>{totalAudit}</p><p className="sub">Across all sessions</p></div>
        </div>

        {/* Filter Bar */}
        <div className="card" style={{ padding: '0.9rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(30,30,30,0.35)' }}>Status:</span>
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding: '0.3rem 0.75rem', borderRadius: '99px', border: filterStatus === s ? '1px solid #0149ae' : '1px solid rgba(1,73,174,0.15)', background: filterStatus === s ? '#0149ae' : '#ffffff', color: filterStatus === s ? '#ffffff' : 'rgba(30,30,30,0.55)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input type="text" placeholder="Search intent, SKU, or session ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '0.5rem 0.9rem', borderRadius: '6px', border: '1px solid rgba(1,73,174,0.15)', fontSize: '0.85rem', minWidth: '250px', fontFamily: 'inherit', outline: 'none', color: '#1e1e1e', background: '#ffffff' }}
              onFocus={e => e.target.style.borderColor = '#0149ae'}
              onBlur={e => e.target.style.borderColor = 'rgba(1,73,174,0.15)'} />
            <button className="btn-primary" onClick={() => navigate('/checkout')} style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
              + New Transaction
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'rgba(30,30,30,0.4)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0', color: '#1e1e1e' }}>
                {history.length === 0 ? 'No transaction history yet.' : 'No matching transactions.'}
              </p>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                {history.length === 0 ? 'Head to the Checkout Cockpit and run your first transaction.' : 'Try adjusting your search or status filter.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(1,73,174,0.1)', color: 'rgba(30,30,30,0.4)' }}>
                    {['Session','Buyer Intent','Chosen Product','Status','ML Risk','Audit Events','Time'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: '#f5f5f5' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isSuccess = item.payment_status === 'success';
                    const isEscalated = item.payment_status === 'escalated';
                    return (
                      <tr key={item.session_id} style={{ borderBottom: '1px solid rgba(1,73,174,0.07)', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(30,30,30,0.4)', whiteSpace: 'nowrap' }}>{item.session_id}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#1e1e1e', maxWidth: '260px' }}>
                          <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{item.user_message}</div>
                          {item.escalation_message && <div style={{ fontSize: '0.7rem', color: '#032676', marginTop: '0.2rem' }}>{item.escalation_message}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#1e1e1e', whiteSpace: 'nowrap' }}>
                          {item.chosen_product ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e1e1e', fontSize: '0.82rem' }}>{item.chosen_product.name || item.chosen_product.product_id}</div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(30,30,30,0.4)' }}>&#8377;{item.chosen_product.price?.toLocaleString()}</div>
                            </div>
                          ) : <span style={{ color: 'rgba(30,30,30,0.2)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className={`pill ${isSuccess ? 'pill-success' : isEscalated ? 'pill-danger' : 'pill-gray'}`}>{item.payment_status}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {item.risk_score !== null && item.risk_score !== undefined ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <div className="progress-bar-track" style={{ width: '48px', height: '6px' }}>
                                <div className="progress-bar-fill" style={{ width: `${item.risk_score * 100}%`, background: item.risk_score > 0.7 ? '#032676' : item.risk_score > 0.3 ? '#1250b2' : '#0149ae' }} />
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e1e1e' }}>{(item.risk_score * 100).toFixed(1)}%</span>
                            </div>
                          ) : <span style={{ color: 'rgba(30,30,30,0.2)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#1e1e1e' }}>
                          <span style={{ fontWeight: 600 }}>{item.audit_count}</span>
                          <span style={{ color: 'rgba(30,30,30,0.4)' }}> events</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'rgba(30,30,30,0.4)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > 0 && <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'rgba(30,30,30,0.35)', textAlign: 'right' }}>Showing {filtered.length} of {history.length} sessions</div>}
      </div>
    </div>
  );
}
