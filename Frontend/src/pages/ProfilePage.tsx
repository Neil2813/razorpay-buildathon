import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
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
