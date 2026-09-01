import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';


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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div className="minimal-card" style={{ maxWidth: '600px', width: '100%', padding: '2.5rem' }}>
          <h2 className="brutalist-title" style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '2rem' }}>User Profile</h2>
          
          {successMsg && (
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '2px', color: '#166534', fontSize: '0.85rem', textAlign: 'center', fontFamily: 'Space Grotesk' }}>
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '2px', color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', fontFamily: 'Space Grotesk' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="brutalist-subtitle" style={{ fontSize: '1.2rem', margin: 0, color: '#0044ff' }}>Account Details</h3>
            {isEditingProfile ? (
              <button onClick={handleSaveProfile} disabled={saving} className="minimal-btn minimal-btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            ) : (
              <button onClick={() => setIsEditingProfile(true)} className="minimal-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', border: '1px solid #e4e4e7' }}>
                Edit Profile
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: '#71717a' }}>Name</p>
              {isEditingProfile ? (
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  className="minimal-input"
                />
              ) : (
                <p className="brutalist-text" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#111111' }}>{user.full_name}</p>
              )}
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: '#71717a' }}>Email</p>
              {isEditingProfile ? (
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="minimal-input"
                />
              ) : (
                <p className="brutalist-text" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#111111' }}>{user.email}</p>
              )}
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: '#71717a' }}>Role</p>
              <p className="brutalist-text" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, textTransform: 'capitalize', color: '#111111' }}>{user.role.replace('_', ' ')}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: '#71717a' }}>Tenant ID</p>
              <p className="brutalist-text" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#111111' }}>{user.tenant_id}</p>
            </div>
          </div>

          {user.role === 'buyer' && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="brutalist-subtitle" style={{ fontSize: '1.2rem', margin: 0, color: '#0044ff' }}>Payment Card Details</h3>
                {isEditingCard ? (
                  <button onClick={handleSaveCard} disabled={saving} className="minimal-btn minimal-btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <button onClick={() => setIsEditingCard(true)} className="minimal-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', border: '1px solid #e4e4e7' }}>
                    Edit Card
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Card Number</label>
                  <input 
                    type="text" 
                    value={cardNumber} 
                    onChange={(e) => setCardNumber(e.target.value)} 
                    disabled={!isEditingCard}
                    className="minimal-input" 
                    style={{ opacity: isEditingCard ? 1 : 0.7 }}
                  />
                </div>
                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Card Holder Name</label>
                  <input 
                    type="text" 
                    value={cardHolder} 
                    onChange={(e) => setCardHolder(e.target.value)} 
                    disabled={!isEditingCard}
                    className="minimal-input" 
                    style={{ opacity: isEditingCard ? 1 : 0.7 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Expiry (MM/YY)</label>
                    <input 
                      type="text" 
                      value={cardExpiry} 
                      onChange={(e) => setCardExpiry(e.target.value)} 
                      disabled={!isEditingCard}
                      className="minimal-input" 
                      style={{ opacity: isEditingCard ? 1 : 0.7 }}
                    />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>CVV</label>
                    <input 
                      type={isEditingCard ? "text" : "password"} 
                      value={cardCvv} 
                      onChange={(e) => setCardCvv(e.target.value)} 
                      disabled={!isEditingCard}
                      className="minimal-input" 
                      style={{ opacity: isEditingCard ? 1 : 0.7 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2.5rem' }}>
            <button 
              onClick={() => navigate('/history')} 
              className="minimal-btn minimal-btn-primary"
              style={{ flex: 1 }}
            >
              Transaction History
            </button>
            <button 
              onClick={() => navigate('/checkout')} 
              className="minimal-btn minimal-btn-ghost"
              style={{ flex: 1 }}
            >
              Checkout
            </button>
            <button 
              onClick={handleLogout} 
              className="minimal-btn minimal-btn-danger" 
              style={{ flex: 1 }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
