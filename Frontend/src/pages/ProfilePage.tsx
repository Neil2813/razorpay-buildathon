import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';


export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('4532 8920 1192 4892');
  const [cardHolder, setCardHolder] = useState('AARAV SHARMA');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('882');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSaveCard = () => {
    // Optionally persist to backend here in a real implementation
    setIsEditingCard(false);
  };

  if (!user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div className="minimal-card" style={{ maxWidth: '600px', width: '100%', padding: '2.5rem' }}>
          <h2 className="brutalist-title" style={{ marginBottom: '2rem', textAlign: 'center', fontSize: '2rem' }}>User Profile</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: '#71717a' }}>Name</p>
              <p className="brutalist-text" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#111111' }}>{user.full_name}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '2px' }}>
              <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: '#71717a' }}>Email</p>
              <p className="brutalist-text" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#111111' }}>{user.email}</p>
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
                  <button onClick={handleSaveCard} className="minimal-btn minimal-btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                    Save
                  </button>
                ) : (
                  <button onClick={() => setIsEditingCard(true)} className="minimal-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', border: '1px solid #e4e4e7' }}>
                    Edit
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
