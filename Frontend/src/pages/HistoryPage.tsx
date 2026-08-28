import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Navbar from '../components/Navbar';
import KnowledgeGraph from '../components/KnowledgeGraph';

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
  
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  const handleRowClick = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    
    if (!sessionDetails[sessionId]) {
      setLoadingDetails(prev => ({ ...prev, [sessionId]: true }));
      try {
        const res = await api.get(`/transaction/${sessionId}`);
        setSessionDetails(prev => ({ ...prev, [sessionId]: res }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetails(prev => ({ ...prev, [sessionId]: false }));
      }
    }
  };

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
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#71717a' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e4e4e7', borderTop: '3px solid #0044ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span className="brutalist-subtitle" style={{ fontSize: '0.85rem' }}>Loading Transaction History…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />
      <div className="container" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="minimal-pill minimal-pill-primary" style={{ marginBottom: '0.75rem', padding: '0.25rem 0.75rem' }}>
            Immutable Audit Ledger
          </div>
          <h2 className="brutalist-title" style={{ margin: 0, fontSize: '2rem', color: '#111111' }}>Transaction History</h2>
          <p className="brutalist-text" style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: '#71717a' }}>
            Explore past agent decisions, guardrail events, and payment outcomes logged immutably.
          </p>
        </div>

        {/* Metric Cards - Connected Mesh */}
        <div className="minimal-grid-mesh" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.75rem', borderRadius: '2px' }}>
          <div className="minimal-grid-mesh-item">
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>Total Sessions</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', margin: '0.2rem 0 0 0' }}>{history.length}</p>
          </div>
          <div className="minimal-grid-mesh-item">
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>Successful Payments</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', color: '#0044ff', margin: '0.2rem 0 0 0' }}>{totalSuccess}</p>
          </div>
          <div className="minimal-grid-mesh-item">
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>Escalated / Blocked</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', margin: '0.2rem 0 0 0' }}>{totalEscalated}</p>
          </div>
          <div className="minimal-grid-mesh-item">
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0 }}>Total Audit Events</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', color: '#0044ff', margin: '0.2rem 0 0 0' }}>{totalAudit}</p>
            <p className="brutalist-text" style={{ fontSize: '0.74rem', color: '#71717a', margin: 0 }}>Across all sessions</p>
          </div>
        </div>

        {/* Ledger Console Board Wrapper */}
        <div style={{ border: '1px solid #111111', borderRadius: '2px', background: '#ffffff', overflow: 'hidden' }}>
          
          {/* Toolbar Header Row */}
          <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #111111', background: '#faf9f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="brutalist-subtitle" style={{ fontSize: '0.65rem' }}>Status Filters:</span>
              {STATUS_FILTERS.map(s => {
                const isActive = filterStatus === s;
                return (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`minimal-pill ${isActive ? 'minimal-pill-primary' : ''}`}
                    style={{ cursor: 'pointer', padding: '0.3rem 0.75rem', textTransform: 'capitalize' }}>
                    {s}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input type="text" placeholder="Search intent, SKU, or session ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="minimal-input"
                style={{ minWidth: '250px', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }} />
              <button className="minimal-btn minimal-btn-primary" onClick={() => navigate('/checkout')} style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                + New Transaction
              </button>
            </div>
          </div>

          {/* Table Ledger Grid */}
          {filtered.length === 0 ? (
            <div className="brutalist-text" style={{ textAlign: 'center', padding: '4rem 1rem', color: '#71717a' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0', color: '#111111' }}>
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
                  <tr style={{ borderBottom: '1px solid #e4e4e7', background: '#faf9f6' }}>
                    {['Session','Buyer Intent','Chosen Product','Status','ML Risk','Audit Events','Time'].map(h => (
                      <th key={h} className="brutalist-subtitle" style={{ padding: '0.75rem 1.25rem', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isSuccess = item.payment_status === 'success';
                    const isEscalated = item.payment_status === 'escalated';
                    const isExpanded = expandedSessionId === item.session_id;
                    const pillClass = isSuccess ? 'minimal-pill-success' : isEscalated ? 'minimal-pill-danger' : '';
                    return (
                      <React.Fragment key={item.session_id}>
                        <tr style={{ borderBottom: '1px solid #e4e4e7', cursor: 'pointer', background: isExpanded ? '#faf9f6' : '' }}
                          onClick={() => handleRowClick(item.session_id)}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#faf9f6' }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '' }}>
                          <td className="brutalist-mono" style={{ padding: '0.75rem 1.25rem', fontSize: '0.7rem', color: '#71717a', whiteSpace: 'nowrap' }}>{item.session_id}</td>
                          <td className="brutalist-text" style={{ padding: '0.75rem 1.25rem', color: '#111111', maxWidth: '260px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.user_message}</div>
                            {item.escalation_message && <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.2rem' }}>{item.escalation_message}</div>}
                          </td>
                          <td className="brutalist-text" style={{ padding: '0.75rem 1.25rem', color: '#111111', whiteSpace: 'nowrap' }}>
                            {item.chosen_product ? (
                              <div>
                                <div style={{ fontWeight: 600, color: '#111111', fontSize: '0.82rem' }}>{item.chosen_product.name || item.chosen_product.product_id}</div>
                                <div className="brutalist-title" style={{ fontSize: '0.74rem', color: '#0044ff' }}>&#8377;{item.chosen_product.price?.toLocaleString()}</div>
                              </div>
                            ) : <span style={{ color: '#d4d4d8' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.75rem 1.25rem' }}>
                            <span className={`minimal-pill ${pillClass}`}>{item.payment_status}</span>
                          </td>
                          <td className="brutalist-text" style={{ padding: '0.75rem 1.25rem' }}>
                            {item.risk_score !== null && item.risk_score !== undefined ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{ width: '48px', height: '6px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${item.risk_score * 100}%`, background: item.risk_score > 0.7 ? '#ef4444' : item.risk_score > 0.3 ? '#f97316' : '#0044ff' }} />
                                </div>
                                <span className="brutalist-title" style={{ fontSize: '0.78rem', color: '#111111' }}>{(item.risk_score * 100).toFixed(1)}%</span>
                              </div>
                            ) : <span style={{ color: '#d4d4d8' }}>—</span>}
                          </td>
                          <td className="brutalist-text" style={{ padding: '0.75rem 1.25rem', color: '#111111' }}>
                            <span style={{ fontWeight: 700 }}>{item.audit_count}</span>
                            <span style={{ color: '#71717a' }}> events</span>
                          </td>
                          <td className="brutalist-mono" style={{ padding: '0.75rem 1.25rem', color: '#71717a', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent'}
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr style={{ borderBottom: '1px solid #e4e4e7', background: '#ffffff' }}>
                            <td colSpan={7} style={{ padding: '0 1.25rem 1.5rem 1.25rem' }}>
                              {loadingDetails[item.session_id] ? (
                                <div className="brutalist-text" style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
                                  <div style={{ width: '24px', height: '24px', border: '2px solid #e4e4e7', borderTop: '2px solid #0044ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.5rem auto' }} />
                                  Loading graph data...
                                </div>
                              ) : sessionDetails[item.session_id] ? (
                                <div style={{ animation: 'slide-in-up 0.25s ease-out' }}>
                                  <KnowledgeGraph
                                    activeAgent="ledger"
                                    auditLog={sessionDetails[item.session_id].audit_log || []}
                                    paymentStatus={sessionDetails[item.session_id].payment_status}
                                    escalationMessage={sessionDetails[item.session_id].escalation_message}
                                    guardrailCeiling={sessionDetails[item.session_id].guardrail_ceiling}
                                    chosenProduct={sessionDetails[item.session_id].chosen_product}
                                    riskScore={sessionDetails[item.session_id].risk_score}
                                    riskFeatures={sessionDetails[item.session_id].risk_features}
                                  />
                                </div>
                              ) : (
                                <div className="brutalist-text" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>Failed to load details.</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > 0 && <div className="brutalist-subtitle" style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: '#71717a', textAlign: 'right' }}>Showing {filtered.length} of {history.length} sessions</div>}
      </div>
    </div>
  );
}
