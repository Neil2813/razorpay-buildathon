import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { MapPin, Truck, Eye, EyeOff } from 'lucide-react';


export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [cardNumber, setCardNumber] = useState(user?.card_number || '4532 8920 1192 4892');
  const [cardHolder, setCardHolder] = useState(user?.card_holder || user?.full_name || 'AARAV SHARMA');
  const [cardExpiry, setCardExpiry] = useState(user?.card_expiry || '12/28');
  const [cardCvv, setCardCvv] = useState(user?.card_cvv || '882');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Merchant settings / setup state
  const [companyName, setCompanyName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', line1: '', city: '', state: '', pincode: '' });

  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [newZone, setNewZone] = useState<any>({ coverage_type: 'state', coverage_value: '', shipping_fee: '', delivery_days: '' });

  const fetchMerchantData = async () => {
    try {
      const setupRes = await api.get('/commerce/merchant/setup');
      const m = setupRes.merchant || {};
      setCompanyName(m.company_name || m.name || '');
      setSupportEmail(m.support_email || '');
      setSupportPhone(m.support_phone || '');
      setRazorpayKeyId(m.razorpay_key_id || '');
      setRazorpayKeySecret(m.razorpay_key_secret || '');
      setWarehouses(setupRes.warehouses || []);
      setDeliveryZones(setupRes.delivery_zones || []);
    } catch (err) {
      console.error('Failed to fetch merchant profile', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'merchant_admin') {
      fetchMerchantData();
    }
  }, [user]);

  const handleUpdateMerchantProfile = async (e: React.FormEvent) => {
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
    } catch {
      setErrorMsg('Failed to update company profile');
    }
  };

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/commerce/merchant/warehouses', newWarehouse);
      setNewWarehouse({ name: '', line1: '', city: '', state: '', pincode: '' });
      fetchMerchantData();
    } catch {
      setErrorMsg('Failed to add warehouse. PIN must be 6 digits.');
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/commerce/merchant/delivery-zones', newZone);
      setNewZone({ coverage_type: 'state', coverage_value: '', shipping_fee: 0, delivery_days: 3 });
      fetchMerchantData();
    } catch {
      setErrorMsg('Failed to add delivery zone.');
    }
  };

  const handleDeleteWarehouse = async (warehouseId: string) => {
    try {
      await api.delete(`/commerce/merchant/warehouses/${warehouseId}`);
      fetchMerchantData();
    } catch {
      setErrorMsg('Failed to delete warehouse.');
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await api.delete(`/commerce/merchant/delivery-zones/${zoneId}`);
      fetchMerchantData();
    } catch {
      setErrorMsg('Failed to delete delivery zone.');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateProfile({
        full_name: fullName,
        email: email,
      });
      setIsEditingProfile(false);
      setSuccessMsg('User profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCard = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateProfile({
        card_number: cardNumber,
        card_holder: cardHolder,
        card_expiry: cardExpiry,
        card_cvv: cardCvv,
      });
      setIsEditingCard(false);
      setSuccessMsg('Payment card details updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to update card details.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#ffffff' }}>
      <Navbar />
      <div className="container" style={{ flex: 1, maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%' }}>
        
        <div style={{ border: '2px solid #060e26', boxShadow: '4px 4px 0px #060e26', borderRadius: '0px', background: '#ffffff', padding: '2.5rem' }}>
          <h2 className="brutalist-title" style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '2.2rem', color: '#060e26', fontWeight: 900, textTransform: 'uppercase' }}>User Profile</h2>
          
          {successMsg && (
            <div className="brutalist-text" style={{ marginBottom: '1.5rem', padding: '0.85rem 1rem', background: '#dcfce7', border: '2px solid #060e26', boxShadow: '2px 2px 0px #060e26', color: '#166534', fontSize: '0.85rem', textAlign: 'center', fontWeight: 800 }}>
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="brutalist-text" style={{ marginBottom: '1.5rem', padding: '0.85rem 1rem', background: '#fee2e2', border: '2px solid #060e26', boxShadow: '2px 2px 0px #060e26', color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', fontWeight: 800 }}>
              {errorMsg}
            </div>
          )}

          {/* Account Details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="brutalist-subtitle" style={{ fontSize: '1.2rem', margin: 0, color: '#060e26', fontWeight: 900, textTransform: 'uppercase' }}>Account Details</h3>
            {isEditingProfile ? (
              <button onClick={handleSaveProfile} disabled={saving} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: '#060e26', color: '#ffffff', border: '2px solid #060e26', boxShadow: '2px 2px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            ) : (
              <button onClick={() => setIsEditingProfile(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: '#ffffff', color: '#060e26', border: '2px solid #060e26', boxShadow: '2px 2px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}>
                Edit Profile
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', margin: '0 0 0.4rem 0', color: '#52525b', fontWeight: 800 }}>Name</p>
              {isEditingProfile ? (
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }}
                />
              ) : (
                <p className="brutalist-title" style={{ fontSize: '1.2rem', margin: 0, color: '#060e26', fontWeight: 800 }}>{user.full_name}</p>
              )}
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', margin: '0 0 0.4rem 0', color: '#52525b', fontWeight: 800 }}>Email</p>
              {isEditingProfile ? (
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }}
                />
              ) : (
                <p className="brutalist-text" style={{ fontSize: '1.1rem', margin: 0, color: '#060e26', fontWeight: 700 }}>{user.email}</p>
              )}
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', margin: '0 0 0.4rem 0', color: '#52525b', fontWeight: 800 }}>Role</p>
              <p className="brutalist-title" style={{ fontSize: '1.2rem', margin: 0, textTransform: 'uppercase', color: '#060e26', fontWeight: 900 }}>{user.role.replace('_', ' ')}</p>
            </div>
          </div>

          {user.role === 'buyer' && (
            <div style={{ marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="brutalist-subtitle" style={{ fontSize: '1.2rem', margin: 0, color: '#060e26', fontWeight: 900, textTransform: 'uppercase' }}>Payment Card Details</h3>
                {isEditingCard ? (
                  <button onClick={handleSaveCard} disabled={saving} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: '#060e26', color: '#ffffff', border: '2px solid #060e26', boxShadow: '2px 2px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <button onClick={() => setIsEditingCard(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', background: '#ffffff', color: '#060e26', border: '2px solid #060e26', boxShadow: '2px 2px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}>
                    Edit Card
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', backgroundColor: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px' }}>
                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#52525b', fontWeight: 800, display: 'block', marginBottom: '0.35rem' }}>Card Number</label>
                  <input 
                    type="text" 
                    value={cardNumber} 
                    onChange={(e) => setCardNumber(e.target.value)} 
                    disabled={!isEditingCard}
                    style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', opacity: isEditingCard ? 1 : 0.7, background: isEditingCard ? '#ffffff' : '#f4f4f5' }}
                  />
                </div>
                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#52525b', fontWeight: 800, display: 'block', marginBottom: '0.35rem' }}>Card Holder Name</label>
                  <input 
                    type="text" 
                    value={cardHolder} 
                    onChange={(e) => setCardHolder(e.target.value)} 
                    disabled={!isEditingCard}
                    style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', opacity: isEditingCard ? 1 : 0.7, background: isEditingCard ? '#ffffff' : '#f4f4f5' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#52525b', fontWeight: 800, display: 'block', marginBottom: '0.35rem' }}>Expiry (MM/YY)</label>
                    <input 
                      type="text" 
                      value={cardExpiry} 
                      onChange={(e) => setCardExpiry(e.target.value)} 
                      disabled={!isEditingCard}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', opacity: isEditingCard ? 1 : 0.7, background: isEditingCard ? '#ffffff' : '#f4f4f5' }}
                    />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#52525b', fontWeight: 800, display: 'block', marginBottom: '0.35rem' }}>CVV</label>
                    <input 
                      type={isEditingCard ? "text" : "password"} 
                      value={cardCvv} 
                      onChange={(e) => setCardCvv(e.target.value)} 
                      disabled={!isEditingCard}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', opacity: isEditingCard ? 1 : 0.7, background: isEditingCard ? '#ffffff' : '#f4f4f5' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {user.role === 'merchant_admin' && (
            <div style={{ marginTop: '2.5rem' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px', marginBottom: '2rem' }}>
                <h3 className="brutalist-title" style={{ margin: '0 0 1rem 0', fontSize: '1.4rem', textTransform: 'uppercase', color: '#060e26', fontWeight: 900 }}>Merchant profile</h3>
                
                {profileSaved && (
                  <div style={{ marginBottom: '1rem', padding: '0.5rem 0.8rem', background: '#dcfce7', border: '2px solid #060e26', color: '#166534', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', display: 'inline-block', boxShadow: '2px 2px 0px #060e26' }}>
                    Profile details updated
                  </div>
                )}
                
                <form onSubmit={handleUpdateMerchantProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input type="text" placeholder="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  <input type="email" placeholder="Support Email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  <input type="tel" placeholder="Support Phone" value={supportPhone} onChange={e => setSupportPhone(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  
                  <div style={{ borderTop: '2px solid #060e26', paddingTop: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="brutalist-subtitle" style={{ fontSize: '0.85rem', color: '#060e26', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Razorpay Test Gateway Credentials</div>
                      <button type="button" onClick={() => setShowKeys(!showKeys)} style={{ background: '#060e26', border: '2px solid #060e26', padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#ffffff', boxShadow: '2px 2px 0px #000000' }}>
                        {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <input type={showKeys ? "text" : "password"} placeholder="Razorpay Key ID" value={razorpayKeyId} onChange={e => setRazorpayKeyId(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                    <input type={showKeys ? "text" : "password"} placeholder="Razorpay Key Secret" value={razorpayKeySecret} onChange={e => setRazorpayKeySecret(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  </div>

                  <button type="submit" style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem', background: '#060e26', color: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer', marginTop: '0.5rem' }}>
                    Save Merchant Profile & Credentials
                  </button>
                </form>
              </div>

              {/* Warehouse Locations */}
              <div style={{ padding: '1.5rem', backgroundColor: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px', marginBottom: '2rem' }}>
                <h3 className="brutalist-title" style={{ margin: '0 0 1rem 0', fontSize: '1.4rem', textTransform: 'uppercase', color: '#060e26', fontWeight: 900 }}>Warehouses</h3>
                
                {/* Add Warehouse Form */}
                <form onSubmit={handleAddWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <input type="text" placeholder="Warehouse Name" value={newWarehouse.name} onChange={e => setNewWarehouse({...newWarehouse, name: e.target.value})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  <input type="text" placeholder="Line 1 Address" value={newWarehouse.line1} onChange={e => setNewWarehouse({...newWarehouse, line1: e.target.value})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <input type="text" placeholder="City" value={newWarehouse.city} onChange={e => setNewWarehouse({...newWarehouse, city: e.target.value})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                    <input type="text" placeholder="State" value={newWarehouse.state} onChange={e => setNewWarehouse({...newWarehouse, state: e.target.value})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  </div>
                  <input type="text" placeholder="PIN Code (6 digits)" value={newWarehouse.pincode} onChange={e => setNewWarehouse({...newWarehouse, pincode: e.target.value})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem', background: '#060e26', color: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer', marginTop: '0.5rem' }}>
                    + CREATE WAREHOUSE
                  </button>
                </form>

                {/* Warehouse List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {warehouses.map((w: any) => (
                    <div key={w.warehouse_id} style={{ background: '#f6f1e5', padding: '1rem', borderRadius: '0px', border: '2px solid #060e26', boxShadow: '2px 2px 0px #060e26', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span className="brutalist-title" style={{ fontSize: '1rem', fontWeight: 900, color: '#060e26' }}>{w.name}</span>
                        <div style={{ color: '#52525b', fontSize: '0.8rem', marginTop: '0.35rem', fontWeight: 600 }}>{w.line1}, {w.city}, {w.state} - {w.pincode}</div>
                      </div>
                      <button onClick={() => handleDeleteWarehouse(w.warehouse_id)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', background: '#ef4444', color: '#ffffff', border: '2px solid #060e26', boxShadow: '2px 2px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery zones */}
              <div style={{ padding: '1.5rem', backgroundColor: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #060e26', borderRadius: '0px' }}>
                <h3 className="brutalist-title" style={{ margin: '0 0 1rem 0', fontSize: '1.4rem', textTransform: 'uppercase', color: '#060e26', fontWeight: 900 }}>Delivery Coverage</h3>

                {/* Add Zone Form */}
                <form onSubmit={handleAddZone} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <select value={newZone.coverage_type} onChange={e => setNewZone({...newZone, coverage_type: e.target.value})} style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', background: '#ffffff', cursor: 'pointer' }}>
                    <option value="all_india">All India</option>
                    <option value="state">State Limit</option>
                    <option value="city">City Limit</option>
                    <option value="pincode">Pincode Limit</option>
                  </select>
                  {newZone.coverage_type !== 'all_india' && (
                    <input type="text" placeholder="Coverage Value (e.g. Karnataka / Bengaluru / 560001)" value={newZone.coverage_value} onChange={e => setNewZone({...newZone, coverage_value: e.target.value})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <input type="number" placeholder="Fee (₹)" value={newZone.shipping_fee || ''} onChange={e => setNewZone({...newZone, shipping_fee: Number(e.target.value) || 0})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                    <input type="number" placeholder="Number of days for deliveries" value={newZone.delivery_days || ''} onChange={e => setNewZone({...newZone, delivery_days: Number(e.target.value) || 1})} required style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.85rem', border: '1.5px solid #060e26', borderRadius: '0px', color: '#060e26', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", outline: 'none' }} />
                  </div>
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem', background: '#060e26', color: '#ffffff', border: '2px solid #060e26', boxShadow: '3px 3px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer', marginTop: '0.5rem' }}>
                    + CREATE DELIVERY ZONE
                  </button>
                </form>

                {/* Zone List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {deliveryZones.map((z: any) => (
                    <div key={z.zone_id} style={{ background: '#f6f1e5', padding: '1rem', borderRadius: '0px', border: '2px solid #060e26', boxShadow: '2px 2px 0px #060e26', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <span className="brutalist-title" style={{ fontSize: '1rem', fontWeight: 900, color: '#060e26', textTransform: 'uppercase' }}>{z.coverage_type.replace('_', ' ')}</span>
                        <div style={{ color: '#52525b', fontSize: '0.8rem', marginTop: '0.35rem', fontWeight: 600 }}>Scope: {z.coverage_value || 'National'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: '#ffffff', color: '#060e26', border: '1.5px solid #060e26', fontWeight: 900, boxShadow: '2px 2px 0px #060e26', textTransform: 'uppercase' }}>
                          ₹{z.shipping_fee} · {z.delivery_days} days
                        </span>
                        <button onClick={() => handleDeleteZone(z.zone_id)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', background: '#ef4444', color: '#ffffff', border: '2px solid #060e26', boxShadow: '2px 2px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
            <button 
              onClick={handleLogout} 
              style={{ flex: 1, padding: '1rem', fontSize: '0.9rem', background: '#ef4444', color: '#ffffff', border: '2px solid #060e26', boxShadow: '4px 4px 0px #000000', fontWeight: 900, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", borderRadius: '0px', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
