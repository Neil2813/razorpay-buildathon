import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="container" style={{ paddingTop: '4rem', maxWidth: '600px', margin: '0 auto' }}>
      <div className="glass-box">
        <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>User Profile</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-white)', borderRadius: '8px', border: '1px solid var(--color-bg-gray)' }}>
            <p style={{ color: 'var(--color-text-gray)', fontSize: '0.9rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 500, margin: 0 }}>{user.full_name}</p>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-white)', borderRadius: '8px', border: '1px solid var(--color-bg-gray)' }}>
            <p style={{ color: 'var(--color-text-gray)', fontSize: '0.9rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 500, margin: 0 }}>{user.email}</p>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-white)', borderRadius: '8px', border: '1px solid var(--color-bg-gray)' }}>
            <p style={{ color: 'var(--color-text-gray)', fontSize: '0.9rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 500, margin: 0, textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</p>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-white)', borderRadius: '8px', border: '1px solid var(--color-bg-gray)' }}>
            <p style={{ color: 'var(--color-text-gray)', fontSize: '0.9rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tenant ID</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 500, margin: 0 }}>{user.tenant_id}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
          <button 
            onClick={() => navigate('/history')} 
            style={{ 
              padding: '0.8rem 1.5rem', 
              borderRadius: '4px', 
              border: '1px solid var(--color-primary)', 
              background: 'var(--color-primary)',
              color: '#ffffff',
              cursor: 'pointer',
              flex: 1,
              fontWeight: 600,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Transaction History
          </button>
          <button 
            onClick={() => navigate('/checkout')} 
            style={{ 
              padding: '0.8rem 1.5rem', 
              borderRadius: '4px', 
              border: '1px solid var(--color-bg-gray)', 
              background: 'transparent',
              cursor: 'pointer',
              flex: 1,
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-gray)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Checkout
          </button>
          <button 
            onClick={handleLogout} 
            className="btn-primary" 
            style={{ 
              flex: 1, 
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.8rem 1.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
