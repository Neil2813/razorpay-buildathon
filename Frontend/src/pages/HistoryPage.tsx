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
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#ffffff' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#060e26' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e4e4e7', borderTop: '3px solid #060e26', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span className="brutalist-subtitle" style={{ fontSize: '0.85rem', color: '#060e26', fontWeight: 900 }}>Loading Transaction History…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#ffffff' }}>
      <Navbar />
      <div className="container" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="brutalist-title" style={{ margin: 0, fontSize: '2.2rem', color: '#060e26', fontWeight: 900, textTransform: 'uppercase' }}>Transaction History</h2>
          <p className="brutalist-text" style={{ margin: '0.45rem 0 0 0', fontSize: '0.875rem', color: '#52525b', fontWeight: 600 }}>
            Explore past agent decisions, guardrail events, and payment outcomes logged immutably.
          </p>
        </div>

        {/* Metric Cards - Connected Mesh */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div style={{ border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px', background: '#ffffff', padding: '1.25rem' }}>
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0, color: '#060e26', fontWeight: 900 }}>Total Sessions</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', margin: '0.2rem 0 0 0', color: '#060e26' }}>{history.length}</p>
          </div>
          <div style={{ border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px', background: '#ffffff', padding: '1.25rem' }}>
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0, color: '#060e26', fontWeight: 900 }}>Successful Payments</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', color: '#10b981', margin: '0.2rem 0 0 0' }}>{totalSuccess}</p>
          </div>
          <div style={{ border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px', background: '#ffffff', padding: '1.25rem' }}>
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0, color: '#060e26', fontWeight: 900 }}>Escalated / Blocked</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', margin: '0.2rem 0 0 0', color: '#ef4444' }}>{totalEscalated}</p>
          </div>
          <div style={{ border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px', background: '#ffffff', padding: '1.25rem' }}>
            <p className="brutalist-subtitle" style={{ fontSize: '0.65rem', margin: 0, color: '#060e26', fontWeight: 900 }}>Total Audit Events</p>
            <p className="brutalist-title" style={{ fontSize: '1.75rem', color: '#060e26', margin: '0.2rem 0 0 0' }}>{totalAudit}</p>
            <p className="brutalist-text" style={{ fontSize: '0.74rem', color: '#52525b', margin: 0, fontWeight: 600 }}>Across all sessions</p>
          </div>
        </div>

        {/* Ledger Console Board Wrapper */}
        <div style={{ border: '2px solid #060e26', boxShadow: '4px 4px 0px #060e26', borderRadius: '0px', background: '#ffffff', overflow: 'hidden' }}>
          
          {/* Toolbar Header Row */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '2px solid #060e26', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#060e26', fontWeight: 900 }}>Status Filters:</span>
              {STATUS_FILTERS.map(s => {
                const isActive = filterStatus === s;
                return (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    style={{ cursor: 'pointer', padding: '0.35rem 0.85rem', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.75rem', fontWeight: 800, border: '1.5px solid #060e26', background: isActive ? '#060e26' : '#ffffff', color: isActive ? '#ffffff' : '#060e26', borderRadius: '0px', boxShadow: isActive ? '2px 2px 0px #060e26' : 'none', transition: 'all 0.1s' }}>
                    {s}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input type="text" placeholder="Search intent or SKU…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ minWidth: '250px', padding: '0.55rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
              <button onClick={() => navigate('/checkout')} style={{ padding: '0.65rem 1.15rem', fontSize: '0.78rem', whiteSpace: 'nowrap', background: '#060e26', color: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}>
                + New Transaction
              </button>
            </div>
          </div>

          {/* Table Ledger Grid */}
          {filtered.length === 0 ? (
            <div className="brutalist-text" style={{ textAlign: 'center', padding: '4rem 1rem', color: '#52525b' }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#060e26' }}>
                {history.length === 0 ? 'No transaction history yet.' : 'No matching transactions.'}
              </p>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                {history.length === 0 ? 'Head to the Checkout Cockpit and run your first transaction.' : 'Try adjusting your search or status filter.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #060e26', background: '#060e26', color: '#ffffff' }}>
                    {['Buyer Intent','Chosen Product','Status','Audit Events','Time'].map(h => (
                      <th key={h} className="brutalist-subtitle" style={{ padding: '0.85rem 1.25rem', fontSize: '0.7rem', whiteSpace: 'nowrap', color: '#ffffff', fontWeight: 800, letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const isSuccess = item.payment_status === 'success';
                    const isEscalated = item.payment_status === 'escalated';
                    const isExpanded = expandedSessionId === item.session_id;
                    const rowBg = isExpanded ? '#f6f1e5' : (idx % 2 === 0 ? '#ffffff' : '#f6f1e5');
                    return (
                      <React.Fragment key={item.session_id}>
                        <tr style={{ borderBottom: '1px solid #e4e4e7', cursor: 'pointer', background: rowBg, transition: 'background 0.15s' }}
                          onClick={() => handleRowClick(item.session_id)}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#e4e4e7' }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = rowBg }}>
                          <td className="brutalist-text" style={{ padding: '0.85rem 1.25rem', color: '#060e26', maxWidth: '260px' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>{item.user_message}</div>
                            {item.escalation_message && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem', fontWeight: 600 }}>{item.escalation_message}</div>}
                          </td>
                          <td className="brutalist-text" style={{ padding: '0.85rem 1.25rem', color: '#060e26', whiteSpace: 'nowrap' }}>
                            {item.chosen_product ? (
                              <div>
                                <div style={{ fontWeight: 800, color: '#060e26', fontSize: '0.82rem' }}>{item.chosen_product.name || item.chosen_product.product_id}</div>
                                <div className="brutalist-title" style={{ fontSize: '0.8rem', color: '#060e26', fontWeight: 900 }}>&#8377;{item.chosen_product.price?.toLocaleString()}</div>
                              </div>
                            ) : <span style={{ color: '#a1a1aa', fontWeight: 600 }}>—</span>}
                          </td>
                          <td style={{ padding: '0.85rem 1.25rem' }}>
                            <span style={{ padding: '0.25rem 0.65rem', border: '1.5px solid #060e26', background: isSuccess ? '#dcfce7' : isEscalated ? '#fee2e2' : '#ffffff', color: '#060e26', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', boxShadow: '2px 2px 0px #060e26', display: 'inline-block' }}>{item.payment_status}</span>
                          </td>
                          <td className="brutalist-text" style={{ padding: '0.85rem 1.25rem', color: '#060e26' }}>
                            <span style={{ fontWeight: 900 }}>{item.audit_count}</span>
                            <span style={{ color: '#52525b', fontWeight: 600 }}> events</span>
                          </td>
                          <td className="brutalist-mono" style={{ padding: '0.85rem 1.25rem', color: '#52525b', fontSize: '0.75rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent'}
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr style={{ borderBottom: '1px solid #e4e4e7', background: '#ffffff' }}>
                            <td colSpan={5} style={{ padding: '0 1.25rem 1.5rem 1.25rem' }}>
                              {loadingDetails[item.session_id] ? (
                                <div className="brutalist-text" style={{ padding: '2rem', textAlign: 'center', color: '#52525b', fontWeight: 600 }}>
                                  <div style={{ width: '24px', height: '24px', border: '3px solid #e4e4e7', borderTop: '3px solid #060e26', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.5rem auto' }} />
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
                                <div className="brutalist-text" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>Failed to load details.</div>
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
        {filtered.length > 0 && <div className="brutalist-subtitle" style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: '#52525b', textAlign: 'right', fontWeight: 800 }}>Showing {filtered.length} of {history.length} sessions</div>}
      </div>
    </div>
  );
}
