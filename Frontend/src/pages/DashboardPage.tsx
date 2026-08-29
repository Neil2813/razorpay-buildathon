import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Tag, MapPin, Truck, Plus, Trash2, Save, ShoppingBag, ShieldAlert, Bot, Zap, ShieldCheck, Globe, CheckCircle, Copy, TrendingUp, AlertTriangle, BarChart2, Sparkles, Lock } from 'lucide-react';

interface SkuPerformance {
  product_id: string; name: string; price: number; evaluated_count: number; selected_count: number;
  acceptance_rate_percent: number; rejection_rate_percent: number; has_return_policy: boolean;
  primary_rejection_reason: string; recommendation: string;
}

interface FunnelStage { stage: string; count: number; pct: number; }

interface InsightsData {
  // Legacy fields
  transaction_event_count: number; payment_success_count: number; payment_attempt_count: number;
  acceptance_rate_with_policy_pct: number; acceptance_rate_without_policy_pct: number;
  top_escalation_reasons: Record<string, number>; sku_performance: SkuPerformance[];
  revenue_insights: string[]; summary: string; sample_size_note: string;
  // New: conversion
  conversion_rate_pct: number;
  avg_order_value_inr: number;
  effective_aov_inr: number;
  // New: upsell
  upsell_offered_count: number;
  upsell_trigger_rate_pct: number;
  avg_revenue_lift_inr: number;
  total_revenue_lift_inr: number;
  avg_upsell_discount_pct: number;
  // New: ceiling
  ceiling_hit_count: number;
  ceiling_pass_count: number;
  ceiling_hit_rate_pct: number;
  // New: risk
  avg_risk_score: number;
  high_risk_rate_pct: number;
  risk_events_count: number;
  // New: funnel
  conversion_funnel: FunnelStage[];
}


export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'insights' | 'setup' | 'protocol'>('insights');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Merchant settings / setup state
  const [companyName, setCompanyName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', line1: '', city: '', state: '', pincode: '' });

  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [newZone, setNewZone] = useState({ coverage_type: 'state', coverage_value: '', shipping_fee: 0, delivery_days: 3 });

  const [products, setProducts] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: 0, category: 'shoe', color: 'black', sizes: '', return_policy: '', delivery_time_days: 3, rating: 4.5 });

  const [inventory, setInventory] = useState<any[]>([]);
  const [newInventory, setNewInventory] = useState({ warehouse_id: '', product_id: '', quantity: 0 });

  const [ceiling, setCeiling] = useState<number | ''>('');
  const [ceilingSaved, setCeilingSaved] = useState(false);

  const loadAllData = async () => {
    if (!user) return;
    try {
      const [insRes, setupRes, prodRes, invRes] = await Promise.all([
        api.get(`/transaction/insights/${user.tenant_id}`),
        api.get('/commerce/merchant/setup'),
        api.get('/commerce/merchant/products'),
        api.get('/commerce/merchant/inventory')
      ]);
      setInsights(insRes.insights);
      
      const m = setupRes.merchant || {};
      setCompanyName(m.company_name || m.name || '');
      setSupportEmail(m.support_email || '');
      setSupportPhone(m.support_phone || '');
      setRazorpayKeyId(m.razorpay_key_id || '');
      setRazorpayKeySecret(m.razorpay_key_secret || '');
      setCeiling(m.unattended_spend_ceiling || 5000.0);

      setWarehouses(setupRes.warehouses || []);
      setDeliveryZones(setupRes.delivery_zones || []);
      setProducts(prodRes.products || []);
      setInventory(invRes.inventory || []);

      if (setupRes.warehouses?.length > 0 && prodRes.products?.length > 0) {
        setNewInventory(prev => ({
          ...prev,
          warehouse_id: prev.warehouse_id || setupRes.warehouses[0].warehouse_id,
          product_id: prev.product_id || prodRes.products[0].product_id,
          quantity: prev.quantity || 10
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'merchant_admin') { navigate('/checkout'); return; }
    loadAllData();
  }, [user, navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/commerce/merchant/profile', {
        company_name: companyName,
        support_email: supportEmail || null,
        support_phone: supportPhone || null,
        razorpay_key_id: razorpayKeyId || null,
        razorpay_key_secret: razorpayKeySecret || null
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
      loadAllData();
    } catch {
      alert('Failed to update company profile');
    }
  };

  const handleUpdateCeiling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ceiling) return;
    try {
      await api.patch('/profile/tenant', { unattended_spend_ceiling: Number(ceiling) });
      setCeilingSaved(true);
      setTimeout(() => setCeilingSaved(false), 3000);
      loadAllData();
    } catch {
      alert('Failed to update spend ceiling limit');
    }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/commerce/merchant/warehouses', newWarehouse);
      setNewWarehouse({ name: '', line1: '', city: '', state: '', pincode: '' });
      loadAllData();
    } catch {
      alert('Failed to add warehouse. PIN must be 6 digits.');
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/commerce/merchant/delivery-zones', newZone);
      setNewZone({ coverage_type: 'state', coverage_value: '', shipping_fee: 0, delivery_days: 3 });
      loadAllData();
    } catch {
      alert('Failed to add delivery zone.');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sizesArray = newProduct.sizes.split(',').map(s => s.trim()).filter(Boolean);
      await api.post('/commerce/merchant/products', {
        ...newProduct,
        sizes: sizesArray
      });
      setNewProduct({ name: '', description: '', price: 0, category: 'shoe', color: 'black', sizes: '', return_policy: '', delivery_time_days: 3, rating: 4.5 });
      loadAllData();
    } catch {
      alert('Failed to add product.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/commerce/merchant/products/${productId}`);
      loadAllData();
    } catch {
      alert('Failed to delete product.');
    }
  };

  const handleUpdateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/commerce/merchant/inventory', newInventory);
      loadAllData();
    } catch {
      alert('Failed to set warehouse stock levels.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#71717a' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e4e4e7', borderTop: '3px solid #0044ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span className="brutalist-subtitle" style={{ fontSize: '0.85rem' }}>Loading Merchant Console…</span>
        </div>
      </div>
    );
  }



  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />
      <div className="container" style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="minimal-pill minimal-pill-primary" style={{ marginBottom: '0.75rem', padding: '0.25rem 0.75rem' }}>
            Merchant Control Dashboard
          </div>
          <h2 className="brutalist-title" style={{ margin: 0, fontSize: '2rem', color: '#111111' }}>{companyName || 'Glassbox Merchant Console'}</h2>
          <p className="brutalist-text" style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: '#71717a' }}>
            Console Identifier: <strong style={{ color: '#111111' }}>{user?.tenant_id}</strong> · Support: {supportEmail || 'None'} ({supportPhone || 'None'})
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #111111', marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveTab('insights')}
            style={{
              padding: '0.65rem 1.25rem',
              background: activeTab === 'insights' ? '#ffffff' : 'transparent',
              border: activeTab === 'insights' ? '1px solid #111111' : 'none',
              borderBottom: activeTab === 'insights' ? '1px solid #ffffff' : 'none',
              marginBottom: '-1px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: activeTab === 'insights' ? '#0044ff' : '#71717a',
              fontFamily: 'Space Grotesk',
              borderRadius: '2px 2px 0 0'
            }}
          >
            AI Buyer Readiness Insights
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            style={{
              padding: '0.65rem 1.25rem',
              background: activeTab === 'setup' ? '#ffffff' : 'transparent',
              border: activeTab === 'setup' ? '1px solid #111111' : 'none',
              borderBottom: activeTab === 'setup' ? '1px solid #ffffff' : 'none',
              marginBottom: '-1px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: activeTab === 'setup' ? '#0044ff' : '#71717a',
              fontFamily: 'Space Grotesk',
              borderRadius: '2px 2px 0 0'
            }}
          >
            Merchant Configuration
          </button>
          <button
            onClick={() => setActiveTab('protocol')}
            style={{
              padding: '0.65rem 1.25rem',
              background: activeTab === 'protocol' ? '#ffffff' : 'transparent',
              border: activeTab === 'protocol' ? '1px solid #111111' : 'none',
              borderBottom: activeTab === 'protocol' ? '1px solid #ffffff' : 'none',
              marginBottom: '-1px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: activeTab === 'protocol' ? '#7c3aed' : '#71717a',
              fontFamily: 'Space Grotesk',
              borderRadius: '2px 2px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Bot size={13} /> Agent Protocol
          </button>
        </div>

        {activeTab === 'insights' ? (
          <>
            {/* ── Hero KPI Strip ───────────────────────────────────────────── */}
            {insights && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', marginBottom: '2rem', border: '1px solid #111111', borderRadius: '2px', overflow: 'hidden', background: '#111111' }}>
                  {[
                    {
                      label: 'AI Conversion Rate', value: `${insights.conversion_rate_pct}%`,
                      sub: `${insights.payment_success_count} of ${insights.payment_attempt_count} attempts`,
                      color: '#0044ff', icon: <TrendingUp size={14} />
                    },
                    {
                      label: 'Avg Order Value', value: `₹${(insights.avg_order_value_inr || 0).toLocaleString()}`,
                      sub: `Effective AOV ₹${(insights.effective_aov_inr || 0).toLocaleString()} w/ upsells`,
                      color: '#059669', icon: <BarChart2 size={14} />
                    },
                    {
                      label: 'Total Upsell Revenue Lift', value: `₹${(insights.total_revenue_lift_inr || 0).toLocaleString()}`,
                      sub: `${insights.upsell_offered_count} upsell(s) at avg ${insights.avg_upsell_discount_pct}% off`,
                      color: '#7c3aed', icon: <Sparkles size={14} />
                    },
                    {
                      label: 'Ceiling Hit Rate', value: `${insights.ceiling_hit_rate_pct}%`,
                      sub: `${insights.ceiling_hit_count} blocked of ${insights.ceiling_hit_count + insights.ceiling_pass_count}`,
                      color: insights.ceiling_hit_rate_pct > 30 ? '#ef4444' : '#f59e0b', icon: <Lock size={14} />
                    },
                    {
                      label: 'Policy Acceptance Gap', value: `+${Math.max(0, insights.acceptance_rate_with_policy_pct - insights.acceptance_rate_without_policy_pct).toFixed(0)}%`,
                      sub: `${insights.acceptance_rate_with_policy_pct}% with policy vs ${insights.acceptance_rate_without_policy_pct}% without`,
                      color: '#0891b2', icon: <ShieldCheck size={14} />
                    },
                    {
                      label: 'Total Agent Events', value: `${insights.transaction_event_count}`,
                      sub: insights.sample_size_note,
                      color: '#71717a', icon: <Zap size={14} />
                    },
                  ].map((m, i) => (
                    <div key={i} style={{ background: '#ffffff', padding: '1.25rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: m.color }}>
                        {m.icon}
                        <span className="brutalist-subtitle" style={{ fontSize: '0.62rem', color: '#71717a' }}>{m.label.toUpperCase()}</span>
                      </div>
                      <div className="brutalist-title" style={{ fontSize: '1.65rem', color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                      <div className="brutalist-text" style={{ fontSize: '0.68rem', color: '#71717a', lineHeight: 1.35 }}>{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── Main Analytics Grid ───────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1px', background: '#111111', border: '1px solid #111111', borderRadius: '2px', overflow: 'hidden', marginBottom: '1px' }}>

                  {/* Left: Executive Summary + Conversion Funnel + Upsell ─── */}
                  <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>

                    {/* Summary */}
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #e4e4e7' }}>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', color: '#0044ff', marginBottom: '0.4rem' }}>[01 // AI EXECUTIVE SUMMARY]</div>
                      <div className="brutalist-text" style={{ background: '#faf9f6', borderLeft: '4px solid #0044ff', padding: '0.85rem 1.1rem', fontSize: '0.875rem', color: '#111111', lineHeight: 1.55 }}>
                        {insights.summary || 'No transaction evaluation history recorded yet.'}
                      </div>
                    </div>

                    {/* Conversion Funnel */}
                    {insights.conversion_funnel && insights.conversion_funnel.length > 0 && (
                      <div style={{ padding: '1.5rem', borderBottom: '1px solid #e4e4e7' }}>
                        <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', marginBottom: '0.75rem' }}>[02 // AI BUYER CONVERSION FUNNEL]</div>
                        <h3 className="brutalist-title" style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Stage-by-Stage Drop-off</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {insights.conversion_funnel.map((stage, i) => {
                            const maxPct = 100;
                            const pct = stage.pct;
                            const barColor = i === 0 ? '#0044ff' : pct >= 60 ? '#059669' : pct >= 30 ? '#f59e0b' : '#ef4444';
                            return (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 60px', gap: '0.75rem', alignItems: 'center' }}>
                                <div className="brutalist-text" style={{ fontSize: '0.75rem', color: '#111111', fontWeight: i === 0 ? 700 : 400 }}>{stage.stage}</div>
                                <div style={{ height: '10px', background: '#f4f4f5', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                                  <div style={{ height: '100%', width: `${(pct / maxPct) * 100}%`, background: barColor, borderRadius: '2px', transition: 'width 0.6s ease' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <span className="brutalist-title" style={{ fontSize: '0.82rem', color: barColor }}>{pct}%</span>
                                  <span className="brutalist-mono" style={{ fontSize: '0.62rem', color: '#71717a' }}>({stage.count})</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Upsell Analytics */}
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #e4e4e7' }}>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', color: '#7c3aed', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Sparkles size={11} /> [03 // REVENUE GROWTH ENGINE — UPSELL ANALYTICS]
                      </div>
                      <h3 className="brutalist-title" style={{ margin: '0 0 0.85rem 0', fontSize: '1.1rem' }}>Dynamic Upsell & Cross-Sell Performance</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1px', background: '#e4e4e7', border: '1px solid #e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                        {[
                          { label: 'Upsell Triggers', value: insights.upsell_offered_count, unit: 'sessions', color: '#7c3aed' },
                          { label: 'Trigger Rate', value: `${insights.upsell_trigger_rate_pct}%`, unit: 'of guardrail passes', color: '#7c3aed' },
                          { label: 'Avg Revenue Lift', value: `₹${(insights.avg_revenue_lift_inr || 0).toLocaleString()}`, unit: 'per upsell', color: '#059669' },
                          { label: 'Total Lift Generated', value: `₹${(insights.total_revenue_lift_inr || 0).toLocaleString()}`, unit: 'across all sessions', color: '#059669' },
                          { label: 'Avg Bundle Discount', value: `${insights.avg_upsell_discount_pct}%`, unit: 'dynamic discount applied', color: '#f59e0b' },
                        ].map((m, i) => (
                          <div key={i} style={{ background: '#ffffff', padding: '0.85rem 1rem' }}>
                            <div className="brutalist-subtitle" style={{ fontSize: '0.6rem', color: '#71717a', marginBottom: '0.2rem' }}>{m.label.toUpperCase()}</div>
                            <div className="brutalist-title" style={{ fontSize: '1.35rem', color: m.color }}>{m.value}</div>
                            <div className="brutalist-text" style={{ fontSize: '0.65rem', color: '#71717a', marginTop: '0.1rem' }}>{m.unit}</div>
                          </div>
                        ))}
                      </div>
                      {insights.upsell_offered_count === 0 && (
                        <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: '#faf9f6', border: '1px solid #e4e4e7', borderRadius: '2px', fontSize: '0.78rem', color: '#71717a' }}>
                          No upsell events yet. Run a checkout with budget headroom below the spend ceiling to trigger the engine.
                        </div>
                      )}
                    </div>

                    {/* Actionable Insights */}
                    {insights.revenue_insights && insights.revenue_insights.length > 0 && (
                      <div style={{ padding: '1.5rem' }}>
                        <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', marginBottom: '0.75rem' }}>[04 // ACTIONABLE REVENUE RECOMMENDATIONS]</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {insights.revenue_insights.map((ins, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.65rem 0.85rem', background: '#faf9f6', border: '1px solid #e4e4e7', borderLeft: '3px solid #0044ff', borderRadius: '2px' }}>
                              <TrendingUp size={13} color="#0044ff" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                              <span className="brutalist-text" style={{ fontSize: '0.82rem', color: '#111111', lineHeight: 1.5 }}>{ins}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Controls + Decline Reasons + Risk + Ceiling ───── */}
                  <div style={{ background: '#faf9f6', display: 'flex', flexDirection: 'column' }}>

                    {/* Spend Ceiling */}
                    <div style={{ padding: '1.35rem', borderBottom: '1px solid #e4e4e7' }}>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Lock size={11} /> [GUARDRAIL // SPEND CEILING]
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.85rem' }}>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem' }}>
                          <div className="brutalist-subtitle" style={{ fontSize: '0.58rem', color: '#71717a' }}>CEILING PASSES</div>
                          <div className="brutalist-title" style={{ fontSize: '1.25rem', color: '#059669' }}>{insights.ceiling_pass_count}</div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem' }}>
                          <div className="brutalist-subtitle" style={{ fontSize: '0.58rem', color: '#71717a' }}>CEILING BLOCKS</div>
                          <div className="brutalist-title" style={{ fontSize: '1.25rem', color: insights.ceiling_hit_count > 0 ? '#ef4444' : '#111111' }}>{insights.ceiling_hit_count}</div>
                        </div>
                      </div>
                      {ceilingSaved && <span className="minimal-pill minimal-pill-success" style={{ marginBottom: '0.5rem', display: 'inline-flex' }}>Ceiling updated</span>}
                      <form onSubmit={handleUpdateCeiling} style={{ display: 'flex', gap: '0.45rem' }}>
                        <input type="number" placeholder="₹5000" value={ceiling} onChange={e => setCeiling(Number(e.target.value) || '')} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem', flex: 1 }} />
                        <button type="submit" className="minimal-btn minimal-btn-primary" style={{ fontSize: '0.72rem', padding: '0.45rem 0.75rem' }}>Save Limit</button>
                      </form>
                    </div>

                    {/* Risk Analytics */}
                    <div style={{ padding: '1.35rem', borderBottom: '1px solid #e4e4e7' }}>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <ShieldAlert size={11} color="#ef4444" /> [RISK // ML ENGINE ANALYTICS]
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem' }}>
                          <div className="brutalist-subtitle" style={{ fontSize: '0.58rem', color: '#71717a' }}>AVG RISK SCORE</div>
                          <div className="brutalist-title" style={{ fontSize: '1.25rem', color: (insights.avg_risk_score || 0) > 0.5 ? '#ef4444' : '#059669' }}>{(insights.avg_risk_score || 0).toFixed(3)}</div>
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem' }}>
                          <div className="brutalist-subtitle" style={{ fontSize: '0.58rem', color: '#71717a' }}>HIGH-RISK RATE</div>
                          <div className="brutalist-title" style={{ fontSize: '1.25rem', color: (insights.high_risk_rate_pct || 0) > 10 ? '#ef4444' : '#059669' }}>{insights.high_risk_rate_pct || 0}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Top Escalation Reasons */}
                    <div style={{ padding: '1.35rem', borderBottom: '1px solid #e4e4e7' }}>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <AlertTriangle size={11} color="#f59e0b" /> [ANALYSIS // TOP DECLINE REASONS]
                      </div>
                      {!insights.top_escalation_reasons || Object.keys(insights.top_escalation_reasons).length === 0 ? (
                        <p className="brutalist-text" style={{ margin: 0, fontSize: '0.78rem', color: '#71717a' }}>No escalations logged yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {Object.entries(insights.top_escalation_reasons).map(([reason, count]) => (
                            <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.6rem', borderRadius: '2px', border: '1px solid #e4e4e7', background: '#ffffff' }}>
                              <span className="brutalist-text" style={{ fontSize: '0.73rem', color: '#111111', fontWeight: 500, lineHeight: 1.35, flex: 1, marginRight: '0.5rem' }}>{reason}</span>
                              <span className="minimal-pill minimal-pill-danger" style={{ flexShrink: 0 }}>{String(count)}×</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Policy Acceptance Impact */}
                    <div style={{ padding: '1.35rem' }}>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', marginBottom: '0.5rem' }}>[INTELLIGENCE // POLICY IMPACT]</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[{ label: 'With Return Policy', pct: insights.acceptance_rate_with_policy_pct, color: '#0044ff' },
                          { label: 'Without Return Policy', pct: insights.acceptance_rate_without_policy_pct, color: '#71717a' }].map(r => (
                          <div key={r.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span className="brutalist-text" style={{ fontSize: '0.73rem', color: '#111111' }}>{r.label}</span>
                              <span className="brutalist-title" style={{ fontSize: '0.85rem', color: r.color }}>{r.pct}%</span>
                            </div>
                            <div style={{ height: '8px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: '2px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SKU Performance Table ─────────────────────────────────── */}
                <div style={{ border: '1px solid #111111', borderTop: 'none', borderRadius: '0 0 2px 2px', background: '#ffffff', overflow: 'hidden' }}>
                  <div style={{ padding: '1.35rem 1.75rem', borderBottom: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.62rem', marginBottom: '0.2rem' }}>[05 // SKU PERFORMANCE METRICS]</div>
                      <h3 className="brutalist-title" style={{ margin: 0, fontSize: '1.1rem' }}>AI Buyer Acceptance by SKU</h3>
                    </div>
                  </div>
                  {!insights.sku_performance || insights.sku_performance.length === 0 ? (
                    <div style={{ margin: '1.75rem', textAlign: 'center', padding: '2rem 1rem', color: '#71717a', background: '#faf9f6', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
                      <p className="brutalist-text" style={{ margin: 0, fontSize: '0.875rem' }}>No catalog evaluations logged yet. Run a checkout to generate SKU data.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e4e4e7', background: '#faf9f6' }}>
                            {['SKU Name', 'Price', 'Evaluated', 'Selected', 'Acceptance Rate', 'Primary Decline Reason', 'Recommendation'].map(h => (
                              <th key={h} className="brutalist-subtitle" style={{ padding: '0.65rem 1.25rem', fontSize: '0.62rem', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {insights.sku_performance.map(sku => {
                            const accent = sku.acceptance_rate_percent >= 60 ? '#059669' : sku.acceptance_rate_percent >= 30 ? '#f59e0b' : '#ef4444';
                            return (
                              <tr key={sku.product_id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                                <td className="brutalist-text" style={{ padding: '0.7rem 1.25rem', fontWeight: 600, color: '#111111' }}>
                                  {sku.name}
                                  <div className="brutalist-mono" style={{ fontSize: '0.62rem', color: '#71717a', fontWeight: 400 }}>{sku.product_id}</div>
                                </td>
                                <td className="brutalist-text" style={{ padding: '0.7rem 1.25rem' }}>₹{sku.price.toLocaleString()}</td>
                                <td className="brutalist-text" style={{ padding: '0.7rem 1.25rem', color: '#71717a' }}>{sku.evaluated_count}</td>
                                <td className="brutalist-text" style={{ padding: '0.7rem 1.25rem', color: '#71717a' }}>{sku.selected_count}</td>
                                <td style={{ padding: '0.7rem 1.25rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="brutalist-title" style={{ color: accent, fontSize: '0.9rem' }}>{sku.acceptance_rate_percent}%</span>
                                    <div style={{ height: '6px', width: '55px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${sku.acceptance_rate_percent}%`, background: accent }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="brutalist-text" style={{ padding: '0.7rem 1.25rem', color: '#71717a', fontSize: '0.75rem' }}>{sku.primary_rejection_reason}</td>
                                <td className="brutalist-text" style={{ padding: '0.7rem 1.25rem', color: '#0044ff', fontSize: '0.75rem', lineHeight: 1.4, maxWidth: '200px' }}>{sku.recommendation}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Empty state */}
            {!insights && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#71717a', border: '1px solid #e4e4e7', borderRadius: '2px', background: '#ffffff' }}>
                <BarChart2 size={32} color="#e4e4e7" style={{ marginBottom: '1rem' }} />
                <p className="brutalist-text" style={{ margin: 0, fontSize: '0.875rem' }}>No transaction data yet. Run a checkout to generate analytics.</p>
              </div>
            )}
          </>
        ) : activeTab === 'setup' ? (
          /* Merchant Configuration Workspace */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '0px', border: '1px solid #111111', borderRadius: '2px', background: '#ffffff' }}>
            
            {/* Left Column (Products & Inventory) */}
            <div style={{ borderRight: '1px solid #111111', display: 'flex', flexDirection: 'column' }}>
              
              {/* Product Catalogue Management */}
              <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
                <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.4rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ShoppingBag size={12} /> [CATALOGUE // PRODUCT MANAGEMENT]
                </div>
                <h3 className="brutalist-title" style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Catalogue Products</h3>
                
                {/* Add Product Form */}
                <form onSubmit={handleAddProduct} style={{ background: '#faf9f6', padding: '1rem', border: '1px solid #e4e4e7', borderRadius: '2px', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div className="brutalist-subtitle" style={{ fontSize: '0.68rem', color: '#111111' }}>Create New Product Listing</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="text" placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                    <input type="number" placeholder="Price (₹)" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value) || 0})} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem', background: '#ffffff' }}>
                      <option value="shoe">Shoe</option>
                      <option value="shirt">Shirt</option>
                      <option value="pants">Pants</option>
                      <option value="hat">Hat</option>
                    </select>
                    <input type="text" placeholder="Colour" value={newProduct.color} onChange={e => setNewProduct({...newProduct, color: e.target.value})} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="text" placeholder="Sizes (comma separated, e.g. S, M, L)" value={newProduct.sizes} onChange={e => setNewProduct({...newProduct, sizes: e.target.value})} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                    <input type="number" placeholder="Delivery timeline (days)" value={newProduct.delivery_time_days || ''} onChange={e => setNewProduct({...newProduct, delivery_time_days: Number(e.target.value) || 3})} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                  </div>
                  <input type="text" placeholder="Return Policy Text (e.g. Return within 30 days)" value={newProduct.return_policy} onChange={e => setNewProduct({...newProduct, return_policy: e.target.value})} className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                  <textarea placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem', height: '50px', resize: 'none' }} />
                  
                  <button type="submit" className="minimal-btn minimal-btn-primary" style={{ fontSize: '0.75rem', padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    <Plus size={13} /> Add Product to Catalogue
                  </button>
                </form>

                {/* Products List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {products.map(p => (
                    <div key={p.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
                      <div>
                        <div className="brutalist-text" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111111' }}>{p.name}</div>
                        <div className="brutalist-mono" style={{ fontSize: '0.68rem', color: '#71717a', marginTop: '0.15rem' }}>
                          ID: {p.product_id} · ₹{p.price} · Category: {p.category} · Colour: {p.color} · Sizes: {p.sizes?.join(', ')}
                        </div>
                        {p.return_policy ? (
                          <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '0.2rem' }}>Policy: {p.return_policy}</div>
                        ) : (
                          <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ShieldAlert size={10} /> No return policy configured (Low AI Acceptance)
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleDeleteProduct(p.product_id)} className="minimal-btn minimal-btn-danger" style={{ padding: '0.35rem', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warehouse Inventory Stock Allocation */}
              <div style={{ padding: '1.75rem' }}>
                <div className="brutalist-subtitle" style={{ color: '#0044ff', marginBottom: '0.4rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Tag size={12} /> [INVENTORY // WAREHOUSE STOCK LEVEL]
                </div>
                <h3 className="brutalist-title" style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Warehouse Inventory Stock</h3>

                {warehouses.length > 0 && products.length > 0 ? (
                  <form onSubmit={handleUpdateInventory} style={{ background: '#faf9f6', padding: '1rem', border: '1px solid #e4e4e7', borderRadius: '2px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#111111', marginRight: '0.25rem' }}>Set Stock:</div>
                    <select value={newInventory.warehouse_id} onChange={e => setNewInventory({...newInventory, warehouse_id: e.target.value})} className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem', background: '#ffffff', flex: 1, minWidth: '110px' }}>
                      {warehouses.map((w: any) => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>
                      ))}
                    </select>
                    <select value={newInventory.product_id} onChange={e => setNewInventory({...newInventory, product_id: e.target.value})} className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem', background: '#ffffff', flex: 1, minWidth: '110px' }}>
                      {products.map((p: any) => (
                        <option key={p.product_id} value={p.product_id}>{p.name}</option>
                      ))}
                    </select>
                    <input type="number" placeholder="Qty" value={newInventory.quantity || ''} onChange={e => setNewInventory({...newInventory, quantity: Number(e.target.value) || 0})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem', width: '60px' }} />
                    <button type="submit" className="minimal-btn minimal-btn-primary" style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>
                      Update Stock
                    </button>
                  </form>
                ) : (
                  <p className="brutalist-text" style={{ fontSize: '0.78rem', color: '#71717a', margin: '0 0 1.5rem 0' }}>Add warehouses and catalogue products to manage stock levels.</p>
                )}

                {/* Stock Table */}
                {inventory.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e4e4e7', background: '#faf9f6' }}>
                          <th className="brutalist-subtitle" style={{ padding: '0.5rem 1rem', fontSize: '0.62rem' }}>Warehouse</th>
                          <th className="brutalist-subtitle" style={{ padding: '0.5rem 1rem', fontSize: '0.62rem' }}>Product SKU</th>
                          <th className="brutalist-subtitle" style={{ padding: '0.5rem 1rem', fontSize: '0.62rem', textAlign: 'right' }}>Stock Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map((inv, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e4e4e7' }}>
                            <td className="brutalist-text" style={{ padding: '0.5rem 1rem', fontWeight: 600 }}>{inv.warehouse_name}</td>
                            <td className="brutalist-text" style={{ padding: '0.5rem 1rem', color: '#71717a' }}>{inv.product_name} <span className="brutalist-mono" style={{ fontSize: '0.65rem' }}>({inv.product_id})</span></td>
                            <td className="brutalist-text" style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 700, color: inv.quantity > 0 ? '#111111' : '#ef4444' }}>
                              {inv.quantity > 0 ? `${inv.quantity} units` : 'Out of Stock'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column (Profile, Warehouses & Delivery Zones) */}
            <div style={{ background: '#faf9f6', display: 'flex', flexDirection: 'column' }}>
              
              {/* Profile Config */}
              <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
                <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem' }}>[CONFIG // PROFILE & CEILING]</div>
                <h3 className="brutalist-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>Merchant profile</h3>
                
                {profileSaved && (
                  <span className="minimal-pill minimal-pill-success" style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>
                    Profile details updated
                  </span>
                )}
                
                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input type="text" placeholder="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                  <input type="email" placeholder="Support Email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                  <input type="tel" placeholder="Support Phone" value={supportPhone} onChange={e => setSupportPhone(e.target.value)} className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                  
                  <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="brutalist-subtitle" style={{ fontSize: '0.65rem', color: '#0044ff' }}>Razorpay Test Gateway Credentials</div>
                    <input type="text" placeholder="Razorpay Key ID (rzp_test_...)" value={razorpayKeyId} onChange={e => setRazorpayKeyId(e.target.value)} className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                    <input type="password" placeholder="Razorpay Key Secret" value={razorpayKeySecret} onChange={e => setRazorpayKeySecret(e.target.value)} className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                  </div>

                  <button type="submit" className="minimal-btn minimal-btn-primary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <Save size={12} /> Save Merchant Profile & Credentials
                  </button>
                </form>

                {/* Ceiling Limit */}
                <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '1rem' }}>
                  <div className="brutalist-subtitle" style={{ fontSize: '0.65rem', marginBottom: '0.35rem' }}>Spend ceiling guardrail</div>
                  {ceilingSaved && (
                    <span className="minimal-pill minimal-pill-success" style={{ marginBottom: '0.5rem', display: 'inline-flex' }}>
                      Spend limit ceiling updated
                    </span>
                  )}
                  <form onSubmit={handleUpdateCeiling} style={{ display: 'flex', gap: '0.45rem' }}>
                    <input type="number" placeholder="₹5000" value={ceiling} onChange={e => setCeiling(Number(e.target.value) || '')} required className="minimal-input" style={{ fontSize: '0.8rem', padding: '0.4rem', flex: 1 }} />
                    <button type="submit" className="minimal-btn minimal-btn-primary" style={{ fontSize: '0.72rem', padding: '0.45rem 0.75rem' }}>Save Limit</button>
                  </form>
                </div>
              </div>

              {/* Warehouse Locations */}
              <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7' }}>
                <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={12} /> [CONFIG // WAREHOUSES]
                </div>
                <h3 className="brutalist-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>Warehouses</h3>
                
                {/* Add Warehouse Form */}
                <form onSubmit={handleAddWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.25rem' }}>
                  <input type="text" placeholder="Warehouse Name" value={newWarehouse.name} onChange={e => setNewWarehouse({...newWarehouse, name: e.target.value})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                  <input type="text" placeholder="Line 1 Address" value={newWarehouse.line1} onChange={e => setNewWarehouse({...newWarehouse, line1: e.target.value})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <input type="text" placeholder="City" value={newWarehouse.city} onChange={e => setNewWarehouse({...newWarehouse, city: e.target.value})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                    <input type="text" placeholder="State" value={newWarehouse.state} onChange={e => setNewWarehouse({...newWarehouse, state: e.target.value})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                  </div>
                  <input type="text" placeholder="PIN Code (6 digits)" value={newWarehouse.pincode} onChange={e => setNewWarehouse({...newWarehouse, pincode: e.target.value})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                  <button type="submit" className="minimal-btn minimal-btn-primary" style={{ width: '100%', fontSize: '0.72rem', padding: '0.4rem' }}>
                    + Create Warehouse
                  </button>
                </form>

                {/* Warehouse List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {warehouses.map((w: any) => (
                    <div key={w.warehouse_id} style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '2px', border: '1px solid #e4e4e7', fontSize: '0.75rem' }}>
                      <span className="brutalist-text" style={{ fontWeight: 700, color: '#111111' }}>{w.name}</span>
                      <div style={{ color: '#71717a', fontSize: '0.68rem', marginTop: '0.15rem' }}>{w.line1}, {w.city}, {w.state} - {w.pincode}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery zones */}
              <div style={{ padding: '1.75rem' }}>
                <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Truck size={12} /> [CONFIG // DELIVERY COVERAGE]
                </div>
                <h3 className="brutalist-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>Delivery Coverage</h3>

                {/* Add Zone Form */}
                <form onSubmit={handleAddZone} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.25rem' }}>
                  <select value={newZone.coverage_type} onChange={e => setNewZone({...newZone, coverage_type: e.target.value})} className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem', background: '#ffffff' }}>
                    <option value="all_india">All India</option>
                    <option value="state">State Limit</option>
                    <option value="city">City Limit</option>
                    <option value="pincode">Pincode Limit</option>
                  </select>
                  {newZone.coverage_type !== 'all_india' && (
                    <input type="text" placeholder="Coverage Value (e.g. Karnataka / Bengaluru / 560001)" value={newZone.coverage_value} onChange={e => setNewZone({...newZone, coverage_value: e.target.value})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <input type="number" placeholder="Fee (₹)" value={newZone.shipping_fee || ''} onChange={e => setNewZone({...newZone, shipping_fee: Number(e.target.value) || 0})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                    <input type="number" placeholder="Days" value={newZone.delivery_days || ''} onChange={e => setNewZone({...newZone, delivery_days: Number(e.target.value) || 1})} required className="minimal-input" style={{ fontSize: '0.75rem', padding: '0.35rem' }} />
                  </div>
                  <button type="submit" className="minimal-btn minimal-btn-primary" style={{ width: '100%', fontSize: '0.72rem', padding: '0.4rem' }}>
                    + Create Delivery Zone
                  </button>
                </form>

                {/* Zone List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {deliveryZones.map((z: any) => (
                    <div key={z.zone_id} style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '2px', border: '1px solid #e4e4e7', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span className="brutalist-text" style={{ fontWeight: 700, color: '#111111', textTransform: 'capitalize' }}>{z.coverage_type.replace('_', ' ')}</span>
                        <div style={{ color: '#71717a', fontSize: '0.68rem', marginTop: '0.15rem' }}>Scope: {z.coverage_value}</div>
                      </div>
                      <span className="minimal-pill minimal-pill-primary" style={{ fontSize: '0.65rem' }}>
                        ₹{z.shipping_fee} · {z.delivery_days} days
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* Agent Protocol Readiness Panel */
          <div style={{ border: '1px solid #111111', borderRadius: '2px', background: '#ffffff', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '1.75rem', borderBottom: '1px solid #e4e4e7', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' }}>
              <div className="brutalist-subtitle" style={{ color: '#7c3aed', marginBottom: '0.4rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Bot size={12} /> [UAP // ACP // AP2 // x402] AGENT COMMERCE PROTOCOL
              </div>
              <h3 className="brutalist-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: '#111111' }}>
                AI Buyer Discoverability
              </h3>
              <p className="brutalist-text" style={{ margin: 0, fontSize: '0.875rem', color: '#71717a', lineHeight: 1.55 }}>
                Your merchant is now transactable by AI buyer agents. The endpoints below implement the UAP-1.0, ACP-2024, AP2-draft and x402-preview standards — any compliant AI agent can discover your catalog, spend controls, and payment rails without human intervention.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: '400px' }}>

              {/* Left: Endpoint URLs */}
              <div style={{ padding: '1.75rem', borderRight: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Status badges */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                  {[
                    { label: 'UAP-1.0', color: '#7c3aed' },
                    { label: 'ACP-2024', color: '#0044ff' },
                    { label: 'AP2-draft', color: '#0891b2' },
                    { label: 'x402-preview', color: '#059669' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.85rem', border: `1px solid ${s.color}20`, borderRadius: '2px', background: `${s.color}08` }}>
                      <CheckCircle size={13} color={s.color} />
                      <span className="brutalist-subtitle" style={{ fontSize: '0.68rem', color: s.color }}>{s.label} ACTIVE</span>
                    </div>
                  ))}
                </div>

                {/* Endpoint cards */}
                <div className="brutalist-subtitle" style={{ fontSize: '0.65rem', color: '#111111', marginBottom: '-0.5rem' }}>LIVE PROTOCOL ENDPOINTS</div>

                {[
                  {
                    label: '/.well-known/agent-commerce.json',
                    url: 'http://localhost:8000/.well-known/agent-commerce.json',
                    desc: 'Root UAP manifest — AI buyer agents crawl this to discover all capabilities.',
                    icon: <Globe size={14} color="#7c3aed" />,
                    accent: '#7c3aed',
                  },
                  {
                    label: '/api/agent/manifest',
                    url: 'http://localhost:8000/api/agent/manifest',
                    desc: 'Authenticated versioned manifest scoped to this tenant.',
                    icon: <Bot size={14} color="#0044ff" />,
                    accent: '#0044ff',
                  },
                  {
                    label: '/api/agent/catalog',
                    url: 'http://localhost:8000/api/agent/catalog',
                    desc: 'Schema.org JSON-LD product catalog with agent-readable policy flags.',
                    icon: <ShoppingBag size={14} color="#0891b2" />,
                    accent: '#0891b2',
                  },
                  {
                    label: '/api/agent/capabilities',
                    url: 'http://localhost:8000/api/agent/capabilities',
                    desc: 'Machine-readable spend gating, risk, upsell, and payment capabilities.',
                    icon: <Zap size={14} color="#059669" />,
                    accent: '#059669',
                  },
                ].map(ep => (
                  <div key={ep.label} style={{ padding: '0.85rem 1rem', border: '1px solid #e4e4e7', borderLeft: `4px solid ${ep.accent}`, borderRadius: '2px', background: '#faf9f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      {ep.icon}
                      <span className="brutalist-mono" style={{ fontSize: '0.72rem', color: '#111111', fontWeight: 700 }}>{ep.label}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(ep.url); setCopiedUrl(ep.label); setTimeout(() => setCopiedUrl(null), 2000); }}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: copiedUrl === ep.label ? ep.accent : '#71717a', transition: 'color 0.15s' }}
                        title="Copy URL"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="brutalist-text" style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.4, marginBottom: '0.4rem' }}>{ep.desc}</div>
                    <div className="brutalist-mono" style={{ fontSize: '0.67rem', color: ep.accent, wordBreak: 'break-all' }}>{ep.url}</div>
                    {copiedUrl === ep.label && (
                      <div style={{ marginTop: '0.3rem', fontSize: '0.67rem', color: ep.accent, fontWeight: 700 }}>✓ Copied to clipboard</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right: Capability Status */}
              <div style={{ padding: '1.75rem', background: '#faf9f6', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="brutalist-subtitle" style={{ fontSize: '0.65rem', color: '#111111' }}>CAPABILITY STATUS</div>

                {[
                  { icon: <ShieldCheck size={15} color="#0044ff" />, title: 'Deterministic Spend Ceiling', desc: 'Code-enforced guardrail. LLM cannot override.', status: 'ENFORCED', statusColor: '#0044ff' },
                  { icon: <Zap size={15} color="#7c3aed" />, title: 'Dynamic Upsell Engine', desc: 'Complement items auto-bundled within budget.', status: 'ACTIVE', statusColor: '#7c3aed' },
                  { icon: <ShieldAlert size={15} color="#059669" />, title: 'ML Risk Gating', desc: 'XGBoost+LightGBM hybrid, SHAP explainability.', status: 'ACTIVE', statusColor: '#059669' },
                  { icon: <Globe size={15} color="#0891b2" />, title: 'Razorpay Test Gateway', desc: 'Single bounded retry policy, HMAC webhooks.', status: 'LIVE', statusColor: '#0891b2' },
                  { icon: <Bot size={15} color="#f59e0b" />, title: 'Immutable Audit Trail', desc: 'Every state transition logged & replayable.', status: 'ALWAYS-ON', statusColor: '#f59e0b' },
                ].map(cap => (
                  <div key={cap.title} style={{ padding: '0.75rem', background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px', display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                    <div style={{ marginTop: '0.1rem' }}>{cap.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span className="brutalist-text" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#111111' }}>{cap.title}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: cap.statusColor, border: `1px solid ${cap.statusColor}40`, borderRadius: '2px', padding: '0.1rem 0.35rem', background: `${cap.statusColor}10` }}>{cap.status}</span>
                      </div>
                      <div className="brutalist-text" style={{ fontSize: '0.72rem', color: '#71717a', lineHeight: 1.4 }}>{cap.desc}</div>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 'auto', padding: '0.85rem', background: '#7c3aed10', border: '1px solid #7c3aed40', borderRadius: '2px' }}>
                  <div className="brutalist-subtitle" style={{ fontSize: '0.65rem', color: '#7c3aed', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Zap size={11} /> REVENUE GROWTH ENGINE
                  </div>
                  <div className="brutalist-text" style={{ fontSize: '0.75rem', color: '#111111', lineHeight: 1.5 }}>
                    When a buyer's budget has headroom after the primary item, the Negotiation Agent automatically bundles a complementary product at a <strong>10–30% dynamic discount</strong> — strictly within the spend ceiling.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

